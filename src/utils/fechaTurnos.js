const ZONA_HORARIA_ARGENTINA = 'America/Argentina/Buenos_Aires';
const DESPLAZAMIENTO_ARGENTINA = '-03:00';

const CLAVES_DIAS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miercoles',
  'Jueves',
  'Viernes',
  'Sabado',
];

const obtenerPartesFecha = (valorFecha) => {
  const texto = String(valorFecha || '').trim();
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!coincidencia) return null;

  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia, 12, 0, 0));

  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    return null;
  }

  return { texto, anio, mes, dia };
};

const esFechaValida = (valorFecha) => Boolean(obtenerPartesFecha(valorFecha));

const crearFechaPersistencia = (valorFecha) => {
  const partes = obtenerPartesFecha(valorFecha);
  if (!partes) return null;

  return new Date(Date.UTC(partes.anio, partes.mes - 1, partes.dia, 12, 0, 0));
};

const formatearFechaPersistida = (valorFecha) => {
  const fecha = new Date(valorFecha);
  if (Number.isNaN(fecha.getTime())) return '';

  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(
    2,
    '0'
  )}-${String(fecha.getUTCDate()).padStart(2, '0')}`;
};

const obtenerFechaActualArgentina = (ahora = new Date()) => {
  const partes = new Intl.DateTimeFormat('en', {
    timeZone: ZONA_HORARIA_ARGENTINA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora);

  const obtener = (tipo) => partes.find((parte) => parte.type === tipo)?.value;
  return `${obtener('year')}-${obtener('month')}-${obtener('day')}`;
};

const sumarDias = (valorFecha, cantidadDias) => {
  const fecha = crearFechaPersistencia(valorFecha);
  if (!fecha) return '';

  fecha.setUTCDate(fecha.getUTCDate() + Number(cantidadDias || 0));
  return formatearFechaPersistida(fecha);
};

const obtenerClaveDia = (valorFecha) => {
  const fecha = crearFechaPersistencia(valorFecha);
  return fecha ? CLAVES_DIAS[fecha.getUTCDay()] : '';
};

const crearFechaHoraArgentina = (valorFecha, hora) => {
  if (!esFechaValida(valorFecha) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(hora))) {
    return null;
  }

  const fechaHora = new Date(
    `${String(valorFecha)}T${String(hora)}:00${DESPLAZAMIENTO_ARGENTINA}`
  );
  return Number.isNaN(fechaHora.getTime()) ? null : fechaHora;
};

const esTurnoProximo = (turno, ahora = new Date()) => {
  if (turno?.estado !== 'RESERVADO') return false;

  const fechaTexto = formatearFechaPersistida(turno.fecha);
  const fechaHoraTurno = crearFechaHoraArgentina(fechaTexto, turno.hora);
  return Boolean(fechaHoraTurno && fechaHoraTurno.getTime() >= ahora.getTime());
};

const obtenerRangoDiaUtc = (valorFecha) => {
  const partes = obtenerPartesFecha(valorFecha);
  if (!partes) return null;

  const inicio = new Date(Date.UTC(partes.anio, partes.mes - 1, partes.dia, 0, 0, 0));
  const fin = new Date(inicio);
  fin.setUTCDate(fin.getUTCDate() + 1);
  return { inicio, fin };
};

module.exports = {
  CLAVES_DIAS,
  ZONA_HORARIA_ARGENTINA,
  crearFechaHoraArgentina,
  crearFechaPersistencia,
  esFechaValida,
  esTurnoProximo,
  formatearFechaPersistida,
  obtenerClaveDia,
  obtenerFechaActualArgentina,
  obtenerRangoDiaUtc,
  sumarDias,
};
