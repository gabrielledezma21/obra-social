const express = require('express');
const cors = require('cors');
const interfazSwagger = require('swagger-ui-express');
const archivoSwagger = require('../swagger-output.json');
const { mongo } = require('./config');
const {
  prestadorRutas,
  especialidadRutas,
  agendaRutas,
  afiliadoRutas,
  situacionTerapeuticaRutas,
} = require('./routes');
const autenticacionRutas = require('./routes/autenticacionRutas');
const disponibilidadTurnosRutas = require('./routes/disponibilidadTurnosRutas');
const portalAfiliadoRutas = require('./routes/portalAfiliadoRutas');
const portalPrestadorRutas = require('./routes/portalPrestadorRutas');
const reporteRutas = require('./routes/reporteRutas');
const turnosPublicosRutas = require('./routes/turnosPublicosRutas');
const { logRequest: registrarPeticion } = require('./middlewares/genericMiddleware');
const {
  autenticar,
  requerirRol,
  requerirContrasenaActualizada,
} = require('./middlewares/autenticacionMiddleware');
const { runSeed: ejecutarCargaInicial } = require('./reiniciarDB');

const APLICACION = express();
let promesaCargaDemostracion;

const origenesPermitidos = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origen) => origen.trim())
  .filter(Boolean);

const opcionesCors = {
  origin(origen, responderOrigen) {
    if (
      !origen ||
      origenesPermitidos.length === 0 ||
      origenesPermitidos.includes(origen)
    ) {
      return responderOrigen(null, true);
    }
    return responderOrigen(new Error('Origen no permitido por CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const asegurarBaseDatos = async (_peticion, _respuesta, siguiente) => {
  try {
    await mongo.conectarDB();
    if (process.env.SEED_DEMO_DATA === 'true') {
      promesaCargaDemostracion ??= ejecutarCargaInicial({ limpiar: false });
      await promesaCargaDemostracion;
    }
    siguiente();
  } catch (error) {
    siguiente(error);
  }
};

const protegerAdministracion = [
  autenticar,
  requerirRol('ADMIN'),
  requerirContrasenaActualizada,
];
const protegerPortalAfiliado = [
  autenticar,
  requerirRol('AFILIADO'),
  requerirContrasenaActualizada,
];
const protegerPortalPrestador = [
  autenticar,
  requerirRol('PRESTADOR'),
  requerirContrasenaActualizada,
];

const configurarAplicacion = (aplicacion) => {
  aplicacion.disable('x-powered-by');
  aplicacion.use(cors(opcionesCors));
  aplicacion.use(express.json({ limit: '1mb' }));

  aplicacion.get('/', (_peticion, respuesta) =>
    respuesta.json({
      nombre: 'MedIntegral API',
      estado: 'en-linea',
      documentacion: '/doc',
      salud: '/health',
    })
  );
  aplicacion.get('/health', (_peticion, respuesta) =>
    respuesta.json({ estado: 'ok', servicio: 'medintegral-api' })
  );

  delete archivoSwagger.host;
  delete archivoSwagger.schemes;
  aplicacion.use(
    '/doc',
    interfazSwagger.serve,
    interfazSwagger.setup(archivoSwagger)
  );

  aplicacion.use(asegurarBaseDatos);
  aplicacion.use(registrarPeticion);
  aplicacion.use('/publico/turnos', turnosPublicosRutas);
  aplicacion.use('/autenticacion', autenticacionRutas);

  aplicacion.use('/prestadores', ...protegerAdministracion, prestadorRutas);
  aplicacion.use('/especialidades', ...protegerAdministracion, especialidadRutas);
  aplicacion.use('/agendas', ...protegerAdministracion, agendaRutas);
  aplicacion.use('/afiliados', ...protegerAdministracion, afiliadoRutas);
  aplicacion.use(
    '/situaciones-terapeuticas',
    ...protegerAdministracion,
    situacionTerapeuticaRutas
  );
  aplicacion.use('/reportes', ...protegerAdministracion, reporteRutas);

  aplicacion.use(
    '/portal-afiliado',
    ...protegerPortalAfiliado,
    disponibilidadTurnosRutas
  );
  aplicacion.use(
    '/portal-afiliado',
    ...protegerPortalAfiliado,
    portalAfiliadoRutas
  );
  aplicacion.use(
    '/portal-prestador',
    ...protegerPortalPrestador,
    portalPrestadorRutas
  );

  aplicacion.use((error, peticion, respuesta, _siguiente) => {
    let estado = error.statusCode || error.status || 500;
    let codigo = error.code ?? null;
    let mensaje = error.message || 'Error interno del servidor';

    if (error.name === 'ValidationError') {
      estado = 400;
      codigo = 'VALIDACION_INVALIDA';
      mensaje =
        Object.values(error.errors || {})
          .map((detalle) => detalle.message)
          .join('. ') || mensaje;
    } else if (error.name === 'CastError') {
      estado = 400;
      codigo = 'ID_INVALIDO';
      mensaje = `El valor '${error.value}' no es válido para ${error.path}`;
    } else if (error.code === 11000) {
      estado = 409;
      codigo = 'DATO_DUPLICADO';
      const campo = Object.keys(error.keyPattern || error.keyValue || {})[0];
      mensaje = campo
        ? `Ya existe un registro con el mismo valor de ${campo}`
        : 'El registro ya existe';
    }

    console.error({
      metodo: peticion.method,
      ruta: peticion.url,
      estado,
      codigo,
      error: mensaje,
    });

    respuesta.status(estado).json({
      error: mensaje,
      mensaje,
      codigo,
      ...(error.existingAgendaId
        ? { agendaExistenteId: error.existingAgendaId }
        : {}),
    });
  });

  return aplicacion;
};

configurarAplicacion(APLICACION);
module.exports = APLICACION;
module.exports.configurarAplicacion = configurarAplicacion;
