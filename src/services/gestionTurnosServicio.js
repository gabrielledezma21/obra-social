const { Agenda } = require('../models');
const Turno = require('../models/turno');
const ErrorAplicacion = require('../exceptions/appError');
const {
  crearEntradaHistorial,
  normalizarCodigoReserva,
  tokenGestionCoincide,
} = require('./turnosServicio');
const {
  crearFechaHoraArgentina,
  crearFechaPersistencia,
  esFechaValida,
  formatearFechaPersistida,
  obtenerClaveDia,
  obtenerFechaActualArgentina,
  obtenerRangoDiaUtc,
  sumarDias,
} = require('../utils/fechaTurnos');

const ANTICIPACION_MINIMA_MS = 24 * 60 * 60 * 1000;
const HORIZONTE_DISPONIBILIDAD_DIAS = 42;
const LIMITE_DISPONIBILIDAD_PUBLICA = 20;

const convertirAMinutos = (valor) => {
  const [horas, minutos] = String(valor || '').split(':').map(Number);
  return horas * 60 + minutos;
};

const convertirAHora = (minutosTotales) =>
  `${String(Math.floor(minutosTotales / 60)).padStart(2, '0')}:${String(
    minutosTotales % 60
  ).padStart(2, '0')}`;

const validarTurnoGestionable = (turno) => {
  if (!turno) throw new ErrorAplicacion('Turno no encontrado', 404);
  if (turno.estado !== 'RESERVADO') {
    throw new ErrorAplicacion('El turno ya no se encuentra reservado', 409);
  }

  const fechaTexto = formatearFechaPersistida(turno.fecha);
  const fechaHoraTurno = crearFechaHoraArgentina(fechaTexto, turno.hora);
  if (!fechaHoraTurno) {
    throw new ErrorAplicacion('El turno posee una fecha u hora inválida', 409);
  }

  if (fechaHoraTurno.getTime() - Date.now() < ANTICIPACION_MINIMA_MS) {
    throw new ErrorAplicacion(
      'El turno solo puede modificarse o cancelarse hasta un día antes',
      409
    );
  }
};

const validarHorarioAgenda = (agenda, valorFecha, hora) => {
  if (!esFechaValida(valorFecha)) {
    throw new ErrorAplicacion('Fecha de turno inválida', 400);
  }

  const fechaHoraTurno = crearFechaHoraArgentina(valorFecha, hora);
  if (!fechaHoraTurno) {
    throw new ErrorAplicacion('Hora de turno inválida', 400);
  }

  const dia = agenda.horario?.dias?.[obtenerClaveDia(valorFecha)];
  if (!dia?.atiende) {
    throw new ErrorAplicacion('La agenda no atiende ese día', 409);
  }

  const minutosSeleccionados = convertirAMinutos(hora);
  const duracionTurno = Number(agenda.horario?.duracionTurno || 30);
  const horarioValido = (dia.bloques || []).some((bloque) => {
    const inicio = convertirAMinutos(bloque.horaInicio);
    const fin = convertirAMinutos(bloque.horaFin);

    return (
      minutosSeleccionados >= inicio &&
      minutosSeleccionados + duracionTurno <= fin &&
      (minutosSeleccionados - inicio) % duracionTurno === 0
    );
  });

  if (!horarioValido) {
    throw new ErrorAplicacion(
      'El horario seleccionado no pertenece a la agenda',
      409
    );
  }

  if (fechaHoraTurno <= new Date()) {
    throw new ErrorAplicacion(
      'No se pueden reservar turnos en el pasado',
      409
    );
  }
};

const asegurarHorarioLibre = async ({ agendaId, fecha, hora, excluirTurnoId }) => {
  const rangoDia = obtenerRangoDiaUtc(fecha);
  const filtro = {
    agendaId,
    fecha: { $gte: rangoDia.inicio, $lt: rangoDia.fin },
    hora,
    estado: 'RESERVADO',
  };

  if (excluirTurnoId) filtro._id = { $ne: excluirTurnoId };
  const ocupado = await Turno.exists(filtro);
  if (ocupado) {
    throw new ErrorAplicacion('El horario seleccionado ya fue reservado', 409);
  }
};

const reagendarTurno = async ({
  turno,
  agendaId,
  fecha,
  hora,
  actorRol,
  actorId = null,
  motivo = '',
}) => {
  validarTurnoGestionable(turno);

  const fechaTexto = String(fecha || '').slice(0, 10);
  const horaTexto = String(hora || '');
  const agenda = await Agenda.findById(agendaId);
  if (!agenda) throw new ErrorAplicacion('Agenda no encontrada', 404);

  validarHorarioAgenda(agenda, fechaTexto, horaTexto);
  await asegurarHorarioLibre({
    agendaId: agenda._id,
    fecha: fechaTexto,
    hora: horaTexto,
    excluirTurnoId: turno._id,
  });

  const fechaAnterior = turno.fecha;
  const horaAnterior = turno.hora;
  const mismaAgenda = String(turno.agendaId) === String(agenda._id);
  const mismaFecha = formatearFechaPersistida(turno.fecha) === fechaTexto;
  if (mismaAgenda && mismaFecha && turno.hora === horaTexto) {
    throw new ErrorAplicacion('El nuevo turno coincide con el actual', 409);
  }

  turno.historial.push(
    crearEntradaHistorial({
      accion: 'REAGENDADO',
      actorRol,
      actorId,
      fechaAnterior,
      horaAnterior,
      fechaNueva: crearFechaPersistencia(fechaTexto),
      horaNueva: horaTexto,
      motivo,
    })
  );
  turno.agendaId = agenda._id;
  turno.prestadorId = agenda.prestadorId;
  turno.fecha = crearFechaPersistencia(fechaTexto);
  turno.hora = horaTexto;
  turno.$locals.actorRol = actorRol;
  turno.$locals.actorId = actorId;
  await turno.save();

  return turno;
};

const cancelarTurno = async ({
  turno,
  actorRol,
  actorId = null,
  motivo = '',
}) => {
  validarTurnoGestionable(turno);
  turno.$locals.actorRol = actorRol;
  turno.$locals.actorId = actorId;
  turno.$locals.motivo = motivo;
  turno.estado = 'CANCELADO';
  await turno.save();
  return turno;
};

const obtenerTurnoPorCredenciales = async (codigoReserva, tokenGestion) => {
  const codigo = normalizarCodigoReserva(codigoReserva);
  if (!/^MED-[A-HJ-NP-Z2-9]{6}$/.test(codigo) || !tokenGestion) {
    throw new ErrorAplicacion('Credenciales de gestión inválidas', 401);
  }

  const turno = await Turno.findOne({ codigoReserva: codigo })
    .select('+tokenGestionHash')
    .populate('prestadorId', 'nombre')
    .populate('afiliadoId', 'nombre apellido numeroAfiliado numeroIntegrante')
    .populate({
      path: 'agendaId',
      populate: [
        { path: 'especialidadId', select: 'nombre' },
        {
          path: 'centroDeAtencionId',
          populate: { path: 'direccionId' },
        },
      ],
    });

  if (!turno || !tokenGestionCoincide(tokenGestion, turno.tokenGestionHash)) {
    throw new ErrorAplicacion('Credenciales de gestión inválidas', 401);
  }

  return turno;
};

const serializarTurnoGestion = (turno) => ({
  id: turno._id,
  codigoReserva: turno.codigoReserva,
  estado: turno.estado,
  fecha: formatearFechaPersistida(turno.fecha),
  hora: turno.hora,
  prestador: turno.prestadorId
    ? { id: turno.prestadorId._id, nombre: turno.prestadorId.nombre }
    : null,
  afiliado: turno.afiliadoId
    ? {
        id: turno.afiliadoId._id,
        nombre: turno.afiliadoId.nombre,
        apellido: turno.afiliadoId.apellido,
        numeroAfiliado: turno.afiliadoId.numeroAfiliado,
        numeroIntegrante: turno.afiliadoId.numeroIntegrante,
      }
    : null,
  agenda: turno.agendaId
    ? {
        id: turno.agendaId._id,
        especialidad: turno.agendaId.especialidadId || null,
        centro: turno.agendaId.centroDeAtencionId || null,
      }
    : null,
  historial: turno.historial || [],
});

const obtenerDisponibilidadMismaAgenda = async (turno, limiteSolicitado) => {
  validarTurnoGestionable(turno);
  const agendaId = turno.agendaId?._id || turno.agendaId;
  const agenda = await Agenda.findById(agendaId);
  if (!agenda) throw new ErrorAplicacion('Agenda no encontrada', 404);

  const limite = Math.min(
    Math.max(Number(limiteSolicitado) || LIMITE_DISPONIBILIDAD_PUBLICA, 1),
    LIMITE_DISPONIBILIDAD_PUBLICA
  );
  const hoy = obtenerFechaActualArgentina();
  const ahora = new Date();
  const resultados = [];

  for (
    let desplazamiento = 0;
    desplazamiento <= HORIZONTE_DISPONIBILIDAD_DIAS && resultados.length < limite;
    desplazamiento += 1
  ) {
    const fecha = sumarDias(hoy, desplazamiento);
    const dia = agenda.horario?.dias?.[obtenerClaveDia(fecha)];
    if (!dia?.atiende) continue;

    const duracionTurno = Number(agenda.horario?.duracionTurno || 30);
    const rangoDia = obtenerRangoDiaUtc(fecha);
    const ocupados = await Turno.find({
      _id: { $ne: turno._id },
      agendaId: agenda._id,
      fecha: { $gte: rangoDia.inicio, $lt: rangoDia.fin },
      estado: 'RESERVADO',
    }).select('hora');
    const horasOcupadas = new Set(ocupados.map((ocupado) => ocupado.hora));

    for (const bloque of dia.bloques || []) {
      const desde = convertirAMinutos(bloque.horaInicio);
      const hasta = convertirAMinutos(bloque.horaFin);

      for (
        let cursor = desde;
        cursor + duracionTurno <= hasta && resultados.length < limite;
        cursor += duracionTurno
      ) {
        const hora = convertirAHora(cursor);
        const fechaHora = crearFechaHoraArgentina(fecha, hora);
        if (!fechaHora || fechaHora <= ahora || horasOcupadas.has(hora)) continue;

        const mismaFecha = formatearFechaPersistida(turno.fecha) === fecha;
        if (mismaFecha && turno.hora === hora) continue;
        resultados.push({ agendaId: String(agenda._id), fecha, hora });
      }
    }
  }

  return resultados;
};

module.exports = {
  ANTICIPACION_MINIMA_MS,
  cancelarTurno,
  obtenerDisponibilidadMismaAgenda,
  obtenerTurnoPorCredenciales,
  reagendarTurno,
  serializarTurnoGestion,
  validarHorarioAgenda,
  validarTurnoGestionable,
};
