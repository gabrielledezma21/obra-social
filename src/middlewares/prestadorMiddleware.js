const { Prestador } = require('../models');

const AppError = require("../exceptions/appError");

const notExistsPrestador = async (req, res, next) => {
    try {
        const prestadorByCuilCuit = await Prestador.findOne({ cuilCuit: req.body.cuilCuit });
        if (prestadorByCuilCuit) {
            return next(new AppError(`El cuil o cuit ${req.body.cuilCuit} ya se encuentra registrado`, 400, 'PRESTADOR_YA_REGISTRADO'));
        }
        next();
    } catch (error) {
        return next(error);
    }
};

module.exports = { notExistsPrestador };