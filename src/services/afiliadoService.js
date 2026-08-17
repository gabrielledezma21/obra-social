const { Afiliado, Direccion, SituacionTerapeutica } = require('../models');
const Contador = require('../models/contador');
const {
  createDireccion: crearDireccion,
  updateDireccion: actualizarDireccion,
} = require('./direccionService');
const ErrorAplicacion = require('../exceptions/appError');

const obtenerSiguienteNumeroAfiliado = async () => {
  let contador = await Contador.findById('numeroAfiliado');

  if (!contador) {
    const ultimoAfiliado = await Afiliado.findOne()
      .sort({ numeroAfiliado: -1 })
      .select('numeroAfiliado');
    const secuenciaInicial = Number(ultimoAfiliado?.numeroAfiliado || 0);

    try {
      contador = await Contador.create({
        _id: 'numeroAfiliado',
        secuencia: secuenciaInicial,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      contador = await Contador.findById('numeroAfiliado');
    }
  }

  contador = await Contador.findByIdAndUpdate(
    'numeroAfiliado',
    { $inc: { secuencia: 1 } },
    { new: true }
  );

  if (contador.secuencia > 9999999) {
    throw new ErrorAplicacion('Se agotó la numeración de afiliados', 500);
  }

  return contador.secuencia;
};

const crearAfiliado = async (datos) => {
  const direccionesCreadas = [];

  try {
    const direccionesInformadas =
      Array.isArray(datos.direcciones) && datos.direcciones.length
        ? datos.direcciones
        : [datos.direccion].filter(Boolean);

    if (!direccionesInformadas.length) {
      throw new ErrorAplicacion(
        'Debe informar al menos una dirección',
        400,
        'DIRECCION_REQUERIDA'
      );
    }

    for (const direccionInformada of direccionesInformadas) {
      direccionesCreadas.push(await crearDireccion(direccionInformada));
    }

    const parentesco = datos.parentesco || 'Titular';
    let numeroAfiliado;
    let numeroIntegrante;

    if (parentesco === 'Titular') {
      numeroAfiliado = await obtenerSiguienteNumeroAfiliado();
      numeroIntegrante = 1;
    } else {
      if (!datos.afiliadoTitularId) {
        throw new ErrorAplicacion(
          'Debes especificar el afiliadoTitularId para registrar un familiar',
          400
        );
      }

      const titular = await Afiliado.findById(datos.afiliadoTitularId);
      if (!titular || titular.parentesco !== 'Titular') {
        throw new ErrorAplicacion(
          'El titular especificado no existe o no es titular',
          404
        );
      }

      numeroAfiliado = titular.numeroAfiliado;
      const ultimoFamiliar = await Afiliado.findOne({ numeroAfiliado }).sort({
        numeroIntegrante: -1,
      });
      numeroIntegrante = ultimoFamiliar
        ? ultimoFamiliar.numeroIntegrante + 1
        : 2;

      if (numeroIntegrante > 99) {
        throw new ErrorAplicacion(
          'El grupo familiar alcanzó el máximo de 99 integrantes',
          409
        );
      }
    }

    const afiliado = await Afiliado.create({
      nombre: datos.nombre,
      apellido: datos.apellido,
      fechaNacimiento: datos.fechaNacimiento,
      tipoDocumento: datos.tipoDocumento,
      dni: datos.dni,
      numeroAfiliado,
      numeroIntegrante,
      parentesco,
      situacionesTerapeuticas: datos.situacionesTerapeuticas || [],
      emails: datos.emails || [],
      telefonos: datos.telefonos || [],
      direccionId: direccionesCreadas[0]._id,
      direccionesIds: direccionesCreadas.map((direccion) => direccion._id),
      plan: datos.plan,
      fechaAlta: datos.fechaAlta ? new Date(datos.fechaAlta) : new Date(),
      fechaBaja: datos.fechaBaja || null,
      afiliadoTitularId: datos.afiliadoTitularId || null,
    });

    if (afiliado.situacionesTerapeuticas.length) {
      await SituacionTerapeutica.updateMany(
        { _id: { $in: afiliado.situacionesTerapeuticas } },
        { $addToSet: { afiliados: afiliado._id } }
      );
    }

    return afiliado;
  } catch (error) {
    if (direccionesCreadas.length) {
      await Direccion.deleteMany({
        _id: { $in: direccionesCreadas.map((direccion) => direccion._id) },
      }).catch(() => {});
    }
    throw error;
  }
};

const actualizarAfiliado = async (id, datos) => {
  const afiliadoActual = await Afiliado.findById(id);
  if (!afiliadoActual) {
    throw new ErrorAplicacion(
      'Afiliado no encontrado',
      404,
      'AFILIADO_NO_ENCONTRADO'
    );
  }

  const situacionesAnteriores = afiliadoActual.situacionesTerapeuticas.map(String);
  const cambios = { ...datos };
  delete cambios.direccion;
  delete cambios.direcciones;
  delete cambios.numeroAfiliado;
  delete cambios.numeroIntegrante;
  delete cambios.afiliadoTitularId;
  delete cambios.parentesco;

  if (datos.direccion) {
    await actualizarDireccion(afiliadoActual.direccionId, datos.direccion);
  }

  if (Array.isArray(datos.direcciones) && datos.direcciones.length) {
    const idsDireccionesAnteriores = afiliadoActual.direccionesIds?.length
      ? afiliadoActual.direccionesIds
      : [afiliadoActual.direccionId].filter(Boolean);
    const direccionesNuevas = [];

    for (const direccionInformada of datos.direcciones) {
      direccionesNuevas.push(await crearDireccion(direccionInformada));
    }

    cambios.direccionId = direccionesNuevas[0]._id;
    cambios.direccionesIds = direccionesNuevas.map(
      (direccion) => direccion._id
    );

    await Direccion.deleteMany({
      _id: { $in: idsDireccionesAnteriores },
    });
  }

  const afiliado = await Afiliado.findByIdAndUpdate(id, cambios, {
    new: true,
    runValidators: true,
  });

  if (datos.situacionesTerapeuticas) {
    await SituacionTerapeutica.updateMany(
      { _id: { $in: situacionesAnteriores } },
      { $pull: { afiliados: afiliado._id } }
    );
    await SituacionTerapeutica.updateMany(
      { _id: { $in: afiliado.situacionesTerapeuticas } },
      { $addToSet: { afiliados: afiliado._id } }
    );
  }

  return afiliado;
};

module.exports = { crearAfiliado, actualizarAfiliado };
