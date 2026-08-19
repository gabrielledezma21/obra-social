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
delete process.env.RESEND_API_KEY;
process.env.SEED_DEMO_DATA = 'false';
process.env.SECRETO_AUTENTICACION =
  process.env.SECRETO_AUTENTICACION_TEST || 'medintegral-secreto-pruebas';

const aplicacion = require('../src/app');
const { runSeed: ejecutarSeed } = require('../src/reiniciarDB');
const { mongoose } = require('../src/config/db');
const { Agenda, Prestador } = require('../src/models');
const Turno = require('../src/models/turno');
const {
  verificarTokenGestion,
} = require('../src/utils/credencialesTurno');

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
let afiliadoId;
let agendaObjetivo;
let fechaObjetivo;

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

  agendaObjetivo = await Agenda.findOne({ prestadorId: house._id });
  assert.ok(agendaObjetivo);

  const diasAtencion = Object.entries(agendaObjetivo.horario.dias)
    .filter(([, configuracion]) => configuracion.atiende)
    .map(([dia]) => dia);
  fechaObjetivo = obtenerFechaFutura(diasAtencion);

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

  const perfil = await solicitar('/portal-afiliado/mi-perfil', {
    token: tokenAfiliado,
  });
  assert.equal(perfil.estado, 200);
  afiliadoId = perfil.datos._id;
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

test('MedIntegral - reserva y autogestión segura de un turno', async () => {
  const disponibilidad = await solicitar(
    `/portal-afiliado/disponibilidad?fecha=${fechaObjetivo}&prestadorId=${agendaObjetivo.prestadorId}`,
    { token: tokenAfiliado }
  );
  assert.equal(disponibilidad.estado, 200);
  assert.ok(disponibilidad.datos.length > 0);

  const horarioInicial = disponibilidad.datos[0];
  const reserva = await solicitar('/portal-afiliado/turnos', {
    metodo: 'POST',
    token: tokenAfiliado,
    cuerpo: {
      afiliadoId,
      agendaId: horarioInicial.agendaId,
      fecha: horarioInicial.fecha,
      hora: horarioInicial.hora,
    },
  });

  assert.equal(reserva.estado, 201);
  assert.match(
    reserva.datos.codigoReserva,
    /^MED-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/
  );
  assert.match(reserva.datos.tokenGestion, /^[A-Za-z0-9_-]{43}$/);
  assert.equal('tokenGestionHash' in reserva.datos, false);
  assert.equal(reserva.datos.estado, 'RESERVADO');

  const turnoPersistido = await Turno.findOne({
    codigoReserva: reserva.datos.codigoReserva,
  }).select('+tokenGestionHash');
  assert.ok(turnoPersistido);
  assert.notEqual(turnoPersistido.tokenGestionHash, reserva.datos.tokenGestion);
  assert.equal(
    verificarTokenGestion(
      reserva.datos.tokenGestion,
      turnoPersistido.tokenGestionHash
    ),
    true
  );
  assert.equal(turnoPersistido.historial[0].accion, 'CREADO');

  const consultaInvalida = await solicitar('/publico/turnos/consultar', {
    metodo: 'POST',
    cuerpo: {
      codigoReserva: reserva.datos.codigoReserva,
      tokenGestion: 'token-incorrecto',
    },
  });
  assert.equal(consultaInvalida.estado, 404);
  assert.equal(consultaInvalida.datos.codigo, 'CREDENCIALES_TURNO_INVALIDAS');

  const consulta = await solicitar('/publico/turnos/consultar', {
    metodo: 'POST',
    cuerpo: {
      codigoReserva: reserva.datos.codigoReserva,
      tokenGestion: reserva.datos.tokenGestion,
    },
  });
  assert.equal(consulta.estado, 200);
  assert.equal(consulta.datos.turno.codigoReserva, reserva.datos.codigoReserva);
  assert.equal(consulta.datos.turno.estado, 'RESERVADO');
  assert.equal('_id' in consulta.datos.turno, false);
  assert.equal('tokenGestionHash' in consulta.datos.turno, false);

  const alternativas = await solicitar('/publico/turnos/disponibilidad', {
    metodo: 'POST',
    cuerpo: {
      codigoReserva: reserva.datos.codigoReserva,
      tokenGestion: reserva.datos.tokenGestion,
      limite: 10,
    },
  });
  assert.equal(alternativas.estado, 200);
  assert.ok(alternativas.datos.horarios.length > 0);

  const nuevoHorario = alternativas.datos.horarios[0];
  const reagendado = await solicitar('/publico/turnos/reagendar', {
    metodo: 'POST',
    cuerpo: {
      codigoReserva: reserva.datos.codigoReserva,
      tokenGestion: reserva.datos.tokenGestion,
      fecha: nuevoHorario.fecha,
      hora: nuevoHorario.hora,
    },
  });
  assert.equal(reagendado.estado, 200);
  assert.equal(reagendado.datos.turno.fecha, nuevoHorario.fecha);
  assert.equal(reagendado.datos.turno.hora, nuevoHorario.hora);

  const luegoDeReagendar = await Turno.findOne({
    codigoReserva: reserva.datos.codigoReserva,
  });
  assert.equal(
    luegoDeReagendar.historial.some((evento) => evento.accion === 'REAGENDADO'),
    true
  );

  const cancelado = await solicitar('/publico/turnos/cancelar', {
    metodo: 'POST',
    cuerpo: {
      codigoReserva: reserva.datos.codigoReserva,
      tokenGestion: reserva.datos.tokenGestion,
    },
  });
  assert.equal(cancelado.estado, 200);
  assert.equal(cancelado.datos.turno.estado, 'CANCELADO');

  const turnoCancelado = await Turno.findOne({
    codigoReserva: reserva.datos.codigoReserva,
  });
  assert.equal(
    turnoCancelado.historial.some((evento) => evento.accion === 'CANCELADO'),
    true
  );

  const segundaCancelacion = await solicitar('/publico/turnos/cancelar', {
    metodo: 'POST',
    cuerpo: {
      codigoReserva: reserva.datos.codigoReserva,
      tokenGestion: reserva.datos.tokenGestion,
    },
  });
  assert.equal(segundaCancelacion.estado, 409);
  assert.equal(segundaCancelacion.datos.codigo, 'TURNO_NO_GESTIONABLE');
});
