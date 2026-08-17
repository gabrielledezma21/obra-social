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
  process.env.SECRETO_AUTENTICACION_TEST || 'medintegral-grupo-test';

const aplicacion = require('../src/app');
const { runSeed: ejecutarSeed } = require('../src/reiniciarDB');
const { mongoose } = require('../src/config/db');
const { Afiliado } = require('../src/models');

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

test('MedIntegral - vigencia del grupo familiar', async (t) => {
  await ejecutarSeed({ clean: true });
  const token = await iniciarAdministrador();
  const titular = await Afiliado.findOne({ dni: 10000001 });
  const familiar = await Afiliado.findOne({ afiliadoTitularId: titular._id });
  assert.ok(titular);
  assert.ok(familiar);

  await t.test('la baja grupal persiste en titular y dependientes', async () => {
    const fechaBaja = '2026-12-31';
    const respuesta = await solicitar(`/afiliados/${titular._id}`, {
      metodo: 'PUT',
      token,
      cuerpo: { fechaBaja, aplicarAGrupoFamiliar: true },
    });

    assert.equal(respuesta.estado, 200, JSON.stringify(respuesta.datos));

    const integrantes = await Afiliado.find({
      $or: [
        { _id: titular._id },
        { afiliadoTitularId: titular._id },
      ],
    });
    assert.equal(integrantes.length, 4);
    integrantes.forEach((integrante) => {
      assert.equal(
        integrante.fechaBaja.toISOString().slice(0, 10),
        fechaBaja
      );
    });

    const getTitular = await solicitar(`/afiliados/${titular._id}`, { token });
    assert.equal(getTitular.estado, 200);
    assert.equal(getTitular.datos.fechaBaja.slice(0, 10), fechaBaja);
    assert.equal(getTitular.datos.familiares.length, 3);
    getTitular.datos.familiares.forEach((integrante) => {
      assert.equal(integrante.fechaBaja.slice(0, 10), fechaBaja);
    });
  });

  await t.test('la reincorporación grupal limpia la fecha de todos', async () => {
    const respuesta = await solicitar(`/afiliados/${titular._id}`, {
      metodo: 'PUT',
      token,
      cuerpo: { fechaBaja: null, aplicarAGrupoFamiliar: true },
    });
    assert.equal(respuesta.estado, 200, JSON.stringify(respuesta.datos));

    const integrantes = await Afiliado.find({
      $or: [
        { _id: titular._id },
        { afiliadoTitularId: titular._id },
      ],
    });
    integrantes.forEach((integrante) => assert.equal(integrante.fechaBaja, null));

    const getTitular = await solicitar(`/afiliados/${titular._id}`, { token });
    assert.equal(getTitular.estado, 200);
    assert.equal(getTitular.datos.fechaBaja, null);
    getTitular.datos.familiares.forEach((integrante) => {
      assert.equal(integrante.fechaBaja, null);
    });
  });

  await t.test('un familiar no puede aplicar cambios a todo el grupo', async () => {
    const respuesta = await solicitar(`/afiliados/${familiar._id}`, {
      metodo: 'PUT',
      token,
      cuerpo: {
        fechaBaja: '2027-01-15',
        aplicarAGrupoFamiliar: true,
      },
    });

    assert.equal(respuesta.estado, 400, JSON.stringify(respuesta.datos));
    assert.equal(respuesta.datos?.codigo, 'SOLO_TITULAR_PUEDE_MODIFICAR_GRUPO');
  });
});
