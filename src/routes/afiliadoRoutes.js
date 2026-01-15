const { Router } = require("express");
const router = Router();
const { afiliadoController } = require("../controllers");
const { genericMiddleware, afiliadoMiddleware } = require("../middlewares");
const { Afiliado } = require("../models");

router.get('/',
  /* 
    #swagger.tags = ['Afiliados']
    #swagger.path = '/afiliados'
  */
  genericMiddleware.existsAnyByModel(Afiliado),
  afiliadoController.getAfiliados
);

router.get('/:id',
  /* 
    #swagger.tags = ['Afiliados']
    #swagger.path = '/afiliados/{id}'
    #swagger.description = 'Obtener un afiliado por su ID'
    #swagger.responses[200] = { description: 'Afiliado encontrado' }
    #swagger.responses[404] = { description: 'Afiliado no encontrado' }
  */
  genericMiddleware.existsModelById(Afiliado),
  afiliadoController.getAfiliadoById
);

router.post('/',
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
  afiliadoMiddleware.notExistsAfiliado,
  // genericMiddleware.validarCamposExactos(Afiliado),
  afiliadoController.createAfiliado
);

router.delete('/:id',
  /* 
    #swagger.tags = ['Afiliados']
    #swagger.path = '/afiliados/{id}'
  */
  genericMiddleware.existsModelById(Afiliado),
  afiliadoController.deleteAfiliado
);

router.put('/:id',
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
  genericMiddleware.existsModelById(Afiliado),
  // genericMiddleware.validarCamposExactos(Afiliado),
  afiliadoController.updateAfiliado
);

module.exports = router;
