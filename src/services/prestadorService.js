const { Prestador, Agenda, Especialidad } = require('../models');
const Usuario = require('../models/usuario');
const Solicitud = require('../models/solicitud');
const Turno = require('../models/turno');
const {
  HistoriaClinica,
  SituacionAfiliado,
} = require('../models/historiaClinica');
const servicioCentroDeAtencion = require('./centroDeAtencionService');
const ErrorAplicacion = require('../exceptions/appError');

const validarEspecialidades = async (identificadores = []) => {
  if (!Array.isArray(identificadores) || identificadores.length === 0) {
    throw new ErrorAplicacion(
      'El prestador debe tener al menos una especialidad válida',
      400,
      'ESPECIALIDAD_REQUERIDA'
    );
  }

  const idsUnicos = [...new Set(identificadores.map(String))];
  const cantidadExistente = await Especialidad.countDocuments({
    _id: { $in: idsUnicos },
  });

  if (cantidadExistente !== idsUnicos.length) {
    throw new ErrorAplicacion(
      'Una o más especialidades informadas no existen',
      400,
      'ESPECIALIDAD_INVALIDA'
    );
  }
};

const validarCentroMedico = async (
  centroMedicoQueIntegra,
  { idPrestador = null, esCentroMedico = false } = {}
) => {
  if (esCentroMedico || !centroMedicoQueIntegra) return;

  if (
    idPrestador &&
    String(centroMedicoQueIntegra) === String(idPrestador)
  ) {
    throw new ErrorAplicacion(
      'Un prestador no puede integrarse a sí mismo',
      400,
      'CENTRO_MEDICO_INVALIDO'
    );
  }

  const centro = await Prestador.findOne({
    _id: centroMedicoQueIntegra,
    esCentroMedico: true,
  });

  if (!centro) {
    throw new ErrorAplicacion(
      'El centro médico seleccionado no existe o no es un centro médico',
      400,
      'CENTRO_MEDICO_INVALIDO'
    );
  }
};

const crearPrestador = async (datos) => {
  await validarEspecialidades(datos.especialidades || []);
  await validarCentroMedico(datos.centroMedicoQueIntegra, {
    esCentroMedico: Boolean(datos.esCentroMedico),
  });

  const centrosDeAtencion = [];

  try {
    for (const datosCentro of datos.centrosDeAtencion || []) {
      centrosDeAtencion.push(
        await servicioCentroDeAtencion.createCentroDeAtencion(datosCentro)
      );
    }

    return await Prestador.create({
      nombre: datos.nombre,
      cuilCuit: datos.cuilCuit,
      emails: datos.emails || [],
      telefonos: datos.telefonos || [],
      especialidades: datos.especialidades || [],
      centrosDeAtencion: centrosDeAtencion.map((centro) => centro._id),
      esCentroMedico: Boolean(datos.esCentroMedico),
      centroMedicoQueIntegra: datos.esCentroMedico
        ? null
        : datos.centroMedicoQueIntegra || null,
    });
  } catch (error) {
    await servicioCentroDeAtencion
      .deleteCentrosDeAtencion(centrosDeAtencion.map((centro) => centro._id))
      .catch(() => {});
    throw error;
  }
};

const actualizarPrestador = async (id, datos) => {
  const actual = await Prestador.findById(id);
  if (!actual) {
    throw new ErrorAplicacion(
      'Prestador no encontrado',
      404,
      'PRESTADOR_NO_ENCONTRADO'
    );
  }

  if (datos.especialidades !== undefined) {
    await validarEspecialidades(datos.especialidades);
  }

  const cambios = { ...datos };
  delete cambios.centrosDeAtencion;

  const seraCentroMedico =
    cambios.esCentroMedico === undefined
      ? actual.esCentroMedico
      : Boolean(cambios.esCentroMedico);

  if (seraCentroMedico) {
    cambios.centroMedicoQueIntegra = null;
  } else if (cambios.centroMedicoQueIntegra !== undefined) {
    await validarCentroMedico(cambios.centroMedicoQueIntegra, {
      idPrestador: id,
      esCentroMedico: false,
    });
  }

  return Prestador.findByIdAndUpdate(id, cambios, {
    new: true,
    runValidators: true,
  });
};

const tieneHistorialOperativo = async (idPrestador) => {
  const referencias = await Promise.all([
    Usuario.exists({ prestadorId: idPrestador }),
    Solicitud.exists({ prestadorId: idPrestador }),
    Turno.exists({ prestadorId: idPrestador }),
    HistoriaClinica.exists({ prestadorId: idPrestador }),
    SituacionAfiliado.exists({ registradaPorPrestadorId: idPrestador }),
  ]);

  return referencias.some(Boolean);
};

const eliminarPrestador = async (id) => {
  const prestador = await Prestador.findById(id);
  if (!prestador) {
    throw new ErrorAplicacion(
      'Prestador no encontrado',
      404,
      'PRESTADOR_NO_ENCONTRADO'
    );
  }

  if (await Agenda.exists({ prestadorId: id })) {
    throw new ErrorAplicacion(
      'No se puede eliminar un prestador que tiene agendas activas',
      409,
      'PRESTADOR_CON_AGENDAS'
    );
  }

  if (await Prestador.exists({ centroMedicoQueIntegra: id })) {
    throw new ErrorAplicacion(
      'No se puede eliminar un centro médico que todavía tiene prestadores asociados',
      409,
      'CENTRO_MEDICO_CON_PRESTADORES'
    );
  }

  if (await tieneHistorialOperativo(id)) {
    throw new ErrorAplicacion(
      'No se puede eliminar físicamente un prestador que tiene historial operativo o clínico',
      409,
      'PRESTADOR_CON_HISTORIAL'
    );
  }

  const centrosDeAtencion = prestador.centrosDeAtencion.map(String);
  await Prestador.findByIdAndDelete(id);
  await servicioCentroDeAtencion.deleteCentrosDeAtencion(centrosDeAtencion);

  return prestador;
};

module.exports = {
  createPrestador: crearPrestador,
  updatePrestador: actualizarPrestador,
  deletePrestador: eliminarPrestador,
};
