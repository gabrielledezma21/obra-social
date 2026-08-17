const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const uriPruebas = process.env.MONGO_URI_TEST;
if (!uriPruebas) {
  throw new Error('Debés definir MONGO_URI_TEST para ejecutar estas pruebas.');
}

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = uriPruebas;
delete process.env.MONGODB_URI;
delete process.env.REDIS_URL;
process.env.SEED_DEMO_DATA = 'false';
process.env.SECRETO_AUTENTICACION =
  process.env.SECRETO_AUTENTICACION_TEST || 'medintegral-secreto-pruebas';

const aplicacion = require('../src/app');
const { runSeed: ejecutarSeed } = require('../src/reiniciarDB');
const { mongoose } = require('../src/config/db');
const { Agenda, Prestador } = require('../src/models');

const DIAS_SEMANA = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miercoles',
  'Jueves',
  'Viernes',
  'Sabado',
];

let servidor;
let urlBase;
let tokenAfiliado;
let agendaObjetivo;
let fechaObjetivo;
let localidadObjetivo;

const formatearFecha = (fecha) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(
    fecha.getDate()
  ).padStart(2, '0')}`;

const obtenerFechaFutura = (diasAtencion) => {
  const hoy = new Date();
  hoy.setHours(12, 0, 0, 0);

  for (let desplazamiento = 7; desplazamiento <= 21; desplazamiento += 1) {
    const candidata = new Date(hoy);
    candidata.setDate(candidata.getDate() + desplazamiento);
    if (diasAtencion.includes(DIAS_SEMANA[candidata.getDay()])) {
      return formatearFecha(candidata);
    }
  }

  throw new Error('No se encontró una fecha futura compatible con la agenda.');
};

const solicitar = async (ruta, opciones = {}) => {
  const respuesta = await fetch(`${urlBase}${ruta}`, {
    method: opciones.metodo || 'GET',
    headers: {
      ...(opciones.token
        ? { Authorization: `Bearer ${opciones.token}` }
        : {}),
      ...(opciones.cuerpo ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
  });

  const texto = await respuesta.text();
  return {
    estado: respuesta.status,
    datos: texto ? JSON.parse(texto) : null,
  };
};

before(async () => {
  await ejecutarSeed({ clean: true });

  const house = await Prestador.findOne({ nombre: 'Dr. House' });
  assert.ok(house);

  agendaObjetivo = await Agenda.findOne({ prestadorId: house._id }).populate({
    path: 'centroDeAtencionId',
    populate: { path: 'direccionId' },
  });
  assert.ok(agendaObjetivo);

  const diasAtencion = Object.entries(agendaObjetivo.horario.dias)
    .filter(([, configuracion]) => configuracion.atiende)
    .map(([dia]) => dia);
  fechaObjetivo = obtenerFechaFutura(diasAtencion);
  localidadObjetivo = agendaObjetivo.centroDeAtencionId.direccionId.localidad;

  await new Promise((resolver, rechazar) => {
    servidor = aplicacion.listen(0, '127.0.0.1', resolver);
    servidor.once('error', rechazar);
  });
  urlBase = `http://127.0.0.1:${servidor.address().port}`;

  const acceso = await solicitar('/autenticacion/iniciar-sesion', {
    metodo: 'POST',
    cuerpo: {
      identificador: '10000001',
      contrasena: 'Demo1234',
      rol: 'AFILIADO',
    },
  });
  assert.equal(acceso.estado, 200);
  tokenAfiliado = acceso.datos.token;
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

test('MedIntegral - búsqueda avanzada de turnos del afiliado', async (t) => {
  const prestadorId = String(agendaObjetivo.prestadorId);
  const especialidadId = String(agendaObjetivo.especialidadId);

  await t.test('filtra disponibilidad por médico', async () => {
    const respuesta = await solicitar(
      `/portal-afiliado/disponibilidad?fecha=${fechaObjetivo}&prestadorId=${prestadorId}`,
      { token: tokenAfiliado }
    );
    assert.equal(respuesta.estado, 200);
    assert.ok(respuesta.datos.length > 0);
    assert.ok(
      respuesta.datos.every(
        (horario) => String(horario.prestador?._id) === prestadorId
      )
    );
  });

  await t.test('filtra disponibilidad por especialidad', async () => {
    const respuesta = await solicitar(
      `/portal-afiliado/disponibilidad?fecha=${fechaObjetivo}&especialidadId=${especialidadId}`,
      { token: tokenAfiliado }
    );
    assert.equal(respuesta.estado, 200);
    assert.ok(respuesta.datos.length > 0);
    assert.ok(
      respuesta.datos.every(
        (horario) => String(horario.especialidad?._id) === especialidadId
      )
    );
  });

  await t.test('filtra disponibilidad por localidad', async () => {
    const respuesta = await solicitar(
      `/portal-afiliado/disponibilidad?fecha=${fechaObjetivo}&prestadorId=${prestadorId}&localidad=${encodeURIComponent(
        localidadObjetivo
      )}`,
      { token: tokenAfiliado }
    );
    assert.equal(respuesta.estado, 200);
    assert.ok(respuesta.datos.length > 0);
    assert.ok(
      respuesta.datos.every(
        (horario) =>
          horario.centro?.direccionId?.localidad === localidadObjetivo
      )
    );

    const sinCoincidencias = await solicitar(
      `/portal-afiliado/disponibilidad?fecha=${fechaObjetivo}&localidad=LocalidadInexistente`,
      { token: tokenAfiliado }
    );
    assert.equal(sinCoincidencias.estado, 200);
    assert.deepEqual(sinCoincidencias.datos, []);
  });

  await t.test('filtra por franja horaria y combina criterios', async () => {
    const respuestaBase = await solicitar(
      `/portal-afiliado/disponibilidad?fecha=${fechaObjetivo}&prestadorId=${prestadorId}`,
      { token: tokenAfiliado }
    );
    assert.equal(respuestaBase.estado, 200);
    assert.ok(respuestaBase.datos.length >= 2);

    const horaDesde = respuestaBase.datos[0].hora;
    const horaHasta = respuestaBase.datos[1].hora;
    const respuesta = await solicitar(
      `/portal-afiliado/disponibilidad?fecha=${fechaObjetivo}&prestadorId=${prestadorId}&especialidadId=${especialidadId}&localidad=${encodeURIComponent(
        localidadObjetivo
      )}&horaDesde=${horaDesde}&horaHasta=${horaHasta}`,
      { token: tokenAfiliado }
    );

    assert.equal(respuesta.estado, 200);
    assert.ok(respuesta.datos.length > 0);
    assert.ok(
      respuesta.datos.every(
        (horario) => horario.hora >= horaDesde && horario.hora <= horaHasta
      )
    );
  });

  await t.test('rechaza una franja horaria invertida', async () => {
    const respuesta = await solicitar(
      `/portal-afiliado/disponibilidad?fecha=${fechaObjetivo}&horaDesde=18:00&horaHasta=08:00`,
      { token: tokenAfiliado }
    );
    assert.equal(respuesta.estado, 400);
  });
});
