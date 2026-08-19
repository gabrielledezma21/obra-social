const {
  Afiliado,
  Direccion,
  CentroDeAtencion,
  SituacionTerapeutica,
} = require('../models');
const Contador = require('../models/contador');
const { createDireccion: crearDireccion } = require('./direccionService');
const ErrorAplicacion = require('../exceptions/appError');

const validarSituacionesTerapeuticas = async (identificadores = []) => {
  if (!Array.isArray(identificadores) || identificadores.length === 0) return;

  const idsUnicos = [...new Set(identificadores.map(String))];
  const cantidadExistente = await SituacionTerapeutica.countDocuments({
    _id: { $in: idsUnicos },
  });

  if (cantidadExistente !== idsUnicos.length) {
    throw new ErrorAplicacion(
      'Una o más situaciones terapéuticas informadas no existen',
      400,
      'SITUACION_TERAPEUTICA_INVALIDA'
    );
  }
};

const eliminarDireccionesSinReferencias = async (identificadores = []) => {
  const idsUnicos = [...new Set(identificadores.filter(Boolean).map(String))];
  const idsEliminables = [];

  for (const idDireccion of idsUnicos) {
    const [referenciadaPorAfiliado, referenciadaPorCentro] = await Promise.all([
      Afiliado.exists({
        $or: [{ direccionId: idDireccion }, { direccionesIds: idDireccion }],
      }),
      CentroDeAtencion.exists({ direccionId: idDireccion }),
    ]);

    if (!referenciadaPorAfiliado && !referenciadaPorCentro) {
      idsEliminables.push(idDireccion);
    }
  }

  if (idsEliminables.length) {
    await Direccion.deleteMany({ _id: { $in: idsEliminables } });
  }
};

const obtenerIdsDirecciones = (afiliado) => {
  if (afiliado?.direccionesIds?.length) {
    return afiliado.direccionesIds.map((id) => id._id || id);
  }
  return [afiliado?.direccionId?._id || afiliado?.direccionId].filter(Boolean);
};

const crearDirecciones = async (direccionesInformadas, direccionesCreadas) => {
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

  return direccionesCreadas.map((direccion) => direccion._id);
};

const obtenerDatosDireccion = (direccion, cambios = {}) => ({
  calle: cambios.calle ?? direccion.calle,
  altura: cambios.altura ?? direccion.altura,
  pisoDepto:
    cambios.pisoDepto !== undefined ? cambios.pisoDepto : direccion.pisoDepto,
  localidad: cambios.localidad ?? direccion.localidad,
  codigoPostal: cambios.codigoPostal ?? direccion.codigoPostal,
  provincia: cambios.provincia ?? direccion.provincia,
});

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
    await validarSituacionesTerapeuticas(datos.situacionesTerapeuticas || []);

    const parentesco = datos.parentesco || 'Titular';
    let numeroAfiliado;
    let numeroIntegrante;
    let fechaBaja = datos.fechaBaja || null;
    let idsDirecciones = [];
    let comparteDomicilioTitular = false;

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
      if (titular.fechaBaja) {
        fechaBaja = titular.fechaBaja;
      }

      comparteDomicilioTitular = Boolean(datos.comparteDomicilioTitular);
      if (comparteDomicilioTitular) {
        idsDirecciones = obtenerIdsDirecciones(titular);
        if (!idsDirecciones.length) {
          throw new ErrorAplicacion(
            'El titular no tiene un domicilio disponible para compartir',
            409,
            'TITULAR_SIN_DOMICILIO'
          );
        }
      }

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

    if (!idsDirecciones.length) {
      const direccionesInformadas =
        Array.isArray(datos.direcciones) && datos.direcciones.length
          ? datos.direcciones
          : [datos.direccion].filter(Boolean);
      idsDirecciones = await crearDirecciones(
        direccionesInformadas,
        direccionesCreadas
      );
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
      direccionId: idsDirecciones[0],
      direccionesIds: idsDirecciones,
      comparteDomicilioTitular,
      plan: datos.plan,
      fechaAlta: datos.fechaAlta ? new Date(datos.fechaAlta) : new Date(),
      fechaBaja,
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
      await eliminarDireccionesSinReferencias(
        direccionesCreadas.map((direccion) => direccion._id)
      ).catch(() => {});
    }
    throw error;
  }
};

const actualizarVigenciaGrupoFamiliar = async (afiliadoActual, datos) => {
  if (afiliadoActual.parentesco !== 'Titular') {
    throw new ErrorAplicacion(
      'Solo el titular puede aplicar cambios de vigencia a todo el grupo familiar',
      400,
      'SOLO_TITULAR_PUEDE_MODIFICAR_GRUPO'
    );
  }

  if (!Object.prototype.hasOwnProperty.call(datos, 'fechaBaja')) {
    throw new ErrorAplicacion(
      'La fecha de baja es obligatoria para modificar la vigencia del grupo',
      400,
      'FECHA_BAJA_REQUERIDA'
    );
  }

  const camposPermitidos = new Set(['fechaBaja', 'aplicarAGrupoFamiliar']);
  const camposInvalidos = Object.keys(datos).filter(
    (campo) => !camposPermitidos.has(campo)
  );
  if (camposInvalidos.length) {
    throw new ErrorAplicacion(
      'La modificación grupal de vigencia no admite otros cambios simultáneos',
      400,
      'CAMBIOS_GRUPALES_INVALIDOS'
    );
  }

  const fechaBaja = datos.fechaBaja ? new Date(datos.fechaBaja) : null;
  if (fechaBaja && Number.isNaN(fechaBaja.getTime())) {
    throw new ErrorAplicacion(
      'La fecha de baja es inválida',
      400,
      'FECHA_BAJA_INVALIDA'
    );
  }

  await Afiliado.updateMany(
    {
      $or: [
        { _id: afiliadoActual._id },
        { afiliadoTitularId: afiliadoActual._id },
      ],
    },
    { $set: { fechaBaja } },
    { runValidators: true }
  );

  return Afiliado.findById(afiliadoActual._id);
};

const propagarFechaBajaDelTitular = async (
  afiliadoActual,
  afiliadoActualizado,
  datos
) => {
  const cambiaFechaBaja = Object.prototype.hasOwnProperty.call(
    datos,
    'fechaBaja'
  );
  if (afiliadoActual.parentesco !== 'Titular' || !cambiaFechaBaja) return;

  await Afiliado.updateMany(
    { afiliadoTitularId: afiliadoActual._id },
    { $set: { fechaBaja: afiliadoActualizado.fechaBaja || null } },
    { runValidators: true }
  );
};

const prepararDomicilioCompartido = async (
  afiliadoActual,
  datos,
  cambios,
  idsDireccionesAnteriores
) => {
  if (afiliadoActual.parentesco === 'Titular') return false;

  const solicitaCompartir = datos.comparteDomicilioTitular === true;
  const dejaDeCompartir = datos.comparteDomicilioTitular === false;
  const modificaDirecciones =
    (Array.isArray(datos.direcciones) && datos.direcciones.length > 0) ||
    Boolean(datos.direccion);

  if (afiliadoActual.comparteDomicilioTitular && modificaDirecciones && !dejaDeCompartir) {
    throw new ErrorAplicacion(
      'El domicilio compartido solo puede modificarse desde el titular. Elegí usar domicilio propio para independizarlo.',
      409,
      'DOMICILIO_COMPARTIDO_SOLO_TITULAR'
    );
  }

  if (!solicitaCompartir) return false;

  const titular = await Afiliado.findById(afiliadoActual.afiliadoTitularId);
  if (!titular) {
    throw new ErrorAplicacion(
      'No se encontró el titular del grupo familiar',
      404,
      'TITULAR_NO_ENCONTRADO'
    );
  }

  const idsTitular = obtenerIdsDirecciones(titular);
  if (!idsTitular.length) {
    throw new ErrorAplicacion(
      'El titular no tiene un domicilio disponible para compartir',
      409,
      'TITULAR_SIN_DOMICILIO'
    );
  }

  idsDireccionesAnteriores.push(...obtenerIdsDirecciones(afiliadoActual).map(String));
  cambios.direccionId = idsTitular[0];
  cambios.direccionesIds = idsTitular;
  cambios.comparteDomicilioTitular = true;
  delete cambios.direccion;
  delete cambios.direcciones;
  return true;
};

const propagarDomicilioDelTitular = async (titular, idsDirecciones) => {
  await Afiliado.updateMany(
    {
      afiliadoTitularId: titular._id,
      comparteDomicilioTitular: true,
    },
    {
      $set: {
        direccionId: idsDirecciones[0],
        direccionesIds: idsDirecciones,
      },
    },
    { runValidators: true }
  );
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

  if (datos.aplicarAGrupoFamiliar) {
    return actualizarVigenciaGrupoFamiliar(afiliadoActual, datos);
  }

  if (datos.situacionesTerapeuticas !== undefined) {
    await validarSituacionesTerapeuticas(datos.situacionesTerapeuticas);
  }

  const situacionesAnteriores = afiliadoActual.situacionesTerapeuticas.map(String);
  const cambios = { ...datos };
  delete cambios.aplicarAGrupoFamiliar;
  delete cambios.numeroAfiliado;
  delete cambios.numeroIntegrante;
  delete cambios.afiliadoTitularId;
  delete cambios.parentesco;

  const direccionesNuevas = [];
  const idsDireccionesAnteriores = [];

  try {
    const ahoraComparte = await prepararDomicilioCompartido(
      afiliadoActual,
      datos,
      cambios,
      idsDireccionesAnteriores
    );

    if (!ahoraComparte && Array.isArray(datos.direcciones) && datos.direcciones.length) {
      idsDireccionesAnteriores.push(
        ...obtenerIdsDirecciones(afiliadoActual).map(String)
      );

      const idsNuevas = await crearDirecciones(datos.direcciones, direccionesNuevas);
      cambios.direccionId = idsNuevas[0];
      cambios.direccionesIds = idsNuevas;
      if (afiliadoActual.parentesco !== 'Titular') {
        cambios.comparteDomicilioTitular = false;
      }
      delete cambios.direcciones;
    } else if (!ahoraComparte && datos.direccion) {
      idsDireccionesAnteriores.push(
        ...obtenerIdsDirecciones(afiliadoActual).map(String)
      );
      const direccionActual = await Direccion.findById(afiliadoActual.direccionId);
      if (!direccionActual) {
        throw new ErrorAplicacion(
          'Dirección principal no encontrada',
          404,
          'DIRECCION_NO_ENCONTRADA'
        );
      }

      const direccionNueva = await crearDireccion(
        obtenerDatosDireccion(direccionActual, datos.direccion)
      );
      direccionesNuevas.push(direccionNueva);
      cambios.direccionId = direccionNueva._id;
      cambios.direccionesIds = [direccionNueva._id];
      if (afiliadoActual.parentesco !== 'Titular') {
        cambios.comparteDomicilioTitular = false;
      }
      delete cambios.direccion;
    }

    const afiliado = await Afiliado.findByIdAndUpdate(id, cambios, {
      new: true,
      runValidators: true,
    });

    if (
      afiliadoActual.parentesco === 'Titular' &&
      direccionesNuevas.length > 0
    ) {
      await propagarDomicilioDelTitular(
        afiliado,
        obtenerIdsDirecciones(afiliado)
      );
    }

    await propagarFechaBajaDelTitular(afiliadoActual, afiliado, datos);

    if (idsDireccionesAnteriores.length) {
      await eliminarDireccionesSinReferencias(idsDireccionesAnteriores);
    }

    if (datos.situacionesTerapeuticas !== undefined) {
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
  } catch (error) {
    if (direccionesNuevas.length) {
      await eliminarDireccionesSinReferencias(
        direccionesNuevas.map((direccion) => direccion._id)
      ).catch(() => {});
    }
    throw error;
  }
};

module.exports = {
  crearAfiliado,
  actualizarAfiliado,
  eliminarDireccionesSinReferencias,
};
