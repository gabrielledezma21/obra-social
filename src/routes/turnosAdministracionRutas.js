const { Router } = require('express');
const Turno = require('../models/turno');
const ErrorAplicacion = require('../exceptions/appError');
const {
  cancelarTurno,
  reagendarTurno,
} = require('../services/gestionTurnosServicio');
const {
  generarCodigoReserva,
  generarTokenGestion,
  obtenerHashTokenGestion,
} = require('../services/turnosServicio');

const rutas = Router();

const poblarTurno = (consulta) =>
  consulta
    .populate('prestadorId', 'nombre')
    .populate('afiliadoId', 'nombre apellido numeroAfiliado numeroIntegrante')
    .populate({
      path: 'agendaId',
      populate: [
        { path: 'especialidadId', select: 'nombre' },
        {
          path: 'centroDeAtencionId',
          populate: { path: 'direccionId' },
        },
      ],
    });

rutas.get('/', async (peticion, respuesta, siguiente) => {
  try {
    const filtro = {};
    if (peticion.query.estado) filtro.estado = peticion.query.estado;
    if (peticion.query.codigoReserva) {
      filtro.codigoReserva = String(peticion.query.codigoReserva)
        .trim()
        .toUpperCase();
    }

    const turnos = await poblarTurno(
      Turno.find(filtro).sort({ fecha: 1, hora: 1 }).limit(200)
    );
    respuesta.json(turnos);
  } catch (error) {
    siguiente(error);
  }
});

rutas.get('/:id', async (peticion, respuesta, siguiente) => {
  try {
    const turno = await poblarTurno(Turno.findById(peticion.params.id));
    if (!turno) throw new ErrorAplicacion('Turno no encontrado', 404);
    respuesta.json(turno);
  } catch (error) {
    siguiente(error);
  }
});

rutas.post('/:id/cancelar', async (peticion, respuesta, siguiente) => {
  try {
    const turno = await Turno.findById(peticion.params.id);
    if (!turno) throw new ErrorAplicacion('Turno no encontrado', 404);

    await cancelarTurno({
      turno,
      actorRol: 'ADMIN',
      actorId: peticion.usuario?._id,
      motivo: peticion.body.motivo,
    });
    respuesta.json(turno);
  } catch (error) {
    siguiente(error);
  }
});

rutas.post('/:id/reagendar', async (peticion, respuesta, siguiente) => {
  try {
    const turno = await Turno.findById(peticion.params.id);
    if (!turno) throw new ErrorAplicacion('Turno no encontrado', 404);

    await reagendarTurno({
      turno,
      agendaId: peticion.body.agendaId,
      fecha: peticion.body.fecha,
      hora: peticion.body.hora,
      actorRol: 'ADMIN',
      actorId: peticion.usuario?._id,
      motivo: peticion.body.motivo,
    });
    await turno.populate('prestadorId', 'nombre');
    await turno.populate('agendaId');
    respuesta.json(turno);
  } catch (error) {
    siguiente(error);
  }
});

rutas.post('/:id/credenciales', async (peticion, respuesta, siguiente) => {
  try {
    const turno = await Turno.findById(peticion.params.id).select(
      '+tokenGestionHash'
    );
    if (!turno) throw new ErrorAplicacion('Turno no encontrado', 404);

    const tokenGestion = generarTokenGestion();
    turno.codigoReserva = turno.codigoReserva || generarCodigoReserva();
    turno.tokenGestionHash = obtenerHashTokenGestion(tokenGestion);
    turno.tokenGestionCreadoEn = new Date();
    await turno.save();

    respuesta.json({
      codigoReserva: turno.codigoReserva,
      tokenGestion,
      tokenGestionCreadoEn: turno.tokenGestionCreadoEn,
    });
  } catch (error) {
    siguiente(error);
  }
});

module.exports = rutas;
