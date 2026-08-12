const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerFile = require('../swagger-output.json');
const { mongo } = require('./config');
const { prestadorRutas, especialidadRutas, agendaRutas, afiliadoRutas, situacionTerapeuticaRutas } = require("./routes");
const { logRequest } = require("./middlewares/genericMiddleware");
const { runSeed } = require('./reiniciarDB');

const APP = express();
let demoSeedPromise;

const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean);
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origen no permitido por CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
};

const ensureDatabase = async (req, res, next) => {
  try {
    await mongo.conectarDB();
    if (process.env.SEED_DEMO_DATA === 'true') {
      demoSeedPromise ??= runSeed({ clean: false });
      await demoSeedPromise;
    }
    next();
  } catch (error) { next(error); }
};

const configureApp = (app) => {
  app.disable('x-powered-by');
  app.use(cors(corsOptions));
  app.use(express.json());
  app.get('/', (req, res) => res.json({ name: 'MedIntegral API', status: 'online', documentation: '/doc', health: '/health' }));
  app.get('/health', (req, res) => res.json({ status: 'ok', service: 'medintegral-api' }));
  delete swaggerFile.host;
  delete swaggerFile.schemes;
  app.use('/doc', swaggerUi.serve, swaggerUi.setup(swaggerFile));
  app.use(ensureDatabase);
  app.use(logRequest);
  app.use("/prestadores", prestadorRutas);
  app.use("/especialidades", especialidadRutas);
  app.use("/agendas", agendaRutas);
  app.use("/afiliados", afiliadoRutas);
  app.use("/situaciones-terapeuticas", situacionTerapeuticaRutas);

  app.use((err, req, res, next) => {
    let status = err.statusCode || err.status || 500;
    let code = err.code ?? null;
    let message = err.message || 'Error interno del servidor';

    if (err.name === 'ValidationError') {
      status = 400;
      code = 'VALIDACION_INVALIDA';
      message = Object.values(err.errors || {}).map((item) => item.message).join('. ') || message;
    } else if (err.name === 'CastError') {
      status = 400;
      code = 'ID_INVALIDO';
      message = `El valor '${err.value}' no es válido para ${err.path}`;
    } else if (err.code === 11000) {
      status = 409;
      code = 'DATO_DUPLICADO';
      const field = Object.keys(err.keyPattern || err.keyValue || {})[0];
      message = field ? `Ya existe un registro con el mismo valor de ${field}` : 'El registro ya existe';
    }

    console.error({ method: req.method, url: req.url, status, code, error: message });
    res.status(status).json({
      error: message,
      message,
      code,
      ...(err.existingAgendaId ? { existingAgendaId: err.existingAgendaId } : {})
    });
  });
  return app;
};

configureApp(APP);
module.exports = APP;
module.exports.configureApp = configureApp;
