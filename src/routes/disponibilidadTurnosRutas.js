const { Router } = require('express');
const { Afiliado, Agenda, Prestador } = require('../models');
const Turno = require('../models/turno');
const ErrorAplicacion = require('../exceptions/appError');
const {
  CLAVES_DIAS,
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
  autenticar,
  requerirRol,
} = require('../middlewares/autenticacionMiddleware');

const rutas = Router();
rutas.use(autenticar, requerirRol('AFILIADO'));

const HORIZONTE_BUSQUEDA_DIAS = 42;
const LIMITE_RESULTADOS_PREDETERMINADO = 30;
const LIMITE_RESULTADOS_MAXIMO = 80;
const LIMITE_PRESTADORES = 10;

const convertirAMinutos = (valor) => {
  if (typeof valor === 'number') return valor;
  const [horas, minutos] = String(valor || '').split(':').map(Number);
  return horas * 60 + minutos;
};

const convertirAHora = (minutosTotales) =>
  `${String(Math.floor(minutosTotales / 60)).padStart(2, '0')}:${String(
    minutosTotales % 60
  ).padStart(2, '0')}`;

const normalizarTexto = (valor) =>
  String(valor || '')
    .trim()
    .toLocaleLowerCase('es');

const escaparExpresionRegular = (valor) =>
  String(valor || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const esMenorDeEdad = (fechaNacimiento) => {
  if (!fechaNacimiento) return false;

  const nacimiento = new Date(fechaNacimiento);
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const aunNoCumplio =
    hoy.getMonth() < nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() &&
      hoy.getDate() < nacimiento.getDate());

  if (aunNoCumplio) edad -= 1;
  return edad < 18;
};

const obtenerGrupoFamiliar = async (afiliadoActual) => {
  const titularId =
    afiliadoActual.parentesco === 'Titular'
      ? afiliadoActual._id
      : afiliadoActual.afiliadoTitularId;

  if (!titularId) return [afiliadoActual];

  return Afiliado.find({
    $or: [{ _id: titularId }, { afiliadoTitularId: titularId }],
  }).select('_id parentesco fechaNacimiento');
};

const obtenerIdsAfiliadosGestionables = async (usuario) => {
  const afiliadoActual = await Afiliado.findById(usuario.afiliadoId);
  if (!afiliadoActual) return [];

  if (
    afiliadoActual.parentesco === 'Titular' ||
    afiliadoActual.parentesco === 'Conyuge'
  ) {
    const grupoFamiliar = await obtenerGrupoFamiliar(afiliadoActual);
    return grupoFamiliar
      .filter(
        (integrante) =>
          integrante._id.equals(afiliadoActual._id) ||
          (integrante.parentesco === 'Hijo' &&
            esMenorDeEdad(integrante.fechaNacimiento))
      )
      .map((integrante) => integrante._id.toString());
  }

  return [afiliadoActual._id.toString()];
};

const obtenerLimiteHorario = (valor, nombre) => {
  if (!valor) return null;

  const minutos = convertirAMinutos(valor);
  if (
    !/^\d{2}:\d{2}$/.test(String(valor)) ||
    !Number.isFinite(minutos) ||
    minutos < 0 ||
    minutos > 1439
  ) {
    throw new ErrorAplicacion(`El ${nombre} debe tener formato HH:mm`, 400);
  }

  return minutos;
};

const obtenerLimiteResultados = (valor) => {
  if (!valor) return LIMITE_RESULTADOS_PREDETERMINADO;

  const limite = Number(valor);
  if (!Number.isInteger(limite) || limite < 1) {
    throw new ErrorAplicacion('El límite de resultados debe ser un entero positivo', 400);
  }

  return Math.min(limite, LIMITE_RESULTADOS_MAXIMO);
};

const construirFechasBusqueda = ({ fechaExacta, diaSemana }) => {
  if (fechaExacta) return [fechaExacta];

  const hoy = obtenerFechaActualArgentina();
  const fechas = [];

  for (
    let desplazamiento = 0;
    desplazamiento <= HORIZONTE_BUSQUEDA_DIAS;
    desplazamiento += 1
  ) {
    const fecha = sumarDias(hoy, desplazamiento);
    if (!diaSemana || obtenerClaveDia(fecha) === diaSemana) fechas.push(fecha);
  }

  return fechas;
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

rutas.get('/prestadores/buscar', async (peticion, respuesta, siguiente) => {
  try {
    const busqueda = String(peticion.query.busqueda || '').trim();
    if (busqueda.length < 2) return respuesta.json([]);

    const expresion = new RegExp(escaparExpresionRegular(busqueda), 'i');
    const prestadores = await Prestador.find({ nombre: expresion })
      .sort({ nombre: 1 })
      .limit(LIMITE_PRESTADORES)
      .populate('especialidades')
      .populate({ path: 'centrosDeAtencion', populate: 'direccionId' });

    respuesta.json(prestadores);
  } catch (error) {
    siguiente(error);
  }
});

rutas.get('/disponibilidad', async (peticion, respuesta, siguiente) => {
  try {
    const fechaExacta = String(peticion.query.fecha || '').trim();
    if (fechaExacta && !esFechaValida(fechaExacta)) {
      throw new ErrorAplicacion('La fecha indicada no es válida', 400);
    }

    const diaSemana = String(peticion.query.diaSemana || '').trim();
    if (diaSemana && !CLAVES_DIAS.includes(diaSemana)) {
      throw new ErrorAplicacion('El día de la semana indicado no es válido', 400);
    }

    const horaDesde = obtenerLimiteHorario(
      peticion.query.horaDesde,
      'horario desde'
    );
    const horaHasta = obtenerLimiteHorario(
      peticion.query.horaHasta,
      'horario hasta'
    );
    if (horaDesde !== null && horaHasta !== null && horaDesde > horaHasta) {
      throw new ErrorAplicacion(
        'El horario desde no puede ser posterior al horario hasta',
        400
      );
    }

    const limiteResultados = obtenerLimiteResultados(peticion.query.limite);
    const filtros = {};
    if (peticion.query.prestadorId) {
      filtros.prestadorId = peticion.query.prestadorId;
    }
    if (peticion.query.especialidadId) {
      filtros.especialidadId = peticion.query.especialidadId;
    }

    const agendas = await Agenda.find(filtros)
      .populate('prestadorId', 'nombre')
      .populate('especialidadId', 'nombre')
      .populate({
        path: 'centroDeAtencionId',
        populate: { path: 'direccionId' },
      });

    const localidadBuscada = normalizarTexto(peticion.query.localidad);
    const agendasFiltradas = localidadBuscada
      ? agendas.filter((agenda) =>
          normalizarTexto(
            agenda.centroDeAtencionId?.direccionId?.localidad
          ).includes(localidadBuscada)
        )
      : agendas;

    const fechasBusqueda = construirFechasBusqueda({ fechaExacta, diaSemana });
    if (agendasFiltradas.length === 0 || fechasBusqueda.length === 0) {
      return respuesta.json([]);
    }

    const primerRango = obtenerRangoDiaUtc(fechasBusqueda[0]);
    const ultimoRango = obtenerRangoDiaUtc(
      fechasBusqueda[fechasBusqueda.length - 1]
    );

    const turnosOcupados = await Turno.find({
      fecha: { $gte: primerRango.inicio, $lt: ultimoRango.fin },
      estado: 'RESERVADO',
    }).select('agendaId fecha hora');

    const clavesOcupadas = new Set(
      turnosOcupados.map(
        (turno) =>
          `${turno.agendaId}:${formatearFechaPersistida(turno.fecha)}:${turno.hora}`
      )
    );

    const ahora = new Date();
    const horariosDisponibles = [];

    for (const fecha of fechasBusqueda) {
      const claveDia = obtenerClaveDia(fecha);

      for (const agenda of agendasFiltradas) {
        const dia = agenda.horario?.dias?.[claveDia];
        if (!dia?.atiende) continue;

        const duracionTurno = Number(agenda.horario?.duracionTurno || 30);
        for (const bloque of dia.bloques || []) {
          const desde = convertirAMinutos(bloque.horaInicio);
          const hasta = convertirAMinutos(bloque.horaFin);

          for (
            let cursorMinutos = desde;
            cursorMinutos + duracionTurno <= hasta;
            cursorMinutos += duracionTurno
          ) {
            if (horaDesde !== null && cursorMinutos < horaDesde) continue;
            if (horaHasta !== null && cursorMinutos > horaHasta) continue;

            const hora = convertirAHora(cursorMinutos);
            const fechaHora = crearFechaHoraArgentina(fecha, hora);
            if (!fechaHora || fechaHora <= ahora) continue;

            const claveOcupada = `${agenda._id}:${fecha}:${hora}`;
            if (clavesOcupadas.has(claveOcupada)) continue;

            horariosDisponibles.push({
              agendaId: agenda._id,
              prestador: agenda.prestadorId,
              especialidad: agenda.especialidadId,
              centro: agenda.centroDeAtencionId,
              fecha,
              diaSemana: claveDia,
              hora,
              duracionTurno,
            });
          }
        }
      }
    }

    horariosDisponibles.sort((primero, segundo) => {
      const porFecha = primero.fecha.localeCompare(segundo.fecha);
      if (porFecha !== 0) return porFecha;

      const porHora = primero.hora.localeCompare(segundo.hora);
      if (porHora !== 0) return porHora;

      return String(primero.prestador?.nombre || '').localeCompare(
        String(segundo.prestador?.nombre || ''),
        'es'
      );
    });

    respuesta.json(horariosDisponibles.slice(0, limiteResultados));
  } catch (error) {
    siguiente(error);
  }
});

rutas.post('/turnos', async (peticion, respuesta, siguiente) => {
  try {
    const idsGestionables = await obtenerIdsAfiliadosGestionables(
      peticion.usuario
    );
    if (!idsGestionables.includes(String(peticion.body.afiliadoId))) {
      throw new ErrorAplicacion(
        'No podés reservar para ese integrante',
        403
      );
    }

    const agenda = await Agenda.findById(peticion.body.agendaId);
    if (!agenda) throw new ErrorAplicacion('Agenda no encontrada', 404);

    const fechaTexto = String(peticion.body.fecha || '').slice(0, 10);
    const hora = String(peticion.body.hora || '');
    validarHorarioAgenda(agenda, fechaTexto, hora);

    const rangoDia = obtenerRangoDiaUtc(fechaTexto);
    const turnoExistente = await Turno.findOne({
      agendaId: agenda._id,
      fecha: { $gte: rangoDia.inicio, $lt: rangoDia.fin },
      hora,
      estado: 'RESERVADO',
    });

    if (turnoExistente) {
      throw new ErrorAplicacion('El horario seleccionado ya fue reservado', 409);
    }

    const turno = await Turno.create({
      agendaId: agenda._id,
      prestadorId: agenda.prestadorId,
      afiliadoId: peticion.body.afiliadoId,
      reservadoPorAfiliadoId: peticion.usuario.afiliadoId,
      fecha: crearFechaPersistencia(fechaTexto),
      hora,
    });

    respuesta.status(201).json(turno);
  } catch (error) {
    siguiente(error);
  }
});

rutas.post('/turnos/:id/cancelar', async (peticion, respuesta, siguiente) => {
  try {
    const idsGestionables = await obtenerIdsAfiliadosGestionables(
      peticion.usuario
    );
    const turno = await Turno.findOne({
      _id: peticion.params.id,
      afiliadoId: { $in: idsGestionables },
      estado: 'RESERVADO',
    });

    if (!turno) throw new ErrorAplicacion('Turno no encontrado', 404);

    const fechaTexto = formatearFechaPersistida(turno.fecha);
    const fechaHoraTurno = crearFechaHoraArgentina(fechaTexto, turno.hora);
    if (!fechaHoraTurno) {
      throw new ErrorAplicacion('El turno posee una fecha u hora inválida', 409);
    }

    if (fechaHoraTurno.getTime() - Date.now() < 86400000) {
      throw new ErrorAplicacion(
        'El turno solo puede cancelarse hasta un día antes',
        409
      );
    }

    turno.estado = 'CANCELADO';
    await turno.save();
    respuesta.json(turno);
  } catch (error) {
    siguiente(error);
  }
});

module.exports = rutas;
