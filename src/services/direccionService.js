const { Direccion } = require("../models");
const AppError = require("../exceptions/appError");
const { capitalizarCadena } = require("../utils");

const createDireccion = async (data) => {
    try {
        const d = data || {};
        const direccion = await Direccion.create(
            [{
                calle: d.calle ? await capitalizarCadena(d.calle) : undefined,
                altura: d.altura,
                pisoDepto: d.pisoDepto || null,
                localidad: d.localidad ? await capitalizarCadena(d.localidad) : undefined,
                codigoPostal: d.codigoPostal,
                provincia: d.provincia ? validarProvincia(await capitalizarCadena(d.provincia)) : undefined,
            }]
        );

        return direccion[0];

    } catch (error) {
        throw new AppError(error.message, error.statusCode);
    }
};

const validarProvincia = (provincia) => {
    const provincias = ['Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'];
    if (!provincias.includes(provincia)) {
        throw new AppError('Provincia inválida', 400, 'PROVINCIA_INVALIDA');
    }
    return provincia;
}

const updateDireccion = async (id, data) => {
    try {
        const d = data || {};
        const updateData = {};
        if (d.calle) updateData.calle = await capitalizarCadena(d.calle);
        if (d.altura) updateData.altura = d.altura;
        if (d.pisoDepto !== undefined) updateData.pisoDepto = d.pisoDepto;
        if (d.localidad) updateData.localidad = await capitalizarCadena(d.localidad);
        if (d.codigoPostal) updateData.codigoPostal = d.codigoPostal;
        if (d.provincia) updateData.provincia = validarProvincia(await capitalizarCadena(d.provincia));

        const direccion = await Direccion.findByIdAndUpdate(id, updateData, { new: true });
        return direccion;
    } catch (error) {
        throw new AppError(error.message, error.statusCode);
    }
}

module.exports = { createDireccion, updateDireccion };