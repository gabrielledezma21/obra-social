const { Prestador, CentroDeAtencion, Especialidad, Agenda } = require('../models');
const AppError = require("../exceptions/appError");

const existsPrestador = async (req, res, next) => {
    try {
        const prestador = await Prestador.findOne({ id: req.body.prestadorId });
        if (!prestador) {
            return next(new AppError(`El id ${req.body.prestadorId} no se encuentra registrado`, 400, 'PRESTADOR_NO_REGISTRADO'));
        }
        next();
    } catch (error) {
        return next(error);
    }
};

const existsCentroAtencion = async (req, res, next) => {
    try {
        const centro = await CentroDeAtencion.findOne({ id: req.body.centroDeAtencionId });
        if (!centro) {
            return next(new AppError(`El id ${req.body.centroDeAtencionId} no se encuentra registrado`, 400, 'CENTRO_NO_REGISTRADO'));
        }
        next();
    } catch (error) {
        return next(error);
    }
};

const existsEspecialidad = async (req, res, next) => {
    try {
        const especialidad = await Especialidad.findOne({ id: req.body.especialidadId });
        if (!especialidad) {
            return next(new AppError(`El id ${req.body.especialidadId} no se encuentra registrado`, 400, 'ESPECIALIDAD_NO_REGISTRADA'));
        }
        next();
    } catch (error) {
        return next(error);
    }
};

const prestadorConEsaEspecialidad = async (req, res, next) => {
    try {
        const prestador = await Prestador.findOne({ id: req.body.prestadorId });

        const especialidadIds = prestador.especialidades.map(e => e.id);
        if (!especialidadIds.includes(req.body.especialidadId)) {
            return next(new AppError(`El prestador con id ${req.body.prestadorId} no posee la especialidad con id ${req.body.especialidadId}`, 400, 'ESPECIALIDAD_NO_ASIGNADA_AL_PRESTADOR'));
        }
        next();
    } catch (error) {
        return next(error);
    }
};

const prestadorAtiendeEnEseCentroAtencion = async (req, res, next) => {
    try {
        const prestador = await Prestador.findOne({ id: req.body.prestadorId });

        const centroIds = prestador.centrosDeAtencion.map(c => c.id);
        if (!centroIds.includes(req.body.centroDeAtencionId)) {
            return next(new AppError(`El prestador con id ${req.body.prestadorId} no atiende en el centro de atencion con id ${req.body.centroDeAtencionId}`, 400, 'CENTRO_DE_ATENCION_NO_ASIGNADO_AL_PRESTADOR'));
        }
        next();
    } catch (error) {
        return next(error);
    }
};

const prestadorAtiendeEnEseRangoHorario = async (req, res, next) => {
    // Implementar la logica para verificar si el prestador atiende en el rango horario solicitado
    next();
};

const horarioDisponible = async (req, res, next) => {
    // Implementar la logica para verificar si el horario solicitado esta disponible
    next();
};

const notExistsAgenda = async (req, res, next) => {
    try {
        const existingAgenda = await Agenda.findOne({
            prestadorId: req.body.prestadorId,
            centroDeAtencionId: req.body.centroDeAtencionId,
            especialidadId: req.body.especialidadId
        });

        if (existingAgenda) {
            return next(new AppError('Ya existe una agenda con los mismos datos', 400, 'AGENDA_YA_EXISTE'));
        }
        next();
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    existsPrestador,
    existsCentroAtencion,
    existsEspecialidad,
    prestadorConEsaEspecialidad,
    prestadorAtiendeEnEseCentroAtencion,
    prestadorAtiendeEnEseRangoHorario,
    horarioDisponible,
    notExistsAgenda
};