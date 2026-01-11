const { Prestador } = require("../models");
const { redisClient } = require("../config/redisClient");
const { getModelsCache, getModelCacheById, deleteModelsCache, deleteModelCacheById } = require("./genericController");
const prestadorService = require("../services/prestadorService");

const getPrestadores = async (_, res) => {

  const cached = await getModelsCache(Prestador);

  const prestadores = cached ? JSON.parse(cached) : await Prestador.find()
    .populate('especialidades')
    .populate({
      path: 'centrosDeAtencion',
      populate: [
        { path: 'direccionId', select: 'calle altura localidad provincia' }, //puedo optar por mostrar solo lo que quiero
        { path: 'horarioId' }
      ]
    });

  await redisClient.set('Prestadors:todos', JSON.stringify(prestadores), { EX: 60 });

  res.status(200).json(prestadores);
}

const getPrestadorById = async (req, res) => {

  const cached = await getModelCacheById(Prestador, req.params.id);

  const prestador = cached ? JSON.parse(cached) : await Prestador.findById(req.params.id)
    .populate('especialidades')
    .populate({
      path: 'centrosDeAtencion',
      populate: [
        { path: 'direccionId' },
        { path: 'horarioId' }
      ]
    }
    );

  await redisClient.set(`Prestador:${req.params.id}`, JSON.stringify(prestador), { EX: 60 })

  res.status(200).json(prestador);
}

const createPrestador = async (req, res) => {

  const prestador = await prestadorService.createPrestador(req.body);

  await redisClient.set(`Prestador:${prestador._id}`, JSON.stringify(prestador), { EX: 60 });
  await deleteModelsCache(Prestador);

  res.status(201).json(prestador);
}

const deletePrestador = async (req, res) => {

  await Prestador.findByIdAndDelete(req.params.id);

  await deleteModelsCache(Prestador);
  await deleteModelCacheById(Prestador, req.params.id);

  res.status(204).json({});
}

const updatePrestador = async (req, res) => {

  const prestador = await prestadorService.updatePrestador(req.params.id, req.body);

  await deleteModelCacheById(Prestador, req.params.id);
  await deleteModelsCache(Prestador);
  await redisClient.set(`Prestador:${prestador._id}`, JSON.stringify(prestador), { EX: 60 });

  res.status(200).json(prestador);
}

  

module.exports = { getPrestadores, getPrestadorById, createPrestador, deletePrestador, updatePrestador };