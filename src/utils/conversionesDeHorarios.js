const AppError = require("../exceptions/appError");

const convertirAMinutos = (horario) => {
    if (typeof horario === 'number') return horario;

    if (typeof horario === 'string') {
        const [hora, minutos] = horario.split(":").map(Number);
        return hora * 60 + minutos;
    }

    throw new AppError('Formato de horario invalido', 400, 'FORMATO_HORARIO_INVALIDO');
};

const minutosAString = (minutos) => {
    if(typeof minutos === 'number' && !isNaN(minutos)){
        const horas = Math.floor(minutos / 60);
        const mins = minutos % 60;
        return `${horas.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }
    throw new AppError('Formato de minutos invalido', 400, 'FORMATO_MINUTOS_INVALIDO');
}

module.exports = { convertirAMinutos, minutosAString }; 
