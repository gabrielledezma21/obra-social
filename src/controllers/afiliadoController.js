const { Afiliado } = require("../models");
const { redisClient } = require("../config/redisClient");
const { getModelsCache, getModelCacheById, deleteModelsCache, deleteModelCacheById } = require("./genericController");
const afiliadoService = require("../services/afiliadoService");

const getAfiliados = async (_, res) => {

  const cached = await getModelsCache(Afiliado);

  const afiliados = cached ? JSON.parse(cached) : await Afiliado.find()
    .populate('situacionesTerapeuticas')
    .populate('direccionId');

  await redisClient.set('Afiliados:todos', JSON.stringify(afiliados), { EX: 60 });

  res.status(200).json(afiliados);
}

const getAfiliadoById = async (req, res) => {

  const cached = await getModelCacheById(Afiliado, req.params.id);

  const afiliado = cached ? JSON.parse(cached) : await Afiliado.findById(req.params.id)
    .populate('situacionesTerapeuticas')
    .populate('direccionId')
    .populate('familiares')
    .populate('afiliadoTitularId').select('numeroAfiliado nombre apellido')
    ;

  await redisClient.set(`Afiliado:${req.params.id}`, JSON.stringify(afiliado), { EX: 60 })

  res.status(200).json(afiliado);
}

const createAfiliado = async (req, res) => {

  const afiliado = await afiliadoService.createAfiliado(req.body);

  await redisClient.set(`Afiliado:${afiliado._id}`, JSON.stringify(afiliado), { EX: 60 });
  await deleteModelsCache(Afiliado);

  res.status(201).json(afiliado);
}

const deleteAfiliado = async (req, res) => {

  await Afiliado.findByIdAndDelete(req.params.id);

  await deleteModelsCache(Afiliado);
  await deleteModelCacheById(Afiliado, req.params.id);

  res.status(204).json({});
}

const updateAfiliado = async (req, res) => {

  const afiliado = await afiliadoService.updateAfiliado(req.params.id, req.body);

  await deleteModelCacheById(Afiliado, req.params.id);
  await deleteModelsCache(Afiliado);
  await redisClient.set(`Afiliado:${afiliado._id}`, JSON.stringify(afiliado), { EX: 60 });

  res.status(200).json(afiliado);
}

module.exports = { getAfiliados, getAfiliadoById, createAfiliado, deleteAfiliado, updateAfiliado };