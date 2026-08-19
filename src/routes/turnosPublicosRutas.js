const { Router } = require('express');
const {
  buscarTurnoConCredenciales,
  cancelarTurnoPublico,
  obtenerDisponibilidadReagendamientoPublica,
  reagendarTurnoPublico,
  serializarTurnoPublico,
} = require('../services/turnoServicio');

const rutas = Router();
const VENTANA_INTENTOS_MS = 15 * 60 * 1000;
const MAXIMO_INTENTOS_POR_IP = 30;
const intentosPorIp = new Map();

const limitarIntentos = (peticion, respuesta, siguiente) => {
  const ahora = Date.now();
  const clave = peticion.ip || peticion.socket?.remoteAddress || 'desconocida';
  const registro = intentosPorIp.get(clave);

  if (!registro || ahora - registro.inicio >= VENTANA_INTENTOS_MS) {
    intentosPorIp.set(clave, { inicio: ahora, cantidad: 1 });
    return siguiente();
  }

  registro.cantidad += 1;
  if (registro.cantidad > MAXIMO_INTENTOS_POR_IP) {
    const segundos = Math.ceil(
      (VENTANA_INTENTOS_MS - (ahora - registro.inicio)) / 1000
    );
    respuesta.set('Retry-After', String(segundos));
    return respuesta.status(429).json({
      codigo: 'DEMASIADOS_INTENTOS',
      mensaje: 'Demasiados intentos. Probá nuevamente en unos minutos.',
      error: 'Demasiados intentos. Probá nuevamente en unos minutos.',
    });
  }

  return siguiente();
};

rutas.use(limitarIntentos);

rutas.post('/consultar', async (peticion, respuesta, siguiente) => {
  try {
    const turno = await buscarTurnoConCredenciales({
      codigoReserva: peticion.body.codigoReserva,
      tokenGestion: peticion.body.tokenGestion,
    });

    respuesta.json({ turno: serializarTurnoPublico(turno) });
  } catch (error) {
    siguiente(error);
  }
});

rutas.post('/disponibilidad', async (peticion, respuesta, siguiente) => {
  try {
    const horarios = await obtenerDisponibilidadReagendamientoPublica({
      codigoReserva: peticion.body.codigoReserva,
      tokenGestion: peticion.body.tokenGestion,
      limite: peticion.body.limite,
    });

    respuesta.json({ horarios });
  } catch (error) {
    siguiente(error);
  }
});

rutas.post('/reagendar', async (peticion, respuesta, siguiente) => {
  try {
    const resultado = await reagendarTurnoPublico({
      codigoReserva: peticion.body.codigoReserva,
      tokenGestion: peticion.body.tokenGestion,
      fecha: peticion.body.fecha,
      hora: peticion.body.hora,
    });

    respuesta.json({
      turno: serializarTurnoPublico(resultado.turno),
      notificacion: resultado.notificacion,
    });
  } catch (error) {
    siguiente(error);
  }
});

rutas.post('/cancelar', async (peticion, respuesta, siguiente) => {
  try {
    const resultado = await cancelarTurnoPublico({
      codigoReserva: peticion.body.codigoReserva,
      tokenGestion: peticion.body.tokenGestion,
    });

    respuesta.json({
      turno: serializarTurnoPublico(resultado.turno),
      notificacion: resultado.notificacion,
    });
  } catch (error) {
    siguiente(error);
  }
});

module.exports = rutas;
