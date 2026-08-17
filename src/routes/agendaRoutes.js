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
    #swagger.parameters['body'] = {
        in: 'body',
        description: 'Datos de la nueva agenda',
        required: true,
        schema: { $ref: "#/definitions/AgendaInput" }
    }
    #swagger.responses[201] = { description: 'Agenda creada exitosamente' }
    #swagger.responses[400] = { description: 'Error de validación (horario ocupado, etc.)' }
  */
  agendaMiddleware.existsPrestador,
  agendaMiddleware.existsCentroAtencion,
  agendaMiddleware.existsEspecialidad,
  agendaMiddleware.prestadorConEsaEspecialidad,
  agendaMiddleware.prestadorAtiendeEnEseCentroAtencion,
  agendaMiddleware.horarioDentroDelPrestador,
  agendaMiddleware.horarioLibre,
  agendaMiddleware.notExistsAgenda,
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
    #swagger.parameters['body'] = {
        in: 'body',
        description: 'Datos de la agenda a modificar (Solo Horario)',
        required: true,
        schema: { $ref: "#/definitions/AgendaUpdateInput" }
    }
  */
  genericMiddleware.existsModelById(Agenda),
  agendaMiddleware.restrictToHorario,
  agendaMiddleware.horarioDentroDelPrestador,
  agendaMiddleware.horarioLibre,
  agendaController.updateAgenda
);

module.exports = router;