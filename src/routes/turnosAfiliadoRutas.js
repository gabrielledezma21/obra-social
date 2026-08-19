const { Router } = require('express');
const { Afiliado } = require('../models');
const ErrorAplicacion = require('../exceptions/appError');
const {
  cancelarTurnoAutenticado,
  crearTurno,
} = require('../services/turnoServicio');

const rutas = Router();

const esMenorDeEdad = (fechaNacimiento) => {
  if (!fechaNacimiento) return false;

  const nacimiento = new Date(fechaNacimiento);
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const aunNoCumplio =
    hoy.getMonth() < nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() &&
      hoy.getDate() < nacimiento.getDate());

  if (aunNoCumplio) edad -= 1;
  return edad < 18;
};

const obtenerIdsAfiliadosGestionables = async (usuario) => {
  const afiliadoActual = await Afiliado.findById(usuario.afiliadoId);
  if (!afiliadoActual) return [];

  if (
    afiliadoActual.parentesco !== 'Titular' &&
    afiliadoActual.parentesco !== 'Conyuge'
  ) {
    return [afiliadoActual._id.toString()];
  }

  const titularId =
    afiliadoActual.parentesco === 'Titular'
      ? afiliadoActual._id
      : afiliadoActual.afiliadoTitularId;
  const grupo = await Afiliado.find({
    $or: [{ _id: titularId }, { afiliadoTitularId: titularId }],
  }).select('_id parentesco fechaNacimiento');

  return grupo
    .filter(
      (integrante) =>
        integrante._id.equals(afiliadoActual._id) ||
        (integrante.parentesco === 'Hijo' &&
          esMenorDeEdad(integrante.fechaNacimiento))
    )
    .map((integrante) => integrante._id.toString());
};

const ocultarHashGestion = (turno) => {
  const turnoSeguro = turno.toObject();
  delete turnoSeguro.tokenGestionHash;
  return turnoSeguro;
};

rutas.post('/turnos', async (peticion, respuesta, siguiente) => {
  try {
    const idsGestionables = await obtenerIdsAfiliadosGestionables(
      peticion.usuario
    );
    if (!idsGestionables.includes(String(peticion.body.afiliadoId))) {
      throw new ErrorAplicacion(
        'No podés reservar para ese integrante',
        403,
        'AFILIADO_NO_GESTIONABLE'
      );
    }

    const resultado = await crearTurno({
      agendaId: peticion.body.agendaId,
      afiliadoId: peticion.body.afiliadoId,
      reservadoPorAfiliadoId: peticion.usuario.afiliadoId,
      fecha: peticion.body.fecha,
      hora: peticion.body.hora,
      actorTipo: 'AFILIADO',
      actorId: peticion.usuario.afiliadoId,
    });

    respuesta.status(201).json({
      ...ocultarHashGestion(resultado.turno),
      tokenGestion: resultado.credenciales.tokenGestion,
      notificacion: resultado.notificacion,
    });
  } catch (error) {
    siguiente(error);
  }
});

rutas.post('/turnos/:id/cancelar', async (peticion, respuesta, siguiente) => {
  try {
    const idsGestionables = await obtenerIdsAfiliadosGestionables(
      peticion.usuario
    );
    const resultado = await cancelarTurnoAutenticado({
      turnoId: peticion.params.id,
      afiliadosGestionables: idsGestionables,
      actorId: peticion.usuario.afiliadoId,
    });

    respuesta.json({
      ...ocultarHashGestion(resultado.turno),
      notificacion: resultado.notificacion,
    });
  } catch (error) {
    siguiente(error);
  }
});

module.exports = rutas;
