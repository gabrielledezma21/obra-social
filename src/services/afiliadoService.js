const { Afiliado, Direccion, SituacionTerapeutica } = require("../models");
const direccionService = require("./direccionService");
const AppError = require("../exceptions/appError");

const createAfiliado = async (data) => {
  let direccion;
  try {
    direccion = await direccionService.createDireccion(data.direccion);
    const parentesco = data.parentesco || 'Titular';
    let numeroAfiliado;
    let numeroIntegrante;

    if (parentesco === 'Titular') {
      const lastAfiliado = await Afiliado.findOne().sort({ numeroAfiliado: -1 });
      numeroAfiliado = lastAfiliado ? lastAfiliado.numeroAfiliado + 1 : 1000;
      numeroIntegrante = 1;
    } else {
      if (!data.afiliadoTitularId) throw new AppError("Debes especificar el afiliadoTitularId para registrar un familiar", 400);
      const titular = await Afiliado.findById(data.afiliadoTitularId);
      if (!titular || titular.parentesco !== 'Titular') throw new AppError("El titular especificado no existe o no es titular", 404);
      numeroAfiliado = titular.numeroAfiliado;
      const lastFamiliar = await Afiliado.findOne({ numeroAfiliado }).sort({ numeroIntegrante: -1 });
      numeroIntegrante = lastFamiliar ? lastFamiliar.numeroIntegrante + 1 : 2;
    }

    const afiliado = await Afiliado.create({
      nombre: data.nombre, apellido: data.apellido, tipoDocumento: data.tipoDocumento,
      dni: data.dni, numeroAfiliado, numeroIntegrante, parentesco,
      situacionesTerapeuticas: data.situacionesTerapeuticas || [], emails: data.emails || [],
      telefonos: data.telefonos || [], direccionId: direccion._id, plan: data.plan,
      fechaAlta: data.fechaAlta ? new Date(data.fechaAlta) : new Date(),
      fechaBaja: data.fechaBaja || null, afiliadoTitularId: data.afiliadoTitularId || null
    });
    if (afiliado.situacionesTerapeuticas.length) {
      await SituacionTerapeutica.updateMany(
        { _id: { $in: afiliado.situacionesTerapeuticas } },
        { $addToSet: { afiliados: afiliado._id } }
      );
    }
    return afiliado;
  } catch (error) {
    if (direccion?._id) await Direccion.findByIdAndDelete(direccion._id).catch(() => {});
    if (error instanceof AppError) throw error;
    throw error;
  }
};

const updateAfiliado = async (id, data) => {
  const current = await Afiliado.findById(id);
  if (!current) throw new AppError('Afiliado no encontrado', 404, 'AFILIADO_NO_ENCONTRADO');
  const previousSituaciones = current.situacionesTerapeuticas.map(String);
  const update = { ...data };
  delete update.direccion;
  delete update.numeroAfiliado;
  delete update.numeroIntegrante;
  delete update.afiliadoTitularId;
  delete update.parentesco;
  if (data.direccion) await direccionService.updateDireccion(current.direccionId, data.direccion);
  const afiliado = await Afiliado.findByIdAndUpdate(id, update, { new: true, runValidators: true });
  if (data.situacionesTerapeuticas) {
    await SituacionTerapeutica.updateMany({ _id: { $in: previousSituaciones } }, { $pull: { afiliados: afiliado._id } });
    await SituacionTerapeutica.updateMany({ _id: { $in: afiliado.situacionesTerapeuticas } }, { $addToSet: { afiliados: afiliado._id } });
  }
  return afiliado;
};

module.exports = { createAfiliado, updateAfiliado };
