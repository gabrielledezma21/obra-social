const { Afiliado, Direccion, SituacionTerapeutica } = require('../models');
const Usuario = require('../models/usuario');
const Solicitud = require('../models/solicitud');
const Turno = require('../models/turno');
const {
  HistoriaClinica,
  SituacionAfiliado,
} = require('../models/historiaClinica');
const ErrorAplicacion = require('../exceptions/appError');
const { redisClient: clienteRedis } = require('../config/redisClient');
const {
  getModelsCache: obtenerCacheModelos,
  getModelCacheById: obtenerCacheModeloPorId,
  deleteModelsCache: eliminarCacheModelos,
  deleteModelCacheById: eliminarCacheModeloPorId,
} = require('./genericController');
const servicioAfiliado = require('../services/afiliadoService');

const completarAfiliado = (consulta) =>
  consulta
    .populate('situacionesTerapeuticas')
    .populate('direccionId')
    .populate('direccionesIds')
    .populate({
      path: 'familiares',
      populate: [
        { path: 'direccionId' },
        { path: 'direccionesIds' },
        { path: 'situacionesTerapeuticas' },
      ],
    })
    .populate(
      'afiliadoTitularId',
      'numeroAfiliado numeroIntegrante nombre apellido'
    );

const construirConsultaBusqueda = async (parametros = {}) => {
  const filtros = {};

  if (parametros.apellido) {
    filtros.apellido = { $regex: parametros.apellido, $options: 'i' };
  }

  if (parametros.fechaNacimiento) {
    const inicio = new Date(parametros.fechaNacimiento);
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 1);
    filtros.fechaNacimiento = { $gte: inicio, $lt: fin };
  }

  if (parametros.credencial) {
    const [numero, integrante] = String(parametros.credencial).split('-');
    if (numero) filtros.numeroAfiliado = Number(numero);
    if (integrante) filtros.numeroIntegrante = Number(integrante);
  }

  if (parametros.direccion) {
    const direcciones = await Direccion.find({
      $or: [
        { calle: { $regex: parametros.direccion, $options: 'i' } },
        { localidad: { $regex: parametros.direccion, $options: 'i' } },
        { codigoPostal: { $regex: parametros.direccion, $options: 'i' } },
      ],
    }).select('_id');
    const idsDirecciones = direcciones.map((direccion) => direccion._id);
    filtros.$or = [
      { direccionId: { $in: idsDirecciones } },
      { direccionesIds: { $in: idsDirecciones } },
    ];
  }

  if (parametros.desde || parametros.hasta) {
    filtros.fechaAlta = {};
    if (parametros.desde) {
      filtros.fechaAlta.$gte = new Date(parametros.desde);
    }
    if (parametros.hasta) {
      const fin = new Date(parametros.hasta);
      fin.setDate(fin.getDate() + 1);
      filtros.fechaAlta.$lt = fin;
    }
  }

  return filtros;
};

const obtenerAfiliados = async (peticion, respuesta) => {
  const tieneFiltros = Object.keys(peticion.query || {}).length > 0;
  const cache = tieneFiltros ? null : await obtenerCacheModelos(Afiliado);
  const filtros = tieneFiltros
    ? await construirConsultaBusqueda(peticion.query)
    : {};
  const afiliados = cache
    ? JSON.parse(cache)
    : await Afiliado.find(filtros)
        .populate('situacionesTerapeuticas')
        .populate('direccionId')
        .populate('direccionesIds');

  if (!tieneFiltros) {
    await clienteRedis.set(
      'Afiliados:todos',
      JSON.stringify(afiliados),
      { EX: 60 }
    );
  }

  respuesta.status(200).json(afiliados);
};

const obtenerAfiliadoPorId = async (peticion, respuesta) => {
  const cache = await obtenerCacheModeloPorId(Afiliado, peticion.params.id);
  const afiliado = cache
    ? JSON.parse(cache)
    : await completarAfiliado(Afiliado.findById(peticion.params.id));

  await clienteRedis.set(
    `Afiliado:${peticion.params.id}`,
    JSON.stringify(afiliado),
    { EX: 60 }
  );
  respuesta.status(200).json(afiliado);
};

const crearAfiliado = async (peticion, respuesta) => {
  const afiliadoCreado = await servicioAfiliado.crearAfiliado(peticion.body);
  const afiliado = await completarAfiliado(
    Afiliado.findById(afiliadoCreado._id)
  );

  await clienteRedis.set(
    `Afiliado:${afiliado._id}`,
    JSON.stringify(afiliado),
    { EX: 60 }
  );
  await eliminarCacheModelos(Afiliado);

  if (afiliado.afiliadoTitularId?._id) {
    await eliminarCacheModeloPorId(
      Afiliado,
      afiliado.afiliadoTitularId._id
    );
  }

  respuesta.status(201).json(afiliado);
};

const limpiarDirecciones = async (integrantes) => {
  const idsDirecciones = [
    ...new Set(
      integrantes.flatMap((integrante) =>
        [integrante.direccionId, ...(integrante.direccionesIds || [])]
          .filter(Boolean)
          .map(String)
      )
    ),
  ];

  if (idsDirecciones.length) {
    await Direccion.deleteMany({ _id: { $in: idsDirecciones } });
  }
};

const existeHistorialOperativo = async (idsIntegrantes) => {
  const filtrosAfiliado = { $in: idsIntegrantes };
  const resultados = await Promise.all([
    Usuario.exists({ afiliadoId: filtrosAfiliado }),
    Solicitud.exists({
      $or: [
        { afiliadoId: filtrosAfiliado },
        { creadorAfiliadoId: filtrosAfiliado },
      ],
    }),
    Turno.exists({
      $or: [
        { afiliadoId: filtrosAfiliado },
        { reservadoPorAfiliadoId: filtrosAfiliado },
      ],
    }),
    HistoriaClinica.exists({ afiliadoId: filtrosAfiliado }),
    SituacionAfiliado.exists({ afiliadoId: filtrosAfiliado }),
  ]);

  return resultados.some(Boolean);
};

const eliminarAfiliado = async (peticion, respuesta) => {
  const afiliado = await Afiliado.findById(peticion.params.id);
  const integrantes =
    afiliado.parentesco === 'Titular'
      ? await Afiliado.find({
          $or: [
            { _id: afiliado._id },
            { afiliadoTitularId: afiliado._id },
          ],
        })
      : [afiliado];
  const idsIntegrantes = integrantes.map((integrante) => integrante._id);

  if (await existeHistorialOperativo(idsIntegrantes)) {
    throw new ErrorAplicacion(
      'No se puede eliminar físicamente un afiliado que tiene historial operativo o clínico. Utilizá la fecha de baja para conservar su historial.',
      409,
      'AFILIADO_CON_HISTORIAL'
    );
  }

  await Afiliado.deleteMany({ _id: { $in: idsIntegrantes } });
  await SituacionTerapeutica.updateMany(
    { afiliados: { $in: idsIntegrantes } },
    { $pull: { afiliados: { $in: idsIntegrantes } } }
  );
  await limpiarDirecciones(integrantes);
  await eliminarCacheModelos(Afiliado);
  await Promise.all(
    idsIntegrantes.map((id) => eliminarCacheModeloPorId(Afiliado, id))
  );

  if (afiliado.afiliadoTitularId) {
    await eliminarCacheModeloPorId(Afiliado, afiliado.afiliadoTitularId);
  }

  respuesta.status(204).send();
};

const obtenerIdsGrupoParaCache = async (afiliadoActual, peticion) => {
  const cambiaFechaBaja = Object.prototype.hasOwnProperty.call(
    peticion.body,
    'fechaBaja'
  );
  const afectaGrupo = peticion.body.aplicarAGrupoFamiliar || cambiaFechaBaja;

  if (!afectaGrupo || afiliadoActual?.parentesco !== 'Titular') {
    return [];
  }

  const integrantes = await Afiliado.find({
    $or: [
      { _id: afiliadoActual._id },
      { afiliadoTitularId: afiliadoActual._id },
    ],
  }).select('_id');

  return integrantes.map((integrante) => integrante._id);
};

const actualizarAfiliado = async (peticion, respuesta) => {
  const afiliadoActual = await Afiliado.findById(peticion.params.id);
  const idsGrupo = await obtenerIdsGrupoParaCache(afiliadoActual, peticion);

  await servicioAfiliado.actualizarAfiliado(
    peticion.params.id,
    peticion.body
  );
  const afiliado = await completarAfiliado(
    Afiliado.findById(peticion.params.id)
  );

  const idsCache = new Set([
    String(peticion.params.id),
    ...idsGrupo.map(String),
  ]);
  if (afiliadoActual?.afiliadoTitularId) {
    idsCache.add(String(afiliadoActual.afiliadoTitularId));
  }

  await eliminarCacheModelos(Afiliado);
  await Promise.all(
    [...idsCache].map((id) => eliminarCacheModeloPorId(Afiliado, id))
  );

  await clienteRedis.set(
    `Afiliado:${afiliado._id}`,
    JSON.stringify(afiliado),
    { EX: 60 }
  );
  respuesta.status(200).json(afiliado);
};

module.exports = {
  obtenerAfiliados,
  obtenerAfiliadoPorId,
  crearAfiliado,
  eliminarAfiliado,
  actualizarAfiliado,
};
