const { Agenda, Afiliado } = require('../models');
const Turno = require('../models/turno');
const ErrorAplicacion = require('../exceptions/appError');
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
const {
  generarCodigoReserva,
  generarTokenGestion,
  hashearTokenGestion,
  verificarTokenGestion,
} = require('../utils/credencialesTurno');
const {
  enviarCancelacionTurno,
  enviarConfirmacionTurno,
  enviarReagendamientoTurno,
} = require('./correoServicio');

const ANTICIPACION_MINIMA_MS = 24 * 60 * 60 * 1000;
const INTENTOS_CODIGO_UNICO = 12;
const HORIZONTE_REAGENDAMIENTO_DIAS = 42;
const LIMITE_HORARIOS_PREDETERMINADO = 30;
const LIMITE_HORARIOS_MAXIMO = 80;

const convertirAMinutos = (valor) => {
  if (typeof valor === 'number') return valor;
  const [horas, minutos] = String(valor || '').split(':').map(Number);
  return horas * 60 + minutos;
};

const convertirAHora = (minutosTotales) =>
  `${String(Math.floor(minutosTotales / 60)).padStart(2, '0')}:${String(
    minutosTotales % 60
  ).padStart(2, '0')}`;

const obtenerId = (valor) => valor?._id || valor;

const normalizarCodigoReserva = (codigo) =>
  String(codigo || '').trim().toUpperCase();

const validarHorarioAgenda = (agenda, valorFecha, hora) => {
  if (!esFechaValida(valorFecha)) {
    throw new ErrorAplicacion(
      'Fecha de turno inválida',
      400,
      'FECHA_TURNO_INVALIDA'
    );
  }

  const fechaHoraTurno = crearFechaHoraArgentina(valorFecha, hora);
  if (!fechaHoraTurno) {
    throw new ErrorAplicacion(
      'Hora de turno inválida',
      400,
      'HORA_TURNO_INVALIDA'
    );
  }

  const dia = agenda.horario?.dias?.[obtenerClaveDia(valorFecha)];
  if (!dia?.atiende) {
    throw new ErrorAplicacion(
      'La agenda no atiende ese día',
      409,
      'AGENDA_NO_ATIENDE_DIA'
    );
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
      409,
      'HORARIO_FUERA_DE_AGENDA'
    );
  }

  if (fechaHoraTurno <= new Date()) {
    throw new ErrorAplicacion(
      'No se pueden reservar turnos en el pasado',
      409,
      'TURNO_EN_PASADO'
    );
  }
};

const validarDisponibilidad = async ({ agendaId, fecha, hora, excluirTurnoId }) => {
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
    throw new ErrorAplicacion(
      'El horario seleccionado ya fue reservado',
      409,
      'HORARIO_YA_RESERVADO'
    );
  }
};

const generarCredencialesUnicas = async () => {
  for (let intento = 0; intento < INTENTOS_CODIGO_UNICO; intento += 1) {
    const codigoReserva = generarCodigoReserva();
    const codigoExistente = await Turno.exists({ codigoReserva });
    if (codigoExistente) continue;

    const tokenGestion = generarTokenGestion();
    return {
      codigoReserva,
      tokenGestion,
      tokenGestionHash: hashearTokenGestion(tokenGestion),
    };
  }

  throw new ErrorAplicacion(
    'No se pudieron generar credenciales únicas para el turno',
    503,
    'CREDENCIALES_TURNO_NO_DISPONIBLES'
  );
};

const cargarAgendaCompleta = (agendaId) =>
  Agenda.findById(agendaId)
    .populate('prestadorId', 'nombre')
    .populate('especialidadId', 'nombre')
    .populate({
      path: 'centroDeAtencionId',
      populate: { path: 'direccionId' },
    });

const construirNombreCentro = (centro) => {
  const direccion = centro?.direccionId;
  if (!direccion) return 'Centro de atención';

  const calleAltura = [direccion.calle, direccion.altura]
    .filter((valor) => valor !== undefined && valor !== null && valor !== '')
    .join(' ');

  return [calleAltura, direccion.localidad].filter(Boolean).join(', ');
};

const obtenerAfiliadoParaCorreo = async (turno) => {
  const afiliadoTurno = await Afiliado.findById(turno.afiliadoId).select(
    'nombre apellido emails'
  );
  if (!afiliadoTurno) return null;

  if (afiliadoTurno.emails?.[0]?.direccion) return afiliadoTurno;

  const reservadoPor = await Afiliado.findById(
    turno.reservadoPorAfiliadoId
  ).select('emails');
  const correoAlternativo = reservadoPor?.emails?.[0]?.direccion;
  if (!correoAlternativo) return afiliadoTurno;

  const afiliadoPlano = afiliadoTurno.toObject();
  afiliadoPlano.emails = [{ direccion: correoAlternativo }];
  return afiliadoPlano;
};

const construirContextoCorreo = async ({ turno, tokenGestion, agenda }) => {
  const afiliado = await obtenerAfiliadoParaCorreo(turno);
  const fechaTexto = formatearFechaPersistida(turno.fecha);

  return {
    turno: {
      codigoReserva: turno.codigoReserva,
      fechaTexto,
      hora: turno.hora,
    },
    tokenGestion,
    afiliado,
    prestador: agenda?.prestadorId || null,
    especialidad: agenda?.especialidadId || null,
    centro: {
      nombre: construirNombreCentro(agenda?.centroDeAtencionId),
    },
  };
};

const ejecutarNotificacion = async (enviar, contexto) => {
  try {
    return await enviar(contexto);
  } catch (error) {
    console.warn('No se pudo enviar la notificación del turno:', error.message);
    return { enviado: false, motivo: 'ERROR_ENVIO' };
  }
};

const crearTurno = async ({
  agendaId,
  afiliadoId,
  reservadoPorAfiliadoId,
  fecha,
  hora,
  actorTipo = 'AFILIADO',
  actorId = null,
}) => {
  const agenda = await cargarAgendaCompleta(agendaId);
  if (!agenda) {
    throw new ErrorAplicacion(
      'Agenda no encontrada',
      404,
      'AGENDA_NO_ENCONTRADA'
    );
  }

  const afiliado = await Afiliado.exists({ _id: afiliadoId });
  if (!afiliado) {
    throw new ErrorAplicacion(
      'Afiliado no encontrado',
      404,
      'AFILIADO_NO_ENCONTRADO'
    );
  }

  const fechaTexto = String(fecha || '').slice(0, 10);
  const horaTexto = String(hora || '');
  validarHorarioAgenda(agenda, fechaTexto, horaTexto);
  await validarDisponibilidad({
    agendaId: agenda._id,
    fecha: fechaTexto,
    hora: horaTexto,
  });

  const credenciales = await generarCredencialesUnicas();
  const fechaPersistida = crearFechaPersistencia(fechaTexto);
  const ahora = new Date();

  const turno = await Turno.create({
    agendaId: agenda._id,
    prestadorId: obtenerId(agenda.prestadorId),
    afiliadoId,
    reservadoPorAfiliadoId,
    fecha: fechaPersistida,
    hora: horaTexto,
    codigoReserva: credenciales.codigoReserva,
    tokenGestionHash: credenciales.tokenGestionHash,
    tokenGestionGeneradoEn: ahora,
    historial: [
      {
        accion: 'CREADO',
        fecha: ahora,
        actorTipo,
        actorId,
        fechaNueva: fechaPersistida,
        horaNueva: horaTexto,
      },
    ],
  });

  const contextoCorreo = await construirContextoCorreo({
    turno,
    tokenGestion: credenciales.tokenGestion,
    agenda,
  });
  const notificacion = await ejecutarNotificacion(
    enviarConfirmacionTurno,
    contextoCorreo
  );

  return {
    turno,
    credenciales: {
      codigoReserva: credenciales.codigoReserva,
      tokenGestion: credenciales.tokenGestion,
    },
    notificacion,
  };
};

const buscarTurnoConCredenciales = async ({ codigoReserva, tokenGestion }) => {
  const codigo = normalizarCodigoReserva(codigoReserva);
  const turno = await Turno.findOne({ codigoReserva: codigo })
    .select('+tokenGestionHash')
    .populate('prestadorId', 'nombre')
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

  if (!turno || !verificarTokenGestion(tokenGestion, turno.tokenGestionHash)) {
    throw new ErrorAplicacion(
      'Turno no encontrado o enlace de gestión inválido',
      404,
      'CREDENCIALES_TURNO_INVALIDAS'
    );
  }

  return turno;
};

const validarTurnoGestionable = (turno, accion) => {
  if (turno.estado !== 'RESERVADO') {
    throw new ErrorAplicacion(
      'El turno ya no se encuentra reservado',
      409,
      'TURNO_NO_GESTIONABLE'
    );
  }

  const fechaTexto = formatearFechaPersistida(turno.fecha);
  const fechaHoraTurno = crearFechaHoraArgentina(fechaTexto, turno.hora);
  if (!fechaHoraTurno) {
    throw new ErrorAplicacion(
      'El turno posee una fecha u hora inválida',
      409,
      'TURNO_FECHA_HORA_INVALIDA'
    );
  }

  if (fechaHoraTurno.getTime() - Date.now() < ANTICIPACION_MINIMA_MS) {
    throw new ErrorAplicacion(
      `El turno solo puede ${accion}se hasta un día antes`,
      409,
      'ANTICIPACION_TURNO_INSUFICIENTE'
    );
  }
};

const cancelarTurnoDocumento = async ({
  turno,
  actorTipo,
  actorId = null,
  tokenGestion = null,
  motivo = null,
}) => {
  validarTurnoGestionable(turno, 'cancelar');
  turno.estado = 'CANCELADO';
  turno.historial.push({
    accion: 'CANCELADO',
    actorTipo,
    actorId,
    motivo,
  });
  await turno.save();

  const agenda = await cargarAgendaCompleta(obtenerId(turno.agendaId));
  const contextoCorreo = await construirContextoCorreo({
    turno,
    tokenGestion,
    agenda,
  });
  const notificacion = await ejecutarNotificacion(
    enviarCancelacionTurno,
    contextoCorreo
  );

  return { turno, notificacion };
};

const cancelarTurnoPublico = async ({ codigoReserva, tokenGestion }) => {
  const turno = await buscarTurnoConCredenciales({
    codigoReserva,
    tokenGestion,
  });
  return cancelarTurnoDocumento({
    turno,
    actorTipo: 'PUBLICO',
    tokenGestion,
    motivo: 'Cancelación mediante enlace seguro',
  });
};

const cancelarTurnoAutenticado = async ({
  turnoId,
  afiliadosGestionables,
  actorId,
}) => {
  const turno = await Turno.findOne({
    _id: turnoId,
    afiliadoId: { $in: afiliadosGestionables },
    estado: 'RESERVADO',
  });

  if (!turno) {
    throw new ErrorAplicacion(
      'Turno no encontrado',
      404,
      'TURNO_NO_ENCONTRADO'
    );
  }

  return cancelarTurnoDocumento({
    turno,
    actorTipo: 'AFILIADO',
    actorId,
    motivo: 'Cancelación desde el portal del afiliado',
  });
};

const obtenerDisponibilidadReagendamientoPublica = async ({
  codigoReserva,
  tokenGestion,
  limite = LIMITE_HORARIOS_PREDETERMINADO,
}) => {
  const turno = await buscarTurnoConCredenciales({
    codigoReserva,
    tokenGestion,
  });
  validarTurnoGestionable(turno, 'reagendar');

  const agenda = turno.agendaId;
  if (!agenda?.horario) {
    throw new ErrorAplicacion(
      'Agenda no encontrada',
      404,
      'AGENDA_NO_ENCONTRADA'
    );
  }

  const limiteNumerico = Number(limite);
  const cantidadMaxima = Number.isInteger(limiteNumerico) && limiteNumerico > 0
    ? Math.min(limiteNumerico, LIMITE_HORARIOS_MAXIMO)
    : LIMITE_HORARIOS_PREDETERMINADO;

  const hoy = obtenerFechaActualArgentina();
  const fechas = [];
  for (
    let desplazamiento = 0;
    desplazamiento <= HORIZONTE_REAGENDAMIENTO_DIAS;
    desplazamiento += 1
  ) {
    fechas.push(sumarDias(hoy, desplazamiento));
  }

  const primerRango = obtenerRangoDiaUtc(fechas[0]);
  const ultimoRango = obtenerRangoDiaUtc(fechas[fechas.length - 1]);
  const agendaId = obtenerId(agenda);
  const ocupados = await Turno.find({
    agendaId,
    fecha: { $gte: primerRango.inicio, $lt: ultimoRango.fin },
    estado: 'RESERVADO',
  }).select('fecha hora');
  const clavesOcupadas = new Set(
    ocupados.map(
      (ocupado) => `${formatearFechaPersistida(ocupado.fecha)}:${ocupado.hora}`
    )
  );

  const ahora = new Date();
  const horarios = [];
  for (const fechaTexto of fechas) {
    const dia = agenda.horario?.dias?.[obtenerClaveDia(fechaTexto)];
    if (!dia?.atiende) continue;

    const duracionTurno = Number(agenda.horario?.duracionTurno || 30);
    for (const bloque of dia.bloques || []) {
      const inicio = convertirAMinutos(bloque.horaInicio);
      const fin = convertirAMinutos(bloque.horaFin);

      for (
        let cursor = inicio;
        cursor + duracionTurno <= fin;
        cursor += duracionTurno
      ) {
        const hora = convertirAHora(cursor);
        const fechaHora = crearFechaHoraArgentina(fechaTexto, hora);
        if (!fechaHora || fechaHora <= ahora) continue;
        if (clavesOcupadas.has(`${fechaTexto}:${hora}`)) continue;

        horarios.push({ fecha: fechaTexto, hora });
        if (horarios.length >= cantidadMaxima) return horarios;
      }
    }
  }

  return horarios;
};

const reagendarTurnoPublico = async ({
  codigoReserva,
  tokenGestion,
  fecha,
  hora,
}) => {
  const turno = await buscarTurnoConCredenciales({
    codigoReserva,
    tokenGestion,
  });
  validarTurnoGestionable(turno, 'reagendar');

  const agenda = await cargarAgendaCompleta(obtenerId(turno.agendaId));
  if (!agenda) {
    throw new ErrorAplicacion(
      'Agenda no encontrada',
      404,
      'AGENDA_NO_ENCONTRADA'
    );
  }

  const fechaTexto = String(fecha || '').slice(0, 10);
  const horaTexto = String(hora || '');
  validarHorarioAgenda(agenda, fechaTexto, horaTexto);

  const fechaAnteriorTexto = formatearFechaPersistida(turno.fecha);
  if (fechaTexto === fechaAnteriorTexto && horaTexto === turno.hora) {
    throw new ErrorAplicacion(
      'El nuevo horario debe ser diferente al actual',
      409,
      'MISMO_HORARIO_TURNO'
    );
  }

  await validarDisponibilidad({
    agendaId: agenda._id,
    fecha: fechaTexto,
    hora: horaTexto,
    excluirTurnoId: turno._id,
  });

  const fechaAnterior = turno.fecha;
  const horaAnterior = turno.hora;
  turno.fecha = crearFechaPersistencia(fechaTexto);
  turno.hora = horaTexto;
  turno.historial.push({
    accion: 'REAGENDADO',
    actorTipo: 'PUBLICO',
    fechaAnterior,
    horaAnterior,
    fechaNueva: turno.fecha,
    horaNueva: turno.hora,
    motivo: 'Reagendamiento mediante enlace seguro',
  });
  await turno.save();

  const contextoCorreo = await construirContextoCorreo({
    turno,
    tokenGestion,
    agenda,
  });
  const notificacion = await ejecutarNotificacion(
    enviarReagendamientoTurno,
    contextoCorreo
  );

  return { turno, notificacion };
};

const serializarTurnoPublico = (turno) => {
  const agenda = turno.agendaId;
  const direccion = agenda?.centroDeAtencionId?.direccionId;
  const fechaTexto = formatearFechaPersistida(turno.fecha);
  const fechaHora = crearFechaHoraArgentina(fechaTexto, turno.hora);

  return {
    codigoReserva: turno.codigoReserva,
    estado: turno.estado,
    fecha: fechaTexto,
    hora: turno.hora,
    prestador: turno.prestadorId?.nombre || null,
    especialidad: agenda?.especialidadId?.nombre || null,
    centro: direccion
      ? {
          calle: direccion.calle,
          altura: direccion.altura,
          localidad: direccion.localidad,
          provincia: direccion.provincia,
        }
      : null,
    puedeGestionarse:
      turno.estado === 'RESERVADO' &&
      Boolean(
        fechaHora &&
          fechaHora.getTime() - Date.now() >= ANTICIPACION_MINIMA_MS
      ),
  };
};

module.exports = {
  buscarTurnoConCredenciales,
  cancelarTurnoAutenticado,
  cancelarTurnoPublico,
  crearTurno,
  obtenerDisponibilidadReagendamientoPublica,
  reagendarTurnoPublico,
  serializarTurnoPublico,
  validarHorarioAgenda,
};
