const Prestador = require('./prestador');
const CentroDeAtencion = require('./centroDeAtencion');
const Direccion = require('./direccion');
const { Horario } = require('./horario');
const Especialidad = require('./especialidad');
const Agenda = require('./agenda');
const Afiliado = require('./afiliado');
const SituacionTerapeutica = require('./situacionTerapeutica');

module.exports = {
  Prestador,
  CentroDeAtencion,
  Direccion,
  Horario,
  Especialidad, 
  Agenda,
  Afiliado,
  SituacionTerapeutica
}