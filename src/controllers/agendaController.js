const { Agenda, Prestador, Especialidad } = require("../models");
const { redisClient } = require("../config/redisClient");
const { getModelsCache, getModelCacheById, deleteModelsCache, deleteModelCacheById } = require("./genericController");
const agendaService = require("../services/agendaService");

const populateAgenda = (query) => query
  .populate('especialidadId')
  .populate('prestadorId')
  .populate({
    path: 'centroDeAtencionId',
    populate: [{ path: 'direccionId' }, { path: 'horarioId' }]
  });

const getAgendas = async (_, res) => {

  const cached = await getModelsCache(Agenda);

  const agendas = cached ? JSON.parse(cached) : await Agenda.find()
    .populate('especialidadId')
    .populate('prestadorId')
    .populate({
      path: 'centroDeAtencionId',
      populate: [
        { path: 'direccionId', select: 'calle altura localidad provincia' }, //puedo optar por mostrar solo lo que quiero
        { path: 'horarioId' }
      ]
    }
    );

  await redisClient.set('Agendas:todos', JSON.stringify(agendas), { EX: 60 });

  res.status(200).json(agendas);
}

const getAgendaById = async (req, res) => {

  const cached = await getModelCacheById(Agenda, req.params.id);

  const agenda = cached ? JSON.parse(cached) : await Agenda.findById(req.params.id)
    .populate('especialidadId')
    .populate('prestadorId')
    .populate({
      path: 'centroDeAtencionId',
      populate: [
        { path: 'direccionId' },
        { path: 'horarioId' }
      ]
    }
    );

  await redisClient.set(`Agenda:${req.params.id}`, JSON.stringify(agenda), { EX: 60 })

  res.status(200).json(agenda);
}

const createAgenda = async (req, res) => {

  const created = await agendaService.createAgenda(req.body);
  const agenda = await populateAgenda(Agenda.findById(created._id));

  await redisClient.set(`Agenda:${agenda._id}`, JSON.stringify(agenda), { EX: 60 });
  await Promise.all([
    deleteModelsCache(Agenda),
    deleteModelsCache(Prestador),
    deleteModelsCache(Especialidad),
    deleteModelCacheById(Prestador, created.prestadorId)
  ]);

  res.status(201).json(agenda);
}

const deleteAgenda = async (req, res) => {

  await Agenda.findByIdAndDelete(req.params.id);

  await Promise.all([
    deleteModelsCache(Agenda),
    deleteModelsCache(Prestador),
    deleteModelsCache(Especialidad),
    deleteModelCacheById(Agenda, req.params.id)
  ]);

  res.status(204).send();
}

const updateAgenda = async (req, res) => {

  const updated = await agendaService.updateAgenda(req.params.id, req.body);
  const agenda = await populateAgenda(Agenda.findById(updated._id));

  await Promise.all([
    deleteModelCacheById(Agenda, req.params.id),
    deleteModelsCache(Agenda),
    deleteModelsCache(Prestador),
    deleteModelsCache(Especialidad),
    deleteModelCacheById(Prestador, updated.prestadorId)
  ]);
  await redisClient.set(`Agenda:${agenda._id}`, JSON.stringify(agenda), { EX: 60 });

  res.status(200).json(agenda);
}

  

module.exports = { getAgendas, getAgendaById, createAgenda, deleteAgenda, updateAgenda };