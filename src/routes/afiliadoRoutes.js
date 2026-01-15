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
    */
    genericMiddleware.existsModelById(Afiliado),
    // genericMiddleware.validarCamposExactos(Afiliado),
    afiliadoController.updateAfiliado
);

module.exports = router;
