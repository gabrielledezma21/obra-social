const { Prestador } = require("../models");
const centroDeAtencionService = require("./centroDeAtencionService");
const AppError = require("../exceptions/appError");
const { mongo } = require("../config/");

const createPrestador = async (data) => {
    try {
        // 1. Crear centros de atención (esperando resultados)
        const centrosDeAtencion = await Promise.all(
            data.centrosDeAtencion.map((centro) =>
                centroDeAtencionService.createCentroDeAtencion(centro)
            )
        );

        // 2. Crear prestador
        const prestador = await Prestador.create(
            [{
                nombre: data.nombre,
                cuilCuit: data.cuilCuit,
                emails: data.emails,
                telefonos: data.telefonos,
                especialidades: data.especialidades,
                centrosDeAtencion: centrosDeAtencion.map(c => c._id),
                esCentroMedico: data.esCentroMedico,
                centroMedicoQueIntegra: data.centroMedicoQueIntegra,
            }]
        );

        return prestador[0];

    } catch (error) {
        throw new AppError(error.message, error.statusCode);
    }
};


module.exports = { createPrestador };


