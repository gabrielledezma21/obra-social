const {
  CentroDeAtencion,
  Direccion,
  Horario,
  Prestador,
} = require('../models');
const servicioDireccion = require('./direccionService');
const servicioHorario = require('./horarioService');

const createCentroDeAtencion = async (datos) => {
  let direccion;
  let horario;
  try {
    direccion = await servicioDireccion.createDireccion(datos?.direccion);
    horario = await servicioHorario.createHorario(datos?.horario);
    return await CentroDeAtencion.create({
      direccionId: direccion._id,
      horarioId: horario._id,
    });
  } catch (error) {
    if (direccion?._id) {
      await Direccion.findByIdAndDelete(direccion._id).catch(() => {});
    }
    if (horario?._id) {
      await Horario.findByIdAndDelete(horario._id).catch(() => {});
    }
    throw error;
  }
};

const deleteCentrosDeAtencion = async (identificadores = []) => {
  const idsUnicos = [...new Set(identificadores.filter(Boolean).map(String))];
  if (idsUnicos.length === 0) return { eliminados: 0 };

  const centros = await CentroDeAtencion.find({ _id: { $in: idsUnicos } });
  const centrosEliminables = [];

  for (const centro of centros) {
    const tienePrestadores = await Prestador.exists({
      centrosDeAtencion: centro._id,
    });
    if (!tienePrestadores) centrosEliminables.push(centro);
  }

  if (centrosEliminables.length === 0) return { eliminados: 0 };

  const idsCentros = centrosEliminables.map((centro) => centro._id);
  await CentroDeAtencion.deleteMany({ _id: { $in: idsCentros } });

  const idsDirecciones = [
    ...new Set(
      centrosEliminables.map((centro) => String(centro.direccionId)).filter(Boolean)
    ),
  ];
  const idsHorarios = [
    ...new Set(
      centrosEliminables.map((centro) => String(centro.horarioId)).filter(Boolean)
    ),
  ];

  const direccionesReferenciadas = await CentroDeAtencion.distinct('direccionId', {
    direccionId: { $in: idsDirecciones },
  });
  const horariosReferenciados = await CentroDeAtencion.distinct('horarioId', {
    horarioId: { $in: idsHorarios },
  });

  const idsDireccionesReferenciadas = new Set(
    direccionesReferenciadas.map(String)
  );
  const idsHorariosReferenciados = new Set(horariosReferenciados.map(String));

  const direccionesHuerfanas = idsDirecciones.filter(
    (id) => !idsDireccionesReferenciadas.has(id)
  );
  const horariosHuerfanos = idsHorarios.filter(
    (id) => !idsHorariosReferenciados.has(id)
  );

  await Promise.all([
    direccionesHuerfanas.length
      ? Direccion.deleteMany({ _id: { $in: direccionesHuerfanas } })
      : Promise.resolve(),
    horariosHuerfanos.length
      ? Horario.deleteMany({ _id: { $in: horariosHuerfanos } })
      : Promise.resolve(),
  ]);

  return { eliminados: idsCentros.length };
};

module.exports = { createCentroDeAtencion, deleteCentrosDeAtencion };
