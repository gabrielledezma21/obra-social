const mongoose = require('mongoose');
const AppError = require("../exceptions/appError");

// se utiliza para ver que peticion se hizo y que se envio, es para debuggear
const logRequest = (req, _, next) => {
    console.log({ method: req.method, url: req.url, fechaHora: new Date(), body: req.body, params: req.params });
    next();
};

// Se utiliza para verificar que al menos exista una instancia de ese modelo en la base de datos
const existsAnyByModel = (modelo) => {
    return async (req, res, next) => {
        try {
            const data = await modelo.findOne();
            if (!data) {
                return next(new AppError(`No hay ningun ${modelo.modelName} registrado`, 404, 'NO_HAY_NINGUNO_REGISTRADO'));
            }
            next();
        } catch (error) {
            return next(error);
        }
    }
};

// Se utiliza para verificar que exista una instancia de ese modelo en la base de datos
const existsModelById = (modelo) => {
    return async (req, res, next) => {
        try {
            const data = await modelo.findById(req.params.id);
            if (!data) {
                return next(new AppError(`No hay ningun ${modelo.modelName} con id ${req.params.id}`, 404, 'NO_HAY_NINGUNO_CON_ESE_ID'));
            }
            next();
        } catch (error) {
            return next(error);
        }
    }
};

const validarCamposExactos = (modelo) => {
    return (req, res, next) => {
        const camposValidos = Object.keys(modelo.schema.paths);
        const camposRecibidos = Object.keys(req.body);
        const camposInvalidos = camposRecibidos.filter(campo => !camposValidos.includes(campo));

        if (camposInvalidos.length > 0) {
            return next(new AppError(`Hay campos inválidos`, 400, 'CAMPOS_INVALIDOS'));
        }
        next()
    }
}

module.exports = { logRequest, existsAnyByModel, existsModelById, validarCamposExactos };