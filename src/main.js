const EXPRESS = require('express');
const APP = EXPRESS();
const CORS = require('cors');
const { mongo, redis } = require('./config');
const { configureApp } = require('./app');
require('dotenv').config();
const swaggerUi = require('swagger-ui-express');
const swaggerFile = require('../swagger-output.json'); // generado por swagger-autogen


const PORT = process.env.PORT || 3002;

APP.use(CORS({
  origin: '*',  //'http://localhost:5173', 'https://medintegral.vmdigitai.com/api'
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

APP.use(EXPRESS.json());
// Configuro rutas y middlewares desde app.js
configureApp(APP);

APP.use('/doc', swaggerUi.serve, swaggerUi.setup(swaggerFile));

APP.listen(PORT, async (err) => {
  if (err) {
    console.error(err.message);
    process.exit(1);
  }
  try {
    // Conexión a Redis
    await redis.conectarRedis();
    // Conexión a MongoDB
    await mongo.conectarDB();
  } catch (dbError) {
    console.error(dbError.message);
    process.exit(1);
  }
  console.log(`Servidor escuchando en http://localhost:${PORT}`)
});

module.exports = { APP };