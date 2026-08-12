const AppError = require("../exceptions/appError");

const convertirAMinutos = (horario) => {
  if (typeof horario === 'number' && Number.isInteger(horario)) return horario;
  if (typeof horario === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(horario)) {
    const [hora, minutos] = horario.split(":").map(Number);
    return hora * 60 + minutos;
  }
  throw new AppError('Formato de horario inválido. Use HH:mm', 400, 'FORMATO_HORARIO_INVALIDO');
};

const minutosAString = (minutos) => {
  if (typeof minutos === 'number' && Number.isFinite(minutos)) {
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return `${horas.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
  throw new AppError('Formato de minutos inválido', 400, 'FORMATO_MINUTOS_INVALIDO');
};

module.exports = { convertirAMinutos, minutosAString };
