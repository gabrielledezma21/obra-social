const { redisClient } = require('../config/redisClient');

const getModelsCache = async (modelo) => {
    const models = await redisClient.get(`${modelo.modelName}s:todos`);
    console.log(models ? "Modelo cacheado" : `No hay cache para ${modelo.modelName}s`);
    return models;
};

const getModelCacheById = async (modelo, id) => {
    const model = await redisClient.get(`${modelo.modelName}:${id}`);
    console.log(model ? "Modelo cacheado" : `No hay cache para ${modelo.modelName} con id ${id}`);
    return model;
};

const deleteModelsCache = async (modelo) => {
    await redisClient.del(`${modelo.modelName}s:todos`);
    console.log(`Cache de ${modelo.modelName}s eliminado`);
};

const deleteModelCacheById = async (modelo, id) => {
    await redisClient.del(`${modelo.modelName}:${id}`);
    console.log(`Cache de ${modelo.modelName} con id ${id} eliminado`);
};

module.exports = { getModelsCache, getModelCacheById, deleteModelsCache, deleteModelCacheById };