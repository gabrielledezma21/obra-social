const { Router } = require('express');
const criptografia = require('crypto');
const Usuario = require('../models/usuario');
const { Afiliado, Prestador } = require('../models');
const ErrorAplicacion = require('../exceptions/appError');
const {
  autenticar,
  firmarToken,
} = require('../middlewares/autenticacionMiddleware');

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

const normalizarDni = (valor) => String(valor || '').replace(/\D/g, '');
const normalizarEmail = (valor) => String(valor || '').trim().toLowerCase();

const validarDatosActivacion = (dni, email) => {
  const dniNormalizado = normalizarDni(dni);
  const emailNormalizado = normalizarEmail(email);

  if (!/^\d{7,8}$/.test(dniNormalizado) || !/^\S+@\S+\.\S+$/.test(emailNormalizado)) {
    throw new ErrorAplicacion('DNI y email válidos son obligatorios', 400);
  }

  return { dniNormalizado, emailNormalizado };
};

const obtenerDniDesdeCuil = (cuilCuit) => {
  const digitos = String(cuilCuit || '').replace(/\D/g, '');
  if (digitos.length !== 11) return '';
  return String(Number(digitos.slice(2, -1)));
};

const validarEdadAfiliado = (afiliado) => {
  if (!afiliado.fechaNacimiento) return;

  const edad = Math.floor(
    (Date.now() - new Date(afiliado.fechaNacimiento).getTime()) / 31557600000
  );
  if (edad < 16) {
    throw new ErrorAplicacion(
      'Solo pueden activar su cuenta integrantes de 16 años o más',
      400,
      'EDAD_MINIMA'
    );
  }
};

const crearUsuarioActivado = async ({
  dniNormalizado,
  emailNormalizado,
  rol,
  afiliadoId = null,
  prestadorId = null,
}) => {
  const usuarioExistente = await Usuario.findOne({
    rol,
    $or: [
      { dniAcceso: dniNormalizado },
      { email: emailNormalizado },
      ...(afiliadoId ? [{ afiliadoId }] : []),
      ...(prestadorId ? [{ prestadorId }] : []),
    ],
  });

  if (usuarioExistente) {
    throw new ErrorAplicacion(
      'La cuenta ya fue activada. Ingresá con tu DNI o email.',
      409,
      'CUENTA_YA_ACTIVADA'
    );
  }

  return Usuario.create({
    email: emailNormalizado,
    dniAcceso: dniNormalizado,
    hashContrasena: generarHashContrasena(dniNormalizado),
    debeCambiarContrasena: true,
    rol,
    afiliadoId,
    prestadorId,
  });
};

rutas.post('/activar-afiliado', async (peticion, respuesta, siguiente) => {
  try {
    const { dniNormalizado, emailNormalizado } = validarDatosActivacion(
      peticion.body.dni,
      peticion.body.email
    );

    const afiliado = await Afiliado.findOne({
      dni: Number(dniNormalizado),
      'emails.direccion': emailNormalizado,
    });

    if (!afiliado) {
      throw new ErrorAplicacion(
        'No encontramos un afiliado con ese DNI y email',
        404,
        'AFILIADO_NO_ENCONTRADO'
      );
    }

    validarEdadAfiliado(afiliado);
    await crearUsuarioActivado({
      dniNormalizado,
      emailNormalizado,
      rol: 'AFILIADO',
      afiliadoId: afiliado._id,
    });

    respuesta.status(201).json({
      mensaje:
        'Cuenta activada. Ingresá con tu DNI como contraseña temporal y cambiala al acceder.',
    });
  } catch (error) {
    siguiente(error);
  }
});

rutas.post('/activar-prestador', async (peticion, respuesta, siguiente) => {
  try {
    const { dniNormalizado, emailNormalizado } = validarDatosActivacion(
      peticion.body.dni,
      peticion.body.email
    );

    const prestadores = await Prestador.find({
      'emails.direccion': emailNormalizado,
    });
    const prestador = prestadores.find(
      (elemento) => obtenerDniDesdeCuil(elemento.cuilCuit) === String(Number(dniNormalizado))
    );

    if (!prestador) {
      throw new ErrorAplicacion(
        'No encontramos un prestador con ese DNI y email',
        404,
        'PRESTADOR_NO_ENCONTRADO'
      );
    }

    await crearUsuarioActivado({
      dniNormalizado,
      emailNormalizado,
      rol: 'PRESTADOR',
      prestadorId: prestador._id,
    });

    respuesta.status(201).json({
      mensaje:
        'Cuenta activada. Ingresá con tu DNI como contraseña temporal y cambiala al acceder.',
    });
  } catch (error) {
    siguiente(error);
  }
});

rutas.post('/iniciar-sesion', async (peticion, respuesta, siguiente) => {
  try {
    const identificador = String(peticion.body.identificador || '').trim();
    const contrasena = String(peticion.body.contrasena || '');
    const rol = String(peticion.body.rol || '').toUpperCase();

    if (!identificador || !contrasena || !['ADMIN', 'AFILIADO', 'PRESTADOR'].includes(rol)) {
      throw new ErrorAplicacion('Credenciales inválidas', 401, 'CREDENCIALES_INVALIDAS');
    }

    const identificadorEmail = normalizarEmail(identificador);
    const identificadorDni = normalizarDni(identificador);
    const condiciones = [{ email: identificadorEmail }];
    if (rol !== 'ADMIN' && /^\d{7,8}$/.test(identificadorDni)) {
      condiciones.push({ dniAcceso: identificadorDni });
    }

    const usuario = await Usuario.findOne({
      rol,
      $or: condiciones,
    });

    if (
      !usuario?.activo ||
      !verificarContrasena(contrasena, usuario?.hashContrasena)
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

rutas.post('/cambiar-contrasena', autenticar, async (peticion, respuesta, siguiente) => {
  try {
    const contrasenaActual = String(peticion.body.contrasenaActual || '');
    const contrasenaNueva = String(peticion.body.contrasenaNueva || '');

    if (!verificarContrasena(contrasenaActual, peticion.usuario.hashContrasena)) {
      throw new ErrorAplicacion(
        'La contraseña actual es incorrecta',
        400,
        'CONTRASENA_ACTUAL_INVALIDA'
      );
    }
    if (contrasenaNueva.length < 8) {
      throw new ErrorAplicacion(
        'La nueva contraseña debe tener al menos 8 caracteres',
        400,
        'CONTRASENA_DEBIL'
      );
    }
    if (contrasenaNueva === contrasenaActual) {
      throw new ErrorAplicacion(
        'La nueva contraseña debe ser diferente de la actual',
        400,
        'CONTRASENA_SIN_CAMBIOS'
      );
    }

    peticion.usuario.hashContrasena = generarHashContrasena(contrasenaNueva);
    peticion.usuario.debeCambiarContrasena = false;
    await peticion.usuario.save();

    respuesta.json({
      mensaje: 'Contraseña actualizada correctamente',
      usuario: peticion.usuario,
    });
  } catch (error) {
    siguiente(error);
  }
});

module.exports = rutas;
