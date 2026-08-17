const criptografia = require('crypto');
const ErrorAplicacion = require('../exceptions/appError');
const Usuario = require('../models/usuario');

const obtenerSecreto = () =>
  process.env.SECRETO_AUTENTICACION || 'medintegral-desarrollo-cambiar-secreto';

const firmarToken = (datosToken) => {
  const cuerpo = Buffer.from(JSON.stringify({
    ...datosToken,
    venceEn: Date.now() + 1000 * 60 * 60 * 12,
  })).toString('base64url');
  const firma = criptografia
    .createHmac('sha256', obtenerSecreto())
    .update(cuerpo)
    .digest('base64url');

  return `${cuerpo}.${firma}`;
};

const verificarToken = (token) => {
  const [cuerpo, firma] = String(token || '').split('.');
  if (!cuerpo || !firma) {
    throw new ErrorAplicacion('Token inválido', 401, 'TOKEN_INVALIDO');
  }

  const firmaEsperada = criptografia
    .createHmac('sha256', obtenerSecreto())
    .update(cuerpo)
    .digest('base64url');
  const bytesFirmaRecibida = Buffer.from(firma);
  const bytesFirmaEsperada = Buffer.from(firmaEsperada);

  if (
    bytesFirmaRecibida.length !== bytesFirmaEsperada.length ||
    !criptografia.timingSafeEqual(bytesFirmaRecibida, bytesFirmaEsperada)
  ) {
    throw new ErrorAplicacion('Token inválido', 401, 'TOKEN_INVALIDO');
  }

  let datosToken;
  try {
    datosToken = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
  } catch {
    throw new ErrorAplicacion('Token inválido', 401, 'TOKEN_INVALIDO');
  }

  if (!datosToken?.usuarioId || !datosToken?.venceEn) {
    throw new ErrorAplicacion('Token inválido', 401, 'TOKEN_INVALIDO');
  }
  if (datosToken.venceEn < Date.now()) {
    throw new ErrorAplicacion('La sesión expiró', 401, 'TOKEN_EXPIRADO');
  }

  return datosToken;
};

const autenticar = async (peticion, _respuesta, siguiente) => {
  try {
    const token = peticion.headers.authorization?.replace(/^Bearer\s+/i, '');
    const datosToken = verificarToken(token);
    const usuario = await Usuario.findById(datosToken.usuarioId);

    if (!usuario?.activo) {
      throw new ErrorAplicacion(
        'Usuario no autorizado',
        401,
        'USUARIO_NO_AUTORIZADO'
      );
    }

    peticion.usuario = usuario;
    siguiente();
  } catch (error) {
    siguiente(error);
  }
};

const requerirRol = (...rolesPermitidos) => (peticion, _respuesta, siguiente) =>
  rolesPermitidos.includes(peticion.usuario?.rol)
    ? siguiente()
    : siguiente(
        new ErrorAplicacion(
          'No tenés permisos para realizar esta operación',
          403,
          'PERMISO_DENEGADO'
        )
      );

const requerirContrasenaActualizada = (peticion, _respuesta, siguiente) =>
  peticion.usuario?.debeCambiarContrasena
    ? siguiente(
        new ErrorAplicacion(
          'Debés cambiar tu contraseña antes de continuar',
          403,
          'CAMBIO_CONTRASENA_REQUERIDO'
        )
      )
    : siguiente();

module.exports = {
  autenticar,
  requerirRol,
  requerirContrasenaActualizada,
  firmarToken,
  verificarToken,
};
