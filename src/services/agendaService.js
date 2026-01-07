const { Agenda } = require("../models");
const AppError = require("../exceptions/appError");
const { mongo } = require("../config/");

const createAgenda = async (data) => {
    try {
        // 1. Asignar relaciones con: prestador, especialidad, y centro de atencion
        // 2. Crear o asignar horarios
        // 3. Crear agenda        

    } catch (error) {
        throw new AppError(error.message, error.statusCode);
    }
};

const updateAgenda = async (id, data) => {
    try {
        const agenda = await Agenda.findByIdAndUpdate(id, data, { new: true });
        return agenda;
    } catch (error) {
        throw new AppError(error.message, error.statusCode);
    }
};

module.exports = { createAgenda, updateAgenda };