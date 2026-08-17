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
  process.env.SECRETO_AUTENTICACION_TEST || 'medintegral-rollback-test';

const aplicacion = require('../src/app');
const { runSeed: ejecutarSeed } = require('../src/reiniciarDB');
const { mongoose } = require('../src/config/db');
const {
  Afiliado,
  Prestador,
  CentroDeAtencion,
  Direccion,
  Horario,
  Especialidad,
} = require('../src/models');

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

const crearHorario = () => ({
  duracionTurno: 30,
  dias: {
    Lunes: {
      atiende: true,
      bloques: [{ horaInicio: '09:00', horaFin: '13:00' }],
    },
    Martes: { atiende: false, bloques: [] },
    Miercoles: { atiende: false, bloques: [] },
    Jueves: { atiende: false, bloques: [] },
    Viernes: { atiende: false, bloques: [] },
    Sabado: { atiende: false, bloques: [] },
    Domingo: { atiende: false, bloques: [] },
  },
});

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

test('MedIntegral - rollback de operaciones fallidas', async (t) => {
  await t.test('una edición inválida de afiliado conserva la dirección anterior', async () => {
    await ejecutarSeed({ clean: true });
    const token = await iniciarAdministrador();
    const afiliadoAntes = await Afiliado.findOne({ dni: 10000001 });
    const idDireccionAntes = String(afiliadoAntes.direccionId);
    const direccionAntes = await Direccion.findById(idDireccionAntes).lean();
    const cantidadDireccionesAntes = await Direccion.countDocuments();

    const respuesta = await solicitar(`/afiliados/${afiliadoAntes._id}`, {
      metodo: 'PUT',
      token,
      cuerpo: {
        plan: 'PLAN_INVALIDO',
        direcciones: [
          {
            calle: 'Direccion Rollback',
            altura: 999,
            localidad: 'Moron',
            codigoPostal: '1708',
            provincia: 'Buenos Aires',
          },
        ],
      },
    });

    assert.equal(respuesta.estado, 400, JSON.stringify(respuesta.datos));

    const afiliadoDespues = await Afiliado.findById(afiliadoAntes._id);
    assert.equal(String(afiliadoDespues.direccionId), idDireccionAntes);
    assert.ok(await Direccion.findById(idDireccionAntes));
    assert.equal(
      (await Direccion.findById(idDireccionAntes)).calle,
      direccionAntes.calle
    );
    assert.equal(
      await Direccion.countDocuments({ calle: 'Direccion Rollback' }),
      0,
      'La dirección creada para una edición fallida debe revertirse'
    );
    assert.equal(await Direccion.countDocuments(), cantidadDireccionesAntes);
  });

  await t.test('si falla el segundo centro del alta de prestador no queda persistido el primero', async () => {
    await ejecutarSeed({ clean: true });
    const token = await iniciarAdministrador();
    const especialidad = await Especialidad.findOne({ nombre: 'Cardiologia' });

    const cantidadesAntes = {
      prestadores: await Prestador.countDocuments(),
      centros: await CentroDeAtencion.countDocuments(),
      direcciones: await Direccion.countDocuments(),
      horarios: await Horario.countDocuments(),
    };

    const respuesta = await solicitar('/prestadores', {
      metodo: 'POST',
      token,
      cuerpo: {
        nombre: 'Dr. Rollback Centros',
        cuilCuit: '20940000019',
        emails: [{ direccion: 'rollback.centros@test.com' }],
        telefonos: [{ numero: '1194000001' }],
        especialidades: [especialidad._id],
        centrosDeAtencion: [
          {
            direccion: {
              calle: 'Primer Centro Valido',
              altura: 100,
              localidad: 'Moron',
              codigoPostal: '1708',
              provincia: 'Buenos Aires',
            },
            horario: crearHorario(),
          },
          {
            direccion: {
              calle: 'Segundo Centro Invalido',
              altura: 200,
              localidad: 'Moron',
              codigoPostal: '1708',
              provincia: 'Provincia Inexistente',
            },
            horario: crearHorario(),
          },
        ],
      },
    });

    assert.equal(respuesta.estado, 400, JSON.stringify(respuesta.datos));
    assert.equal(
      await Prestador.exists({ cuilCuit: '20940000019' }),
      null
    );
    assert.equal(await Prestador.countDocuments(), cantidadesAntes.prestadores);
    assert.equal(await CentroDeAtencion.countDocuments(), cantidadesAntes.centros);
    assert.equal(await Direccion.countDocuments(), cantidadesAntes.direcciones);
    assert.equal(await Horario.countDocuments(), cantidadesAntes.horarios);
    assert.equal(
      await Direccion.countDocuments({ calle: 'Primer Centro Valido' }),
      0
    );
  });
});
