const { Router } = require("express");
const router = Router();
const { prestadorController } = require("../controllers");
const { genericMiddleware, prestadorMiddleware } = require("../middlewares");
const { Prestador } = require("../models");

router.get('/',
  /* 
    #swagger.tags = ['Prestadores']
    #swagger.path = '/prestadores'
  */
  genericMiddleware.existsAnyByModel(Prestador),
  prestadorController.getPrestadores
);

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
