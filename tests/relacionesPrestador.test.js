const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const uriPruebas = process.env.MONGO_URI_TEST;

const obtenerNombreBase = (uri = '') => {
  const sinConsulta = uri.split('?')[0].replace(/\/$/, '');
  return sinConsulta.slice(sinConsulta.lastIndexOf('/') + 1);
};

if (!uriPruebas) {
  throw new Error('Debés definir MONGO_URI_TEST para ejecutar estas pruebas.');
}

if (!/(test|prueba)/i.test(obtenerNombreBase(uriPruebas))) {
  throw new Error('Las pruebas solo pueden usar una base test/prueba.');
}

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = uriPruebas;
delete process.env.MONGODB_URI;
delete process.env.REDIS_URL;
process.env.SEED_DEMO_DATA = 'false';
process.env.SECRETO_AUTENTICACION =
  process.env.SECRETO_AUTENTICACION_TEST || 'medintegral-relaciones-test';

const aplicacion = require('../src/app');
const { runSeed: ejecutarSeed } = require('../src/reiniciarDB');
const { mongoose } = require('../src/config/db');
const { Prestador, Agenda } = require('../src/models');

let servidor;
let urlBase;

const solicitar = async (
  ruta,
  { metodo = 'GET', token = '', cuerpo = undefined } = {}
) => {
  const encabezados = {};
  if (token) encabezados.Authorization = `Bearer ${token}`;
  if (cuerpo !== undefined) encabezados['Content-Type'] = 'application/json';

  const respuesta = await fetch(`${urlBase}${ruta}`, {
    method: metodo,
    headers: encabezados,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });

  const texto = await respuesta.text();
  let datos = null;
  if (texto) {
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = texto;
    }
  }

  return { estado: respuesta.status, datos };
};

const iniciarAdministrador = async () => {
  const respuesta = await solicitar('/autenticacion/iniciar-sesion', {
    metodo: 'POST',
    cuerpo: {
      identificador: 'admin@medintegral.com',
      contrasena: 'Admin1234',
      rol: 'ADMIN',
    },
  });
  assert.equal(respuesta.estado, 200, JSON.stringify(respuesta.datos));
  return respuesta.datos.token;
};

before(async () => {
  await ejecutarSeed({ clean: true });

  await new Promise((resolver, rechazar) => {
    servidor = aplicacion.listen(0, '127.0.0.1', resolver);
    servidor.once('error', rechazar);
  });

  const direccion = servidor.address();
  urlBase = `http://127.0.0.1:${direccion.port}`;
});

after(async () => {
  if (servidor) {
    await new Promise((resolver) => servidor.close(resolver));
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test('MedIntegral - integridad de relaciones al editar prestadores', async (t) => {
  await ejecutarSeed({ clean: true });
  const token = await iniciarAdministrador();

  await t.test('no permite quitar una especialidad utilizada por una agenda', async () => {
    const house = await Prestador.findOne({ nombre: 'Dr. House' });
    const agendasHouse = await Agenda.find({ prestadorId: house._id });
    assert.equal(agendasHouse.length, 2);
    assert.equal(house.especialidades.length, 2);

    const especialidadConservada = house.especialidades[0];
    const especialidadesAntes = house.especialidades.map(String).sort();

    const respuesta = await solicitar(`/prestadores/${house._id}`, {
      metodo: 'PUT',
      token,
      cuerpo: { especialidades: [especialidadConservada] },
    });

    assert.equal(respuesta.estado, 409, JSON.stringify(respuesta.datos));
    assert.equal(respuesta.datos?.codigo, 'ESPECIALIDAD_CON_AGENDA');

    const houseDespues = await Prestador.findById(house._id);
    assert.deepEqual(
      houseDespues.especialidades.map(String).sort(),
      especialidadesAntes
    );
  });

  await t.test('no permite desactivar un centro médico con prestadores asociados', async () => {
    const clinica = await Prestador.findOne({ nombre: 'Clinica Mayo' });
    const asociado = await Prestador.findOne({ centroMedicoQueIntegra: clinica._id });
    assert.ok(clinica?.esCentroMedico);
    assert.ok(asociado);

    const respuesta = await solicitar(`/prestadores/${clinica._id}`, {
      metodo: 'PUT',
      token,
      cuerpo: { esCentroMedico: false },
    });

    assert.equal(respuesta.estado, 409, JSON.stringify(respuesta.datos));
    assert.equal(respuesta.datos?.codigo, 'CENTRO_MEDICO_CON_PRESTADORES');

    const clinicaDespues = await Prestador.findById(clinica._id);
    const asociadoDespues = await Prestador.findById(asociado._id);
    assert.equal(clinicaDespues.esCentroMedico, true);
    assert.equal(
      String(asociadoDespues.centroMedicoQueIntegra),
      String(clinica._id)
    );
  });
});
