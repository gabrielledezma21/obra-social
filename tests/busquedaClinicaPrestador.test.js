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
  process.env.SECRETO_AUTENTICACION_TEST || 'medintegral-busqueda-clinica-test';

const aplicacion = require('../src/app');
const { runSeed: ejecutarSeed } = require('../src/reiniciarDB');
const { mongoose } = require('../src/config/db');
const { Afiliado } = require('../src/models');

let servidor;
let urlBase;
let tokenPrestador;

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
  const datos = texto ? JSON.parse(texto) : null;
  return { estado: respuesta.status, datos };
};

before(async () => {
  await ejecutarSeed({ clean: true });

  await new Promise((resolver, rechazar) => {
    servidor = aplicacion.listen(0, '127.0.0.1', resolver);
    servidor.once('error', rechazar);
  });

  const direccion = servidor.address();
  urlBase = `http://127.0.0.1:${direccion.port}`;

  const sesion = await solicitar('/autenticacion/iniciar-sesion', {
    metodo: 'POST',
    cuerpo: {
      identificador: '12345678',
      contrasena: 'Demo1234',
      rol: 'PRESTADOR',
    },
  });
  assert.equal(sesion.estado, 200, JSON.stringify(sesion.datos));
  tokenPrestador = sesion.datos.token;
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

test('MedIntegral - búsqueda clínica del prestador', async (t) => {
  const homero = await Afiliado.findOne({ dni: 10000001 });
  assert.ok(homero);

  await t.test('encuentra un paciente por nombre', async () => {
    const respuesta = await solicitar(
      '/portal-prestador/afiliados/buscar?busqueda=Homero',
      { token: tokenPrestador }
    );

    assert.equal(respuesta.estado, 200, JSON.stringify(respuesta.datos));
    assert.ok(
      respuesta.datos.some((afiliado) => afiliado.dni === 10000001),
      JSON.stringify(respuesta.datos)
    );
  });

  await t.test('encuentra un paciente por DNI', async () => {
    const respuesta = await solicitar(
      '/portal-prestador/afiliados/buscar?busqueda=10000001',
      { token: tokenPrestador }
    );

    assert.equal(respuesta.estado, 200, JSON.stringify(respuesta.datos));
    assert.equal(respuesta.datos[0]?.dni, 10000001);
  });

  await t.test('encuentra un paciente por credencial completa', async () => {
    const credencial = `${homero.numeroAfiliado}-${homero.numeroIntegrante}`;
    const respuesta = await solicitar(
      `/portal-prestador/afiliados/buscar?busqueda=${encodeURIComponent(
        credencial
      )}`,
      { token: tokenPrestador }
    );

    assert.equal(respuesta.estado, 200, JSON.stringify(respuesta.datos));
    assert.ok(
      respuesta.datos.some((afiliado) => afiliado.dni === 10000001),
      JSON.stringify(respuesta.datos)
    );
  });

  await t.test('expone el catálogo de situaciones terapéuticas', async () => {
    const respuesta = await solicitar(
      '/portal-prestador/situaciones-terapeuticas',
      { token: tokenPrestador }
    );

    assert.equal(respuesta.estado, 200, JSON.stringify(respuesta.datos));
    assert.ok(Array.isArray(respuesta.datos));
    assert.ok(respuesta.datos.length > 0);
    assert.ok(respuesta.datos.every((situacion) => situacion.nombre));
  });
});
