const { Router } = require("express");
const router = Router();
const { prestadorController } = require("../controllers");
const { genericMiddleware, prestadorMiddleware } = require("../middlewares");
const { Prestador, Direccion } = require("../models");

router.get('/',
  /* 
    #swagger.tags = ['Prestadores']
    #swagger.path = '/prestadores'
  */
  genericMiddleware.existsAnyByModel(Prestador),
  prestadorController.getPrestadores
);

router.get('/provincias', async (req, res, next) => {
  try {
    const provincias = await Direccion.distinct('provincia');
    res.status(200).json(provincias.filter(Boolean).sort().map((nombre) => ({ id: nombre, nombre })));
  } catch (error) {
    next(error);
  }
});

router.get('/localidades', async (req, res, next) => {
  try {
    const localidades = await Direccion.distinct('localidad');
    res.status(200).json(localidades.filter(Boolean).sort().map((nombre) => ({ id: nombre, nombre })));
  } catch (error) {
    next(error);
  }
});

router.get('/:id',
  /* 
    #swagger.tags = ['Prestadores']
    #swagger.path = '/prestadores/{id}'
  */
  genericMiddleware.existsModelById(Prestador),
  prestadorController.getPrestadorById
);

router.post('/',
  /* 
    #swagger.tags = ['Prestadores']
    #swagger.path = '/prestadores'
    #swagger.parameters['body'] = {
        in: 'body',
        description: 'Datos del nuevo prestador',
        required: true,
        schema: { $ref: "#/definitions/PrestadorInput" }
    }
    #swagger.responses[201] = { description: 'Prestador creado exitosamente' }
    #swagger.responses[400] = { description: 'Datos inválidos o prestador ya existe' }
  */
  prestadorMiddleware.notExistsPrestador,
  genericMiddleware.validarCamposExactos(Prestador),
  prestadorController.createPrestador
);

router.delete('/:id',
  /* 
    #swagger.tags = ['Prestadores']
    #swagger.path = '/prestadores/{id}'
  */
  genericMiddleware.existsModelById(Prestador),
  prestadorController.deletePrestador
);

router.put('/:id',
  /* 
    #swagger.tags = ['Prestadores']
    #swagger.path = '/prestadores/{id}'
    #swagger.parameters['body'] = {
        in: 'body',
        description: 'Datos del prestador a modificar',
        required: true,
        schema: { $ref: "#/definitions/PrestadorUpdateInput" }
    }
  */
  genericMiddleware.existsModelById(Prestador),
  genericMiddleware.validarCamposExactos(Prestador),
  prestadorController.updatePrestador
);

module.exports = router;
