const { Afiliado } = require('../models');

const AppError = require("../exceptions/appError");

const notExistsAfiliado = async (req, res, next) => {
    try {
        const afiliadoByDniAndTipoDocumento = await Afiliado.findOne({ dni: req.body.dni, tipoDocumento: req.body.tipoDocumento });
        if (afiliadoByDniAndTipoDocumento) {
            return next(new AppError(`El dni ${req.body.dni} con el tipo de documento ${req.body.tipoDocumento} ya se encuentra registrado`, 400, 'AFILIADO_YA_REGISTRADO'));
        }
        next();
    } catch (error) {
        return next(error);
    }
};

module.exports = { notExistsAfiliado };