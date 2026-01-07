const { Agenda } = require("../models");
const { redisClient } = require("../config/redisClient");
const { getModelsCache, getModelCacheById, deleteModelsCache, deleteModelCacheById } = require("./genericController");
const agendaService = require("../services/agendaService");

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

  const agenda = await agendaService.createAgenda(req.body);

  await redisClient.set(`Agenda:${agenda._id}`, JSON.stringify(agenda), { EX: 60 });
  await deleteModelsCache(Agenda);

  res.status(201).json(agenda);
}

const deleteAgenda = async (req, res) => {

  await Agenda.findByIdAndDelete(req.params.id);

  await deleteModelsCache(Agenda);
  await deleteModelCacheById(Agenda, req.params.id);

  res.status(204).json({});
}

const updateAgenda = async (req, res) => {

  const agenda = await agendaService.updateAgenda(req.params.id, req.body);

  await deleteModelCacheById(Agenda, req.params.id);
  await deleteModelsCache(Agenda);
  await redisClient.set(`Agenda:${agenda._id}`, JSON.stringify(agenda), { EX: 60 });

  res.status(200).json(agenda);
}

  

module.exports = { getAgendas, getAgendaById, createAgenda, deleteAgenda, updateAgenda };