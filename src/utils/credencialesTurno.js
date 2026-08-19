const crypto = require('crypto');

const PREFIJO_CODIGO = 'MED-';
const LONGITUD_CODIGO = 6;
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const generarCodigoReserva = () => {
  let codigo = '';

  for (let indice = 0; indice < LONGITUD_CODIGO; indice += 1) {
    const posicion = crypto.randomInt(0, ALFABETO_CODIGO.length);
    codigo += ALFABETO_CODIGO[posicion];
  }

  return `${PREFIJO_CODIGO}${codigo}`;
};

const generarTokenGestion = () => crypto.randomBytes(32).toString('base64url');

const hashearTokenGestion = (token) =>
  crypto.createHash('sha256').update(String(token || '')).digest('hex');

const verificarTokenGestion = (token, hashEsperado) => {
  if (!token || !/^[a-f0-9]{64}$/i.test(String(hashEsperado || ''))) {
    return false;
  }

  const hashCalculado = Buffer.from(hashearTokenGestion(token), 'hex');
  const hashGuardado = Buffer.from(String(hashEsperado), 'hex');

  return (
    hashCalculado.length === hashGuardado.length &&
    crypto.timingSafeEqual(hashCalculado, hashGuardado)
  );
};

module.exports = {
  generarCodigoReserva,
  generarTokenGestion,
  hashearTokenGestion,
  verificarTokenGestion,
};
