const { Router } = require('express');
const { Agenda } = require('../models');
const Turno = require('../models/turno');
const ErrorAplicacion = require('../exceptions/appError');
const {
  CLAVES_DIAS,
  crearFechaHoraArgentina,
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

  for (let desplazamiento = 0; desplazamiento <= HORIZONTE_BUSQUEDA_DIAS; desplazamiento += 1) {
    const fecha = sumarDias(hoy, desplazamiento);
    if (!diaSemana || obtenerClaveDia(fecha) === diaSemana) fechas.push(fecha);
  }

  return fechas;
};

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

module.exports = rutas;
