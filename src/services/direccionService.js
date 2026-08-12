const { Direccion } = require("../models");
const AppError = require("../exceptions/appError");
const { capitalizarCadena } = require("../utils");

const provincias = ['Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'];
const validarProvincia = (provincia) => {
  if (!provincias.includes(provincia)) throw new AppError('Provincia inválida', 400, 'PROVINCIA_INVALIDA');
  return provincia;
};

const createDireccion = async (data = {}) => Direccion.create({
  calle: data.calle ? await capitalizarCadena(data.calle) : undefined,
  altura: data.altura, pisoDepto: data.pisoDepto || null,
  localidad: data.localidad ? await capitalizarCadena(data.localidad) : undefined,
  codigoPostal: data.codigoPostal,
  provincia: data.provincia ? validarProvincia(await capitalizarCadena(data.provincia)) : undefined,
});

const updateDireccion = async (id, data = {}) => {
  const updateData = {};
  if (data.calle !== undefined) updateData.calle = await capitalizarCadena(data.calle);
  if (data.altura !== undefined) updateData.altura = data.altura;
  if (data.pisoDepto !== undefined) updateData.pisoDepto = data.pisoDepto || null;
  if (data.localidad !== undefined) updateData.localidad = await capitalizarCadena(data.localidad);
  if (data.codigoPostal !== undefined) updateData.codigoPostal = data.codigoPostal;
  if (data.provincia !== undefined) updateData.provincia = validarProvincia(await capitalizarCadena(data.provincia));
  const direccion = await Direccion.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
  if (!direccion) throw new AppError('Dirección no encontrada', 404, 'DIRECCION_NO_ENCONTRADA');
  return direccion;
};

module.exports = { createDireccion, updateDireccion };
