const { Router } = require('express');
const { Agenda } = require('../models');
const Turno = require('../models/turno');
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

rutas.get('/disponibilidad', async (peticion, respuesta, siguiente) => {
  try {
    const fecha = new Date(`${peticion.query.fecha}T12:00:00`);
    if (Number.isNaN(fecha.getTime())) {
      return respuesta
        .status(400)
        .json({ message: 'Debe indicar una fecha válida' });
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

    const horariosDisponibles = [];
    for (const agenda of agendas) {
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
          const hora = convertirAHora(cursorMinutos);
          if (!clavesOcupadas.has(`${agenda._id}:${hora}`)) {
            horariosDisponibles.push({
              agendaId: agenda._id,
              prestador: agenda.prestadorId,
              especialidad: agenda.especialidadId,
              centro: agenda.centroDeAtencionId,
              fecha: peticion.query.fecha,
              hora,
              duracionTurno,
            });
          }
        }
      }
    }

    respuesta.json(horariosDisponibles);
  } catch (error) {
    siguiente(error);
  }
});

module.exports = rutas;
