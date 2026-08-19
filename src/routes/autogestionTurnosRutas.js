const { Router } = require('express');
const {
  cancelarTurno,
  obtenerDisponibilidadMismaAgenda,
  obtenerTurnoPorCredenciales,
  reagendarTurno,
  serializarTurnoGestion,
} = require('../services/gestionTurnosServicio');

const rutas = Router();

const obtenerCredenciales = (cuerpo) => ({
  codigoReserva: cuerpo?.codigoReserva,
  tokenGestion: cuerpo?.tokenGestion,
});

rutas.post('/consultar', async (peticion, respuesta, siguiente) => {
  try {
    const turno = await obtenerTurnoPorCredenciales(
      peticion.body.codigoReserva,
      peticion.body.tokenGestion
    );
    respuesta.json(serializarTurnoGestion(turno));
  } catch (error) {
    siguiente(error);
  }
});

rutas.post('/disponibilidad', async (peticion, respuesta, siguiente) => {
  try {
    const turno = await obtenerTurnoPorCredenciales(
      peticion.body.codigoReserva,
      peticion.body.tokenGestion
    );
    const disponibilidad = await obtenerDisponibilidadMismaAgenda(
      turno,
      peticion.body.limite
    );
    respuesta.json(disponibilidad);
  } catch (error) {
    siguiente(error);
  }
});

rutas.post('/cancelar', async (peticion, respuesta, siguiente) => {
  try {
    const turno = await obtenerTurnoPorCredenciales(
      peticion.body.codigoReserva,
      peticion.body.tokenGestion
    );
    await cancelarTurno({
      turno,
      actorRol: 'PUBLICO',
      motivo: peticion.body.motivo,
    });
    respuesta.json(serializarTurnoGestion(turno));
  } catch (error) {
    siguiente(error);
  }
});

rutas.post('/reagendar', async (peticion, respuesta, siguiente) => {
  try {
    const credenciales = obtenerCredenciales(peticion.body);
    const turno = await obtenerTurnoPorCredenciales(
      credenciales.codigoReserva,
      credenciales.tokenGestion
    );
    const agendaId = turno.agendaId?._id || turno.agendaId;

    await reagendarTurno({
      turno,
      agendaId,
      fecha: peticion.body.fecha,
      hora: peticion.body.hora,
      actorRol: 'PUBLICO',
      motivo: peticion.body.motivo,
    });
    await turno.populate('prestadorId', 'nombre');
    await turno.populate({
      path: 'agendaId',
      populate: [
        { path: 'especialidadId', select: 'nombre' },
        {
          path: 'centroDeAtencionId',
          populate: { path: 'direccionId' },
        },
      ],
    });

    respuesta.json(serializarTurnoGestion(turno));
  } catch (error) {
    siguiente(error);
  }
});

module.exports = rutas;
