const { Afiliado, Direccion } = require('../models');
const ErrorAplicacion = require('../exceptions/appError');

const normalizarTexto = (valor) =>
  String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const normalizarAltura = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? String(numero) : normalizarTexto(valor);
};

const claveDireccion = (direccion = {}) =>
  [
    normalizarTexto(direccion.calle ?? direccion.direccion),
    normalizarAltura(direccion.altura),
    normalizarTexto(direccion.pisoDepto),
    normalizarTexto(direccion.localidad),
    normalizarTexto(direccion.codigoPostal),
    normalizarTexto(direccion.provincia),
  ].join('|');

const obtenerDireccionesInformadas = (cuerpo = {}) => {
  if (Array.isArray(cuerpo.direcciones) && cuerpo.direcciones.length > 0) {
    return cuerpo.direcciones;
  }

  return cuerpo.direccion ? [cuerpo.direccion] : [];
};

const obtenerDireccionesTitular = async (titular) => {
  const identificadores = titular.direccionesIds?.length
    ? titular.direccionesIds
    : [titular.direccionId].filter(Boolean);

  if (!identificadores.length) return [];

  return Direccion.find({ _id: { $in: identificadores } });
};

const validarDomicilioPropio = async (peticion, _respuesta, siguiente) => {
  const direccionesInformadas = obtenerDireccionesInformadas(peticion.body);
  if (!direccionesInformadas.length) return siguiente();

  const afiliado = await Afiliado.findById(peticion.params.id).select(
    'parentesco afiliadoTitularId'
  );

  if (
    !afiliado ||
    afiliado.parentesco === 'Titular' ||
    !afiliado.afiliadoTitularId
  ) {
    return siguiente();
  }

  const titular = await Afiliado.findById(afiliado.afiliadoTitularId).select(
    'direccionId direccionesIds'
  );
  if (!titular) return siguiente();

  const direccionesTitular = await obtenerDireccionesTitular(titular);
  const clavesTitular = new Set(direccionesTitular.map(claveDireccion));
  const repiteDomicilioTitular = direccionesInformadas.some((direccion) =>
    clavesTitular.has(claveDireccion(direccion))
  );

  if (repiteDomicilioTitular) {
    throw new ErrorAplicacion(
      'El domicilio propio debe ser diferente al domicilio del titular. Si viven en el mismo domicilio, usá la opción de domicilio compartido.',
      409,
      'DOMICILIO_PROPIO_IGUAL_TITULAR'
    );
  }

  return siguiente();
};

module.exports = validarDomicilioPropio;
