const { Prestador } = require("../models");
const { redisClient } = require("../config/redisClient");
const { getModelsCache, getModelCacheById, deleteModelsCache, deleteModelCacheById } = require("./genericController");
const prestadorService = require("../services/prestadorService");

const populatePrestador = (query, list = false) => query
  .populate('especialidades')
  .populate('centroMedicoQueIntegra', 'nombre cuilCuit esCentroMedico')
  .populate({
    path: 'centrosDeAtencion',
    populate: [
      { path: 'direccionId', select: list ? 'calle altura pisoDepto codigoPostal localidad provincia' : undefined },
      { path: 'horarioId' }
    ]
  })
  .populate('agendas');

const hasCompleteMedicalCenter = (provider) =>
  !provider?.centroMedicoQueIntegra ||
  typeof provider.centroMedicoQueIntegra === 'object';

const getPrestadores = async (_, res) => {
  const cached = await getModelsCache(Prestador);
  let prestadores = cached ? JSON.parse(cached) : null;
  if (!Array.isArray(prestadores) || prestadores.some((item) => !hasCompleteMedicalCenter(item))) {
    prestadores = await populatePrestador(Prestador.find(), true);
  }
  await redisClient.set('Prestadors:todos', JSON.stringify(prestadores), { EX: 60 });
  res.status(200).json(prestadores);
};

const getPrestadorById = async (req, res) => {
  const cached = await getModelCacheById(Prestador, req.params.id);
  let prestador = cached ? JSON.parse(cached) : null;
  if (!prestador || !hasCompleteMedicalCenter(prestador)) {
    prestador = await populatePrestador(Prestador.findById(req.params.id));
  }
  await redisClient.set(`Prestador:${req.params.id}`, JSON.stringify(prestador), { EX: 60 });
  res.status(200).json(prestador);
};

const createPrestador = async (req, res) => {
  const created = await prestadorService.createPrestador(req.body);
  const prestador = await populatePrestador(Prestador.findById(created._id));
  await redisClient.set(`Prestador:${prestador._id}`, JSON.stringify(prestador), { EX: 60 });
  await deleteModelsCache(Prestador);
  res.status(201).json(prestador);
};

const deletePrestador = async (req, res) => {
  await prestadorService.deletePrestador(req.params.id);
  await deleteModelsCache(Prestador);
  await deleteModelCacheById(Prestador, req.params.id);
  res.status(204).send();
};

const updatePrestador = async (req, res) => {
  await prestadorService.updatePrestador(req.params.id, req.body);
  const prestador = await populatePrestador(Prestador.findById(req.params.id));
  await deleteModelCacheById(Prestador, req.params.id);
  await deleteModelsCache(Prestador);
  await redisClient.set(`Prestador:${prestador._id}`, JSON.stringify(prestador), { EX: 60 });
  res.status(200).json(prestador);
};

module.exports = { getPrestadores, getPrestadorById, createPrestador, deletePrestador, updatePrestador };
