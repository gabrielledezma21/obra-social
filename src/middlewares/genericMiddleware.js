const mongoose = require('mongoose');
const ErrorAplicacion = require('../exceptions/appError');

const CAMPOS_SENSIBLES = new Set([
  'contrasena',
  'contraseña',
  'contrasenaactual',
  'contraseñaactual',
  'contrasenanueva',
  'contraseñanueva',
  'password',
  'passwordactual',
  'passwordnuevo',
  'token',
  'accesstoken',
  'refreshtoken',
  'hashcontrasena',
  'secret',
  'secreto',
]);

const ocultarDatosSensibles = (valor) => {
  if (Array.isArray(valor)) {
    return valor.map((elemento) => ocultarDatosSensibles(elemento));
  }

  if (!valor || typeof valor !== 'object') return valor;

  return Object.fromEntries(
    Object.entries(valor).map(([clave, contenido]) => {
      const claveNormalizada = clave.toLocaleLowerCase('es');
      return [
        clave,
        CAMPOS_SENSIBLES.has(claveNormalizada)
          ? '[OCULTO]'
          : ocultarDatosSensibles(contenido),
      ];
    })
  );
};

// Se utiliza para ver qué petición se hizo y qué se envió sin exponer credenciales.
const logRequest = (peticion, _respuesta, siguiente) => {
  console.log({
    method: peticion.method,
    url: peticion.url,
    fechaHora: new Date(),
    body: ocultarDatosSensibles(peticion.body),
    params: ocultarDatosSensibles(peticion.params),
  });
  siguiente();
};

// Se utiliza para verificar que al menos exista una instancia de ese modelo en la base de datos.
const existsAnyByModel = (modelo) => {
  return async (_peticion, _respuesta, siguiente) => {
    try {
      const datos = await modelo.findOne();
      if (!datos) {
        return siguiente(
          new ErrorAplicacion(
            `No hay ningun ${modelo.modelName} registrado`,
            404,
            'NO_HAY_NINGUNO_REGISTRADO'
          )
        );
      }
      siguiente();
    } catch (error) {
      return siguiente(error);
    }
  };
};

// Se utiliza para verificar que exista una instancia de ese modelo en la base de datos.
const existsModelById = (modelo) => {
  return async (peticion, _respuesta, siguiente) => {
    try {
      const datos = await modelo.findById(peticion.params.id);
      if (!datos) {
        return siguiente(
          new ErrorAplicacion(
            `No hay ningun ${modelo.modelName} con id ${peticion.params.id}`,
            404,
            'NO_HAY_NINGUNO_CON_ESE_ID'
          )
        );
      }
      siguiente();
    } catch (error) {
      return siguiente(error);
    }
  };
};

const validarCamposExactos = (modelo) => {
  return (peticion, _respuesta, siguiente) => {
    const camposValidos = Object.keys(modelo.schema.paths);
    const camposRecibidos = Object.keys(peticion.body);
    const camposInvalidos = camposRecibidos.filter(
      (campo) => !camposValidos.includes(campo)
    );

    if (camposInvalidos.length > 0) {
      return siguiente(
        new ErrorAplicacion('Hay campos inválidos', 400, 'CAMPOS_INVALIDOS')
      );
    }
    siguiente();
  };
};

module.exports = {
  logRequest,
  existsAnyByModel,
  existsModelById,
  validarCamposExactos,
  ocultarDatosSensibles,
};
