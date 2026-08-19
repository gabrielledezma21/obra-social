const crypto = require('node:crypto');

const PREFIJO_CODIGO_RESERVA = 'MED';
const LONGITUD_CODIGO = 6;
const LONGITUD_TOKEN_BYTES = 32;

const normalizarCodigoReserva = (valor) =>
  String(valor || '')
    .trim()
    .toUpperCase();

const generarCodigoReserva = () => {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(LONGITUD_CODIGO);
  let codigo = '';

  for (let indice = 0; indice < LONGITUD_CODIGO; indice += 1) {
    codigo += alfabeto[bytes[indice] % alfabeto.length];
  }

  return `${PREFIJO_CODIGO_RESERVA}-${codigo}`;
};

const generarTokenGestion = () =>
  crypto.randomBytes(LONGITUD_TOKEN_BYTES).toString('base64url');

const obtenerHashTokenGestion = (token) =>
  crypto.createHash('sha256').update(String(token || '')).digest('hex');

const crearCredencialesGestionTurno = () => {
  const tokenGestion = generarTokenGestion();
  return {
    codigoReserva: generarCodigoReserva(),
    tokenGestion,
    tokenGestionHash: obtenerHashTokenGestion(tokenGestion),
    tokenGestionCreadoEn: new Date(),
  };
};

const tokenGestionCoincide = (token, hashEsperado) => {
  if (!token || !hashEsperado) return false;

  const hashRecibido = obtenerHashTokenGestion(token);
  const recibido = Buffer.from(hashRecibido, 'hex');
  const esperado = Buffer.from(hashEsperado, 'hex');

  if (recibido.length !== esperado.length) return false;
  return crypto.timingSafeEqual(recibido, esperado);
};

const crearEntradaHistorial = ({
  accion,
  actorRol,
  actorId = null,
  fechaAnterior = null,
  horaAnterior = null,
  fechaNueva = null,
  horaNueva = null,
  motivo = '',
}) => ({
  accion,
  actorRol,
  actorId,
  fechaAnterior,
  horaAnterior,
  fechaNueva,
  horaNueva,
  motivo: String(motivo || '').trim(),
  registradoEn: new Date(),
});

module.exports = {
  crearCredencialesGestionTurno,
  crearEntradaHistorial,
  generarCodigoReserva,
  generarTokenGestion,
  normalizarCodigoReserva,
  obtenerHashTokenGestion,
  tokenGestionCoincide,
};
