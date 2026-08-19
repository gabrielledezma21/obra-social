const { Router } = require('express');
const { Afiliado } = require('../models');
const Turno = require('../models/turno');
const ErrorAplicacion = require('../exceptions/appError');
const { reagendarTurno } = require('../services/gestionTurnosServicio');

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

const obtenerGrupoFamiliar = async (afiliadoActual) => {
  const titularId =
    afiliadoActual.parentesco === 'Titular'
      ? afiliadoActual._id
      : afiliadoActual.afiliadoTitularId;

  if (!titularId) return [afiliadoActual];

  return Afiliado.find({
    $or: [{ _id: titularId }, { afiliadoTitularId: titularId }],
  }).select('_id parentesco fechaNacimiento');
};

const obtenerIdsAfiliadosGestionables = async (usuario) => {
  const afiliadoActual = await Afiliado.findById(usuario.afiliadoId);
  if (!afiliadoActual) return [];

  if (
    afiliadoActual.parentesco === 'Titular' ||
    afiliadoActual.parentesco === 'Conyuge'
  ) {
    const grupoFamiliar = await obtenerGrupoFamiliar(afiliadoActual);
    return grupoFamiliar
      .filter(
        (integrante) =>
          integrante._id.equals(afiliadoActual._id) ||
          (integrante.parentesco === 'Hijo' &&
            esMenorDeEdad(integrante.fechaNacimiento))
      )
      .map((integrante) => integrante._id.toString());
  }

  return [afiliadoActual._id.toString()];
};

rutas.post('/turnos/:id/reagendar', async (peticion, respuesta, siguiente) => {
  try {
    const idsGestionables = await obtenerIdsAfiliadosGestionables(
      peticion.usuario
    );
    const turno = await Turno.findOne({
      _id: peticion.params.id,
      afiliadoId: { $in: idsGestionables },
      estado: 'RESERVADO',
    });

    if (!turno) throw new ErrorAplicacion('Turno no encontrado', 404);

    await reagendarTurno({
      turno,
      agendaId: peticion.body.agendaId,
      fecha: peticion.body.fecha,
      hora: peticion.body.hora,
      actorRol: 'AFILIADO',
      actorId: peticion.usuario.afiliadoId,
      motivo: peticion.body.motivo,
    });
    await turno.populate('prestadorId', 'nombre');
    await turno.populate('agendaId');

    respuesta.json(turno);
  } catch (error) {
    siguiente(error);
  }
});

module.exports = rutas;
