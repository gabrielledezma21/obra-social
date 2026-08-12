const { Prestador, Agenda } = require("../models");
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
  const current = await Prestador.findById(id);
  if (!current) throw new AppError('Prestador no encontrado', 404, 'PRESTADOR_NO_ENCONTRADO');

  const update = { ...data };
  delete update.centrosDeAtencion;

  if (update.esCentroMedico) update.centroMedicoQueIntegra = null;
  if (update.centroMedicoQueIntegra) {
    if (String(update.centroMedicoQueIntegra) === String(id)) {
      throw new AppError('Un prestador no puede integrarse a sí mismo', 400, 'CENTRO_MEDICO_INVALIDO');
    }
    const centro = await Prestador.findOne({ _id: update.centroMedicoQueIntegra, esCentroMedico: true });
    if (!centro) throw new AppError('El centro médico seleccionado no existe o no es un centro médico', 400, 'CENTRO_MEDICO_INVALIDO');
  }

  return Prestador.findByIdAndUpdate(id, update, { new: true, runValidators: true });
};

const deletePrestador = async (id) => {
  if (await Agenda.exists({ prestadorId: id })) {
    throw new AppError('No se puede eliminar un prestador que tiene agendas activas', 409, 'PRESTADOR_CON_AGENDAS');
  }
  if (await Prestador.exists({ centroMedicoQueIntegra: id })) {
    throw new AppError('No se puede eliminar un centro médico que todavía tiene prestadores asociados', 409, 'CENTRO_MEDICO_CON_PRESTADORES');
  }
  return Prestador.findByIdAndDelete(id);
};

module.exports = { createPrestador, updatePrestador, deletePrestador };
