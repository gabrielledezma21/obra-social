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
  process.env.SECRETO_AUTENTICACION_TEST || 'medintegral-observaciones-test';

const aplicacion = require('../src/app');
const { runSeed: ejecutarSeed } = require('../src/reiniciarDB');
const { mongoose } = require('../src/config/db');
const { Afiliado } = require('../src/models');
const Solicitud = require('../src/models/solicitud');

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

const iniciarSesion = async (identificador, contrasena, rol) => {
  const respuesta = await solicitar('/autenticacion/iniciar-sesion', {
    metodo: 'POST',
    cuerpo: { identificador, contrasena, rol },
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

test('MedIntegral - flujo completo de una solicitud observada', async () => {
  await ejecutarSeed({ clean: true });

  const [tokenAfiliado, tokenPrestador, homero] = await Promise.all([
    iniciarSesion('10000001', 'Demo1234', 'AFILIADO'),
    iniciarSesion('12345678', 'Demo1234', 'PRESTADOR'),
    Afiliado.findOne({ dni: 10000001 }),
  ]);

  let respuesta = await solicitar('/portal-afiliado/solicitudes', {
    metodo: 'POST',
    token: tokenAfiliado,
    cuerpo: {
      tipo: 'RECETA',
      afiliadoId: homero._id,
      datos: {
        medicamento: 'Medicamento observado',
        cantidad: 1,
        presentacion: 'Caja',
      },
    },
  });

  assert.equal(respuesta.estado, 201, JSON.stringify(respuesta.datos));
  const idSolicitud = respuesta.datos._id;

  respuesta = await solicitar(
    `/portal-afiliado/solicitudes/${idSolicitud}/responder-observacion`,
    {
      metodo: 'POST',
      token: tokenAfiliado,
      cuerpo: { texto: 'Respuesta prematura' },
    }
  );
  assert.equal(respuesta.estado, 409);

  respuesta = await solicitar(
    `/portal-prestador/solicitudes/${idSolicitud}/estado`,
    {
      metodo: 'POST',
      token: tokenPrestador,
      cuerpo: { estado: 'Observado' },
    }
  );
  assert.equal(respuesta.estado, 400, 'Observar sin motivo debe rechazarse');

  const motivoObservacion = 'Adjuntar indicación médica actualizada.';
  respuesta = await solicitar(
    `/portal-prestador/solicitudes/${idSolicitud}/estado`,
    {
      metodo: 'POST',
      token: tokenPrestador,
      cuerpo: { estado: 'Observado', motivo: motivoObservacion },
    }
  );
  assert.equal(respuesta.estado, 200, JSON.stringify(respuesta.datos));
  assert.equal(respuesta.datos.estado, 'Observado');

  let persistida = await Solicitud.findById(idSolicitud);
  assert.equal(persistida.estado, 'Observado');
  assert.equal(
    persistida.historialEstados.at(-1).motivo,
    motivoObservacion
  );

  const textoRespuesta = 'Adjunto la indicación solicitada y confirmo la dosis.';
  respuesta = await solicitar(
    `/portal-afiliado/solicitudes/${idSolicitud}/responder-observacion`,
    {
      metodo: 'POST',
      token: tokenAfiliado,
      cuerpo: { texto: textoRespuesta },
    }
  );
  assert.equal(respuesta.estado, 200, JSON.stringify(respuesta.datos));
  assert.equal(respuesta.datos.estado, 'En análisis');

  persistida = await Solicitud.findById(idSolicitud);
  assert.equal(persistida.estado, 'En análisis');
  assert.equal(persistida.asignadoAUsuarioId, null);
  assert.equal(persistida.comentarios.at(-1).texto, textoRespuesta);
  assert.equal(
    persistida.historialEstados.at(-1).motivo,
    'Respuesta del afiliado'
  );

  respuesta = await solicitar('/portal-afiliado/solicitudes', {
    token: tokenAfiliado,
  });
  assert.equal(respuesta.estado, 200);
  const desdePortalAfiliado = respuesta.datos.find(
    (solicitud) => String(solicitud._id) === String(idSolicitud)
  );
  assert.equal(desdePortalAfiliado.estado, 'En análisis');
  assert.equal(desdePortalAfiliado.comentarios.at(-1).texto, textoRespuesta);

  respuesta = await solicitar('/portal-prestador/solicitudes', {
    token: tokenPrestador,
  });
  assert.equal(respuesta.estado, 200);
  assert.ok(
    respuesta.datos.some(
      (solicitud) => String(solicitud._id) === String(idSolicitud)
    )
  );

  respuesta = await solicitar(
    `/portal-prestador/solicitudes/${idSolicitud}/estado`,
    {
      metodo: 'POST',
      token: tokenPrestador,
      cuerpo: { estado: 'Aprobado' },
    }
  );
  assert.equal(respuesta.estado, 200, JSON.stringify(respuesta.datos));

  persistida = await Solicitud.findById(idSolicitud);
  assert.equal(persistida.estado, 'Aprobado');
  assert.equal(persistida.asignadoAUsuarioId, null);
});
