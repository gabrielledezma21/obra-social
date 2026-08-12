const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerFile = require('../swagger-output.json');
const { mongo } = require('./config');
const { prestadorRutas, especialidadRutas, agendaRutas, afiliadoRutas, situacionTerapeuticaRutas } = require("./routes");
const { logRequest } = require("./middlewares/genericMiddleware");

const APP = express();

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origen no permitido por CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
};

const ensureDatabase = async (req, res, next) => {
  try {
    await mongo.conectarDB();
    next();
  } catch (error) {
    next(error);
  }
};

const configureApp = (app) => {
  app.disable('x-powered-by');
  app.use(cors(corsOptions));
  app.use(express.json());

  app.get('/', (req, res) => {
    res.json({
      name: 'MedIntegral API',
      status: 'online',
      documentation: '/doc',
      health: '/health',
    });
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'medintegral-api' });
  });

  // Swagger 2 usa el host de la petición cuando no se fija uno explícitamente.
  delete swaggerFile.host;
  delete swaggerFile.schemes;
  app.use('/doc', swaggerUi.serve, swaggerUi.setup(swaggerFile));

  app.use(ensureDatabase);
  app.use(logRequest);

  //rutas
  app.use("/prestadores", prestadorRutas);
  app.use("/especialidades", especialidadRutas);
  app.use("/agendas", agendaRutas);
  app.use("/afiliados", afiliadoRutas);
  app.use("/situaciones-terapeuticas", situacionTerapeuticaRutas);

  app.use(
    (err, req, res, next) => {
      console.error({ method: req.method, url: req.url, error: err.message });
      res.status(err.statusCode || 500).json({ error: err.message, code: err.code ?? null });
    }
  );

  return app;
};

configureApp(APP);

module.exports = APP;
module.exports.configureApp = configureApp;
