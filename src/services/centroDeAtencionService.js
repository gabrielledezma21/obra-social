const { CentroDeAtencion, Direccion, Horario } = require("../models");
const direccionService = require("./direccionService");
const horarioService = require("./horarioService");

const createCentroDeAtencion = async (data) => {
  let direccion;
  let horario;
  try {
    direccion = await direccionService.createDireccion(data?.direccion);
    horario = await horarioService.createHorario(data?.horario);
    return await CentroDeAtencion.create({ direccionId: direccion._id, horarioId: horario._id });
  } catch (error) {
    if (direccion?._id) await Direccion.findByIdAndDelete(direccion._id).catch(() => {});
    if (horario?._id) await Horario.findByIdAndDelete(horario._id).catch(() => {});
    throw error;
  }
};

const deleteCentrosDeAtencion = async (ids = []) => {
  const centros = await CentroDeAtencion.find({ _id: { $in: ids } });
  await Promise.all([
    CentroDeAtencion.deleteMany({ _id: { $in: ids } }),
    Direccion.deleteMany({ _id: { $in: centros.map((c) => c.direccionId) } }),
    Horario.deleteMany({ _id: { $in: centros.map((c) => c.horarioId) } })
  ]);
};

module.exports = { createCentroDeAtencion, deleteCentrosDeAtencion };
