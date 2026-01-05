const { Horario } = require("../models");
const AppError = require("../exceptions/appError");
const { capitalizarCadena } = require("../utils");

const createHorario = async (data = {}) => {
    try {
        const dataToProcess = data || {};
        const diasDeLaSemana = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];

        // Normalizar claves de días
        const diasNormalizados = {};
        for (const [dia, valor] of Object.entries(dataToProcess.dias || {})) {
            diasNormalizados[await capitalizarCadena(dia)] = valor;
        }

        // Completar días faltantes
        diasDeLaSemana.forEach(dia => {
            if (!diasNormalizados[dia]) {
                diasNormalizados[dia] = { atiende: false, bloques: [] };
            }
        });

        const horario = await Horario.create(
            [{
                dias: diasNormalizados,
                duracionTurno: data.duracionTurno || null,
            }]
        );

        return horario[0];

    } catch (error) {
        throw new AppError(error.message, error.statusCode);
    }
};

module.exports = { createHorario };