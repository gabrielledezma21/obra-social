require('dotenv').config();

process.env.NODE_ENV = 'test';

const mostrarLogsPruebas = process.env.LOG_PRUEBAS === 'true';

if (!mostrarLogsPruebas) {
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
}
