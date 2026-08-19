const { Router } = require('express');
const { afiliadoController: controladorAfiliado } = require('../controllers');
const {
  genericMiddleware: intermediarioGenerico,
  afiliadoMiddleware: intermediarioAfiliado,
} = require('../middlewares');
const validarDomicilioCompartido = require('../middlewares/validarDomicilioCompartido');
const validarDomicilioPropio = require('../middlewares/validarDomicilioPropio');
const { Afiliado, Direccion } = require('../models');

const rutas = Router();
const existeModeloPorId = intermediarioGenerico.existsModelById;
const noExisteAfiliado = intermediarioAfiliado.notExistsAfiliado;

rutas.get(
  '/',
  /*
    #swagger.tags = ['Afiliados']
    #swagger.path = '/afiliados'
  */
  controladorAfiliado.obtenerAfiliados
);

rutas.get('/provincias', async (_peticion, respuesta, siguiente) => {
  try {
    const provincias = await Direccion.distinct('provincia');
    respuesta
      .status(200)
      .json(
        provincias
          .filter(Boolean)
          .sort()
          .map((nombre) => ({ id: nombre, nombre }))
      );
  } catch (error) {
    siguiente(error);
  }
});

rutas.get('/localidades', async (_peticion, respuesta, siguiente) => {
  try {
    const localidades = await Direccion.distinct('localidad');
    respuesta
      .status(200)
      .json(
        localidades
          .filter(Boolean)
          .sort()
          .map((nombre) => ({ id: nombre, nombre }))
      );
  } catch (error) {
    siguiente(error);
  }
});

rutas.get(
  '/:id',
  /*
    #swagger.tags = ['Afiliados']
    #swagger.path = '/afiliados/{id}'
    #swagger.description = 'Obtener un afiliado por su ID'
    #swagger.responses[200] = { description: 'Afiliado encontrado' }
    #swagger.responses[404] = { description: 'Afiliado no encontrado' }
  */
  existeModeloPorId(Afiliado),
  controladorAfiliado.obtenerAfiliadoPorId
);

rutas.post(
  '/',
  /*
    #swagger.tags = ['Afiliados']
    #swagger.path = '/afiliados'
    #swagger.parameters['body'] = {
        in: 'body',
        description: 'Datos del nuevo afiliado',
        required: true,
        schema: { $ref: "#/definitions/AfiliadoInput" }
    }
  */
  noExisteAfiliado,
  controladorAfiliado.crearAfiliado
);

rutas.delete(
  '/:id',
  /*
    #swagger.tags = ['Afiliados']
    #swagger.path = '/afiliados/{id}'
  */
  existeModeloPorId(Afiliado),
  controladorAfiliado.eliminarAfiliado
);

rutas.put(
  '/:id',
  /*
    #swagger.tags = ['Afiliados']
    #swagger.path = '/afiliados/{id}'
    #swagger.parameters['body'] = {
        in: 'body',
        description: 'Datos del afiliado a modificar',
        required: true,
        schema: { $ref: "#/definitions/AfiliadoUpdateInput" }
    }
  */
  existeModeloPorId(Afiliado),
  validarDomicilioPropio,
  validarDomicilioCompartido,
  controladorAfiliado.actualizarAfiliado
);

module.exports = rutas;
