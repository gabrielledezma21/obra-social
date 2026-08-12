const { Afiliado, Direccion, SituacionTerapeutica } = require("../models");
const AppError = require("../exceptions/appError");
const { redisClient } = require("../config/redisClient");
const { getModelsCache, getModelCacheById, deleteModelsCache, deleteModelCacheById } = require("./genericController");
const afiliadoService = require("../services/afiliadoService");

const populateAfiliado = (query) => query
  .populate('situacionesTerapeuticas')
  .populate('direccionId')
  .populate('familiares')
  .populate('afiliadoTitularId', 'numeroAfiliado nombre apellido');

const getAfiliados = async (_, res) => {
  const cached = await getModelsCache(Afiliado);
  const afiliados = cached ? JSON.parse(cached) : await Afiliado.find().populate('situacionesTerapeuticas').populate('direccionId');
  await redisClient.set('Afiliados:todos', JSON.stringify(afiliados), { EX: 60 });
  res.status(200).json(afiliados);
};

const getAfiliadoById = async (req, res) => {
  const cached = await getModelCacheById(Afiliado, req.params.id);
  const afiliado = cached ? JSON.parse(cached) : await populateAfiliado(Afiliado.findById(req.params.id));
  await redisClient.set(`Afiliado:${req.params.id}`, JSON.stringify(afiliado), { EX: 60 });
  res.status(200).json(afiliado);
};

const createAfiliado = async (req, res) => {
  const created = await afiliadoService.createAfiliado(req.body);
  const afiliado = await populateAfiliado(Afiliado.findById(created._id));
  await redisClient.set(`Afiliado:${afiliado._id}`, JSON.stringify(afiliado), { EX: 60 });
  await deleteModelsCache(Afiliado);
  if (afiliado.afiliadoTitularId?._id) await deleteModelCacheById(Afiliado, afiliado.afiliadoTitularId._id);
  res.status(201).json(afiliado);
};

const deleteAfiliado = async (req, res) => {
  const afiliado = await Afiliado.findById(req.params.id);
  if (afiliado.parentesco === 'Titular' && await Afiliado.exists({ afiliadoTitularId: afiliado._id })) {
    throw new AppError('No se puede eliminar un titular que todavía tiene integrantes en su grupo familiar', 409, 'TITULAR_CON_FAMILIARES');
  }
  await Afiliado.findByIdAndDelete(afiliado._id);
  await SituacionTerapeutica.updateMany(
    { afiliados: afiliado._id },
    { $pull: { afiliados: afiliado._id } }
  );
  const direccionEnUso = await Afiliado.exists({ direccionId: afiliado.direccionId });
  if (!direccionEnUso) await Direccion.findByIdAndDelete(afiliado.direccionId);
  await deleteModelsCache(Afiliado);
  await deleteModelCacheById(Afiliado, afiliado._id);
  if (afiliado.afiliadoTitularId) await deleteModelCacheById(Afiliado, afiliado.afiliadoTitularId);
  res.status(204).send();
};

const updateAfiliado = async (req, res) => {
  const current = await Afiliado.findById(req.params.id);
  await afiliadoService.updateAfiliado(req.params.id, req.body);
  const afiliado = await populateAfiliado(Afiliado.findById(req.params.id));
  await deleteModelCacheById(Afiliado, req.params.id);
  await deleteModelsCache(Afiliado);
  if (current?.afiliadoTitularId) await deleteModelCacheById(Afiliado, current.afiliadoTitularId);
  await redisClient.set(`Afiliado:${afiliado._id}`, JSON.stringify(afiliado), { EX: 60 });
  res.status(200).json(afiliado);
};

module.exports = { getAfiliados, getAfiliadoById, createAfiliado, deleteAfiliado, updateAfiliado };
