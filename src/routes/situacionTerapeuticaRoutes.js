const { Router } = require("express");
const router = Router();
const { situacionTerapeuticaController } = require("../controllers");

router.get('/',
  /* 
    #swagger.tags = ['Situaciones Terapeuticas']
    #swagger.path = '/situaciones-terapeuticas'
    #swagger.description = 'Obtener todas las situaciones terapéuticas disponibles'
  */
  situacionTerapeuticaController.getSituacionesTerapeuticas
);

module.exports = router;