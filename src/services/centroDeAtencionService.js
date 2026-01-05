const { CentroDeAtencion } = require("../models");
const direccionService = require("./direccionService");
const horarioService = require("./horarioService");
const AppError = require("../exceptions/appError");
const { mongoose } = require("../config/db");

const createCentroDeAtencion = async (data) => {
    try {
        // 1. Crear direccion
        const direccion = await direccionService.createDireccion(
            data.direccion
        );

        // 2. Crear horario (soporta formato anidado {horario: {dias...}} o plano {dias...})
        const horario = await horarioService.createHorario(
            data.horario
        );

        // 3. Crear centro de atención
        const centroDeAtencion = await CentroDeAtencion.create(
            [{
                direccionId: direccion._id,
                horarioId: horario._id,
            }]
        );

        return centroDeAtencion[0];

    } catch (error) {
        throw new AppError(error.message, error.statusCode);
    }
};


module.exports = { createCentroDeAtencion };