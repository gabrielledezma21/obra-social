const { Agenda } = require("../models");
const AppError = require("../exceptions/appError");
const horarioService = require("./horarioService");
const { mongo } = require("../config/");

const createAgenda = async (data) => {
    try {
        const horario = await horarioService.createHorario(
            data.horario
        );

        const agenda = await Agenda.create([{
            especialidadId: data.especialidadId,
            centroDeAtencionId: data.centroDeAtencionId,
            prestadorId: data.prestadorId,
            horario: horario,
        }]);

        return agenda[0];

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