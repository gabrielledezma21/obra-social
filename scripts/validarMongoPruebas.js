const mongoose = require('mongoose');

const uriPruebas = process.env.MONGO_URI_TEST;

const obtenerNombreBase = (uri = '') => {
  const sinConsulta = uri.split('?')[0].replace(/\/$/, '');
  return sinConsulta.slice(sinConsulta.lastIndexOf('/') + 1);
};

const finalizarConError = (mensaje, error = null) => {
  console.error(`\n❌ ${mensaje}`);
  if (error?.codeName || error?.code) {
    console.error(
      `   MongoDB: ${error.codeName || 'Error'}${error.code ? ` (${error.code})` : ''}`
    );
  }
  process.exitCode = 1;
};

const validarMongoPruebas = async () => {
  if (!uriPruebas) {
    finalizarConError(
      'Debés definir MONGO_URI_TEST antes de ejecutar npm test.'
    );
    return;
  }

  const nombreBase = obtenerNombreBase(uriPruebas);
  if (!/(test|prueba)/i.test(nombreBase)) {
    finalizarConError(
      `La base de pruebas debe contener "test" o "prueba" en su nombre. Recibido: ${nombreBase || '(sin nombre)'}.`
    );
    return;
  }

  const conexion = mongoose.createConnection(uriPruebas, {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await conexion.asPromise();
    await conexion.db
      .collection('__medintegral_verificacion_pruebas')
      .deleteMany({});
    console.log(`✅ MongoDB de pruebas accesible: ${nombreBase}`);
  } catch (error) {
    if (error?.code === 13 || error?.codeName === 'Unauthorized') {
      finalizarConError(
        'MongoDB exige autenticación. Configurá MONGO_URI_TEST con un usuario que tenga permisos de lectura/escritura sobre la base exclusiva de pruebas. Ejemplo: mongodb://USUARIO:CLAVE@127.0.0.1:27017/medintegral_test?authSource=admin',
        error
      );
    } else {
      finalizarConError(
        `No se pudo utilizar MongoDB de pruebas en ${nombreBase}. Revisá que el servicio esté iniciado y que MONGO_URI_TEST sea correcta.`,
        error
      );
    }
  } finally {
    await conexion.close().catch(() => {});
  }
};

validarMongoPruebas();
