const { Router } = require('express');
const { Agenda } = require('../models');
const Turno = require('../models/turno');
const ErrorAplicacion = require('../exceptions/appError');
const {
  autenticar,
  requerirRol,
} = require('../middlewares/autenticacionMiddleware');

const rutas = Router();
rutas.use(autenticar, requerirRol('AFILIADO'));

const CLAVES_DIAS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miercoles',
  'Jueves',
  'Viernes',
  'Sabado',
];

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
  if (!/^\d{2}:\d{2}$/.test(String(valor)) || !Number.isFinite(minutos) || minutos < 0 || minutos > 1439) {
    throw new ErrorAplicacion(`El ${nombre} debe tener formato HH:mm`, 400);
  }

  return minutos;
};

rutas.get('/disponibilidad', async (peticion, respuesta, siguiente) => {
  try {
    const fechaTexto = String(peticion.query.fecha || '').trim();
    const fecha = new Date(`${fechaTexto}T12:00:00`);
    if (!fechaTexto || Number.isNaN(fecha.getTime())) {
      throw new ErrorAplicacion('Debe indicar una fecha válida', 400);
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

    const claveDia = CLAVES_DIAS[fecha.getDay()];
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

    const inicioDia = new Date(fecha);
    inicioDia.setHours(0, 0, 0, 0);
    const finDia = new Date(inicioDia);
    finDia.setDate(finDia.getDate() + 1);

    const turnosOcupados = await Turno.find({
      fecha: { $gte: inicioDia, $lt: finDia },
      estado: 'RESERVADO',
    }).select('agendaId hora');
    const clavesOcupadas = new Set(
      turnosOcupados.map((turno) => `${turno.agendaId}:${turno.hora}`)
    );

    const ahora = new Date();
    const horariosDisponibles = [];
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
          const fechaHora = new Date(`${fechaTexto}T${hora}:00`);
          if (fechaHora <= ahora) continue;

          if (!clavesOcupadas.has(`${agenda._id}:${hora}`)) {
            horariosDisponibles.push({
              agendaId: agenda._id,
              prestador: agenda.prestadorId,
              especialidad: agenda.especialidadId,
              centro: agenda.centroDeAtencionId,
              fecha: fechaTexto,
              hora,
              duracionTurno,
            });
          }
        }
      }
    }

    horariosDisponibles.sort((primero, segundo) =>
      primero.hora.localeCompare(segundo.hora)
    );

    respuesta.json(horariosDisponibles);
  } catch (error) {
    siguiente(error);
  }
});

module.exports = rutas;
