const { Router } = require("express");
const router = Router();
const { especialidadController } = require("../controllers");

router.get('/',
  /* 
    #swagger.tags = ['Especialidades']
    #swagger.path = '/especialidades'
  */
  especialidadController.getEspecialidades
);

module.exports = router;