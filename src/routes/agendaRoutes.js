const { Router } = require("express");
const router = Router();
const { agendaController } = require("../controllers");
const { genericMiddleware, agendaMiddleware } = require("../middlewares");
const { Agenda } = require("../models");

router.get('/',
  /* 
    #swagger.tags = ['Agendas']
    #swagger.path = '/agendas'
  */
  genericMiddleware.existsAnyByModel(Agenda),
  agendaController.getAgendas
);

router.get('/:id',
  /* 
    #swagger.tags = ['Agendas']
    #swagger.path = '/agendas/{id}'
  */
  genericMiddleware.existsModelById(Agenda),
  agendaController.getAgendaById
);

router.post('/',
  /* 
    #swagger.tags = ['Agendas']
    #swagger.path = '/agendas'
  */
  //agendaMiddleware.notExistsAgenda,
  genericMiddleware.validarCamposExactos(Agenda),
  agendaController.createAgenda
);

router.delete('/:id',
  /* 
    #swagger.tags = ['Agendas']
    #swagger.path = '/agendas/{id}'
  */
  genericMiddleware.existsModelById(Agenda),
  agendaController.deleteAgenda
);

router.put('/:id',
  /* 
    #swagger.tags = ['Agendas']
    #swagger.path = '/agendas/{id}'
  */
  genericMiddleware.existsModelById(Agenda),
  genericMiddleware.validarCamposExactos(Agenda),
  agendaController.updateAgenda
);

module.exports = router;