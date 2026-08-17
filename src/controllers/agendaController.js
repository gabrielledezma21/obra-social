const { Agenda, Prestador, Especialidad } = require('../models');
const Turno = require('../models/turno');
const ErrorAplicacion = require('../exceptions/appError');
const { redisClient: clienteRedis } = require('../config/redisClient');
const {
  getModelsCache: obtenerCacheModelos,
  getModelCacheById: obtenerCacheModeloPorId,
  deleteModelsCache: eliminarCacheModelos,
  deleteModelCacheById: eliminarCacheModeloPorId,
} = require('./genericController');
const servicioAgenda = require('../services/agendaService');

const completarAgenda = (consulta) =>
  consulta
    .populate('especialidadId')
    .populate('prestadorId')
    .populate({
      path: 'centroDeAtencionId',
      populate: [{ path: 'direccionId' }, { path: 'horarioId' }],
    });

const getAgendas = async (_peticion, respuesta) => {
  const cache = await obtenerCacheModelos(Agenda);

  const agendas = cache
    ? JSON.parse(cache)
    : await Agenda.find()
        .populate('especialidadId')
        .populate('prestadorId')
        .populate({
          path: 'centroDeAtencionId',
          populate: [
            {
              path: 'direccionId',
              select: 'calle altura localidad provincia',
            },
            { path: 'horarioId' },
          ],
        });

  await clienteRedis.set('Agendas:todos', JSON.stringify(agendas), { EX: 60 });
  respuesta.status(200).json(agendas);
};

const getAgendaById = async (peticion, respuesta) => {
  const cache = await obtenerCacheModeloPorId(Agenda, peticion.params.id);

  const agenda = cache
    ? JSON.parse(cache)
    : await Agenda.findById(peticion.params.id)
        .populate('especialidadId')
        .populate('prestadorId')
        .populate({
          path: 'centroDeAtencionId',
          populate: [{ path: 'direccionId' }, { path: 'horarioId' }],
        });

  await clienteRedis.set(
    `Agenda:${peticion.params.id}`,
    JSON.stringify(agenda),
    { EX: 60 }
  );

  respuesta.status(200).json(agenda);
};

const createAgenda = async (peticion, respuesta) => {
  const creada = await servicioAgenda.createAgenda(peticion.body);
  const agenda = await completarAgenda(Agenda.findById(creada._id));

  await clienteRedis.set(`Agenda:${agenda._id}`, JSON.stringify(agenda), {
    EX: 60,
  });
  await Promise.all([
    eliminarCacheModelos(Agenda),
    eliminarCacheModelos(Prestador),
    eliminarCacheModelos(Especialidad),
    eliminarCacheModeloPorId(Prestador, creada.prestadorId),
  ]);

  respuesta.status(201).json(agenda);
};

const deleteAgenda = async (peticion, respuesta) => {
  const tieneTurnos = await Turno.exists({ agendaId: peticion.params.id });
  if (tieneTurnos) {
    throw new ErrorAplicacion(
      'No se puede eliminar una agenda que tiene turnos asociados',
      409,
      'AGENDA_CON_TURNOS'
    );
  }

  await Agenda.findByIdAndDelete(peticion.params.id);

  await Promise.all([
    eliminarCacheModelos(Agenda),
    eliminarCacheModelos(Prestador),
    eliminarCacheModelos(Especialidad),
    eliminarCacheModeloPorId(Agenda, peticion.params.id),
  ]);

  respuesta.status(204).send();
};

const updateAgenda = async (peticion, respuesta) => {
  const actualizada = await servicioAgenda.updateAgenda(
    peticion.params.id,
    peticion.body
  );
  const agenda = await completarAgenda(Agenda.findById(actualizada._id));

  await Promise.all([
    eliminarCacheModeloPorId(Agenda, peticion.params.id),
    eliminarCacheModelos(Agenda),
    eliminarCacheModelos(Prestador),
    eliminarCacheModelos(Especialidad),
    eliminarCacheModeloPorId(Prestador, actualizada.prestadorId),
  ]);
  await clienteRedis.set(`Agenda:${agenda._id}`, JSON.stringify(agenda), {
    EX: 60,
  });

  respuesta.status(200).json(agenda);
};

module.exports = {
  getAgendas,
  getAgendaById,
  createAgenda,
  deleteAgenda,
  updateAgenda,
};
