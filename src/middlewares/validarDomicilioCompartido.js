const { Afiliado } = require('../models');
const ErrorAplicacion = require('../exceptions/appError');

const tieneDireccionesInformadas = (cuerpo = {}) =>
  (Array.isArray(cuerpo.direcciones) && cuerpo.direcciones.length > 0) ||
  Boolean(cuerpo.direccion);

const validarDomicilioCompartido = async (peticion, _respuesta, siguiente) => {
  const afiliado = await Afiliado.findById(peticion.params.id).select(
    'parentesco comparteDomicilioTitular afiliadoTitularId direccionId direccionesIds'
  );

  if (!afiliado || afiliado.parentesco === 'Titular') {
    return siguiente();
  }

  const modificaDirecciones = tieneDireccionesInformadas(peticion.body);
  const dejaDeCompartir = peticion.body.comparteDomicilioTitular === false;

  if (
    afiliado.comparteDomicilioTitular &&
    modificaDirecciones &&
    !dejaDeCompartir
  ) {
    throw new ErrorAplicacion(
      'El domicilio compartido solo puede modificarse desde el titular. Elegí usar domicilio propio para independizarlo.',
      409,
      'DOMICILIO_COMPARTIDO_SOLO_TITULAR'
    );
  }

  if (
    afiliado.comparteDomicilioTitular &&
    dejaDeCompartir &&
    !modificaDirecciones
  ) {
    throw new ErrorAplicacion(
      'Para dejar de compartir el domicilio del titular debés informar al menos una dirección propia.',
      400,
      'DOMICILIO_PROPIO_REQUERIDO'
    );
  }

  return siguiente();
};

module.exports = validarDomicilioCompartido;
