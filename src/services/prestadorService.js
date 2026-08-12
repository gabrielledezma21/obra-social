const { Prestador } = require("../models");
const centroDeAtencionService = require("./centroDeAtencionService");
const AppError = require("../exceptions/appError");

const createPrestador = async (data) => {
  const centrosDeAtencion = await Promise.all(
    (data.centrosDeAtencion || []).map((centro) => centroDeAtencionService.createCentroDeAtencion(centro))
  );
  try {
    return await Prestador.create({
      nombre: data.nombre, cuilCuit: data.cuilCuit, emails: data.emails || [],
      telefonos: data.telefonos || [], especialidades: data.especialidades || [],
      centrosDeAtencion: centrosDeAtencion.map((c) => c._id),
      esCentroMedico: data.esCentroMedico, centroMedicoQueIntegra: data.centroMedicoQueIntegra || null
    });
  } catch (error) {
    await centroDeAtencionService.deleteCentrosDeAtencion(centrosDeAtencion.map((c) => c._id)).catch(() => {});
    throw error;
  }
};

const updatePrestador = async (id, data) => {
  const update = { ...data };
  delete update.centrosDeAtencion;
  const prestador = await Prestador.findByIdAndUpdate(id, update, { new: true, runValidators: true });
  if (!prestador) throw new AppError('Prestador no encontrado', 404, 'PRESTADOR_NO_ENCONTRADO');
  return prestador;
};

module.exports = { createPrestador, updatePrestador };
