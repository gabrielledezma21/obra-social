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
  */
  //prestadorMiddleware.notExistsPrestador,
  //genericMiddleware.validarCamposExactos(Prestador),
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

module.exports = router;
