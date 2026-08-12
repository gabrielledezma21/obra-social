const { Agenda } = require("../models");
const AppError = require("../exceptions/appError");
const createAgenda = async (data) => {
  return Agenda.create({
    especialidadId: data.especialidadId,
    centroDeAtencionId: data.centroDeAtencionId,
    prestadorId: data.prestadorId,
    horario: data.horario
  });
};

const updateAgenda = async (id, data) => {
  const agenda = await Agenda.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!agenda) throw new AppError('Agenda no encontrada', 404, 'AGENDA_NO_ENCONTRADA');
  return agenda;
};

module.exports = { createAgenda, updateAgenda };
