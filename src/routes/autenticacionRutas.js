const { Router } = require('express');
const criptografia = require('crypto');
const Usuario = require('../models/usuario');
const { Afiliado, Prestador } = require('../models');
const ErrorAplicacion = require('../exceptions/appError');
const { firmarToken } = require('../middlewares/autenticacionMiddleware');

const rutas = Router();

const generarHashContrasena = (
  contrasena,
  sal = criptografia.randomBytes(16).toString('hex')
) => `${sal}:${criptografia.scryptSync(contrasena, sal, 64).toString('hex')}`;

const verificarContrasena = (contrasena, valorGuardado) => {
  const [sal, resumenGuardado] = String(valorGuardado || '').split(':');
  if (!sal || !resumenGuardado) return false;

  const resumenIngresado = criptografia.scryptSync(contrasena, sal, 64);
  const resumenOriginal = Buffer.from(resumenGuardado, 'hex');

  return (
    resumenOriginal.length === resumenIngresado.length &&
    criptografia.timingSafeEqual(resumenOriginal, resumenIngresado)
  );
};

rutas.post('/registro-afiliado', async (peticion, respuesta, siguiente) => {
  try {
    const { afiliadoId, email, contrasena } = peticion.body;
    if (!afiliadoId || !email || !contrasena || contrasena.length < 8) {
      throw new ErrorAplicacion(
        'Afiliado, email y contraseña de al menos 8 caracteres son obligatorios',
        400
      );
    }

    const afiliado = await Afiliado.findById(afiliadoId);
    if (!afiliado) throw new ErrorAplicacion('Afiliado no encontrado', 404);

    if (afiliado.fechaNacimiento) {
      const edad = Math.floor(
        (Date.now() - new Date(afiliado.fechaNacimiento).getTime()) /
          31557600000
      );
      if (edad < 16) {
        throw new ErrorAplicacion(
          'Solo pueden registrarse integrantes de 16 años o más',
          400,
          'EDAD_MINIMA'
        );
      }
    }

    const usuario = await Usuario.create({
      email,
      hashContrasena: generarHashContrasena(contrasena),
      rol: 'AFILIADO',
      afiliadoId,
    });

    respuesta.status(201).json({
      usuario,
      token: firmarToken({ usuarioId: usuario._id.toString(), rol: usuario.rol }),
    });
  } catch (error) {
    siguiente(error);
  }
});

rutas.post('/registro-prestador', async (peticion, respuesta, siguiente) => {
  try {
    const { prestadorId, email, contrasena } = peticion.body;
    if (!prestadorId || !email || !contrasena || contrasena.length < 8) {
      throw new ErrorAplicacion(
        'Prestador, email y contraseña de al menos 8 caracteres son obligatorios',
        400
      );
    }

    if (!(await Prestador.exists({ _id: prestadorId }))) {
      throw new ErrorAplicacion('Prestador no encontrado', 404);
    }

    const usuario = await Usuario.create({
      email,
      hashContrasena: generarHashContrasena(contrasena),
      rol: 'PRESTADOR',
      prestadorId,
    });

    respuesta.status(201).json({
      usuario,
      token: firmarToken({ usuarioId: usuario._id.toString(), rol: usuario.rol }),
    });
  } catch (error) {
    siguiente(error);
  }
});

rutas.post('/iniciar-sesion', async (peticion, respuesta, siguiente) => {
  try {
    const usuario = await Usuario.findOne({
      email: String(peticion.body.email || '').toLowerCase().trim(),
    });

    if (
      !usuario ||
      !verificarContrasena(peticion.body.contrasena, usuario.hashContrasena)
    ) {
      throw new ErrorAplicacion(
        'Credenciales inválidas',
        401,
        'CREDENCIALES_INVALIDAS'
      );
    }

    respuesta.json({
      usuario,
      token: firmarToken({ usuarioId: usuario._id.toString(), rol: usuario.rol }),
    });
  } catch (error) {
    siguiente(error);
  }
});

module.exports = rutas;
