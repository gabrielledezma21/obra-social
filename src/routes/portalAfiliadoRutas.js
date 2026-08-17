const { Router } = require('express');
const { Afiliado, Prestador, Agenda } = require('../models');
const Solicitud = require('../models/solicitud');
const Turno = require('../models/turno');
const ErrorAplicacion = require('../exceptions/appError');
const { esTurnoProximo } = require('../utils/fechaTurnos');
const {
  autenticar,
  requerirRol,
} = require('../middlewares/autenticacionMiddleware');

const rutas = Router();
rutas.use(autenticar, requerirRol('AFILIADO'));

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

const obtenerIdsAfiliadosVisibles = async (usuario) => {
  const afiliadoActual = await Afiliado.findById(usuario.afiliadoId);
  if (!afiliadoActual) return [];

  if (afiliadoActual.parentesco === 'Titular') {
    const grupoFamiliar = await obtenerGrupoFamiliar(afiliadoActual);
    return grupoFamiliar.map((integrante) => integrante._id.toString());
  }

  if (afiliadoActual.parentesco === 'Conyuge') {
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

const validarDatosSolicitud = async (cuerpo) => {
  if (!['REINTEGRO', 'AUTORIZACION', 'RECETA'].includes(cuerpo.tipo)) {
    throw new ErrorAplicacion('Tipo de solicitud inválido', 400);
  }

  if (!cuerpo.datos || typeof cuerpo.datos !== 'object') {
    throw new ErrorAplicacion('Faltan datos de la solicitud', 400);
  }

  if (cuerpo.tipo === 'RECETA') {
    if (
      !cuerpo.datos.medicamento ||
      !cuerpo.datos.cantidad ||
      !cuerpo.datos.presentacion
    ) {
      throw new ErrorAplicacion(
        'Medicamento, cantidad y presentación son obligatorios',
        400
      );
    }
    return;
  }

  if (
    !cuerpo.datos.fechaPrestacion ||
    !cuerpo.prestadorId ||
    !cuerpo.especialidadId ||
    !cuerpo.datos.lugar
  ) {
    throw new ErrorAplicacion(
      'Fecha, prestador, especialidad y lugar son obligatorios',
      400
    );
  }

  const prestador = await Prestador.findOne({
    _id: cuerpo.prestadorId,
    especialidades: cuerpo.especialidadId,
  });

  if (!prestador) {
    throw new ErrorAplicacion(
      'El prestador no posee la especialidad seleccionada',
      400
    );
  }

  if (cuerpo.tipo === 'REINTEGRO') {
    const factura = cuerpo.datos.factura || {};
    if (
      !factura.fecha ||
      !factura.cuit ||
      !factura.total ||
      !factura.personaFacturada ||
      !cuerpo.datos.formaPago
    ) {
      throw new ErrorAplicacion(
        'Debe completar factura y forma de pago del reintegro',
        400
      );
    }

    if (
      cuerpo.datos.formaPago === 'TRANSFERENCIA' &&
      !cuerpo.datos.cbu
    ) {
      throw new ErrorAplicacion('Debe informar CBU para transferencia', 400);
    }
  }
};

const convertirAMinutos = (valor) => {
  if (typeof valor === 'number') return valor;
  const [horas, minutos] = String(valor).split(':').map(Number);
  return horas * 60 + minutos;
};

const validarHorarioDisponible = (agenda, valorFecha, hora) => {
  const fecha = new Date(`${valorFecha}T12:00:00`);
  if (Number.isNaN(fecha.getTime())) {
    throw new ErrorAplicacion('Fecha de turno inválida', 400);
  }

  const clavesDias = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miercoles',
    'Jueves',
    'Viernes',
    'Sabado',
  ];
  const dia = agenda.horario?.dias?.[clavesDias[fecha.getDay()]];

  if (!dia?.atiende) {
    throw new ErrorAplicacion('La agenda no atiende ese día', 409);
  }

  const minutosSeleccionados = convertirAMinutos(hora);
  const duracionTurno = Number(agenda.horario?.duracionTurno || 30);
  const horarioValido = (dia.bloques || []).some((bloque) => {
    const inicio = convertirAMinutos(bloque.horaInicio);
    const fin = convertirAMinutos(bloque.horaFin);

    return (
      minutosSeleccionados >= inicio &&
      minutosSeleccionados + duracionTurno <= fin &&
      (minutosSeleccionados - inicio) % duracionTurno === 0
    );
  });

  if (!horarioValido) {
    throw new ErrorAplicacion(
      'El horario seleccionado no pertenece a la agenda',
      409
    );
  }

  const fechaHoraTurno = new Date(`${valorFecha}T${hora}:00`);
  if (fechaHoraTurno <= new Date()) {
    throw new ErrorAplicacion(
      'No se pueden reservar turnos en el pasado',
      409
    );
  }
};

rutas.get('/mi-perfil', async (peticion, respuesta, siguiente) => {
  try {
    const afiliado = await Afiliado.findById(peticion.usuario.afiliadoId)
      .populate('familiares situacionesTerapeuticas direccionId direccionesIds');
    respuesta.json(afiliado);
  } catch (error) {
    siguiente(error);
  }
});

rutas.get('/cartilla', async (peticion, respuesta, siguiente) => {
  try {
    const filtros = {};
    if (peticion.query.especialidadId) {
      filtros.especialidades = peticion.query.especialidadId;
    }
    if (peticion.query.prestadorId) {
      filtros._id = peticion.query.prestadorId;
    }

    const prestadores = await Prestador.find(filtros)
      .populate('especialidades')
      .populate({ path: 'centrosDeAtencion', populate: 'direccionId' });

    respuesta.json(prestadores);
  } catch (error) {
    siguiente(error);
  }
});

rutas.get('/resumen', async (peticion, respuesta, siguiente) => {
  try {
    const idsVisibles = await obtenerIdsAfiliadosVisibles(peticion.usuario);
    const ahora = new Date();
    const haceUnaSemana = new Date(ahora.getTime() - 7 * 86400000);
    const filtroBase = { afiliadoId: { $in: idsVisibles } };

    const [
      pendientes,
      observadas,
      rechazadasSemana,
      aprobadasSemana,
      turnosReservados,
    ] = await Promise.all([
      Solicitud.countDocuments({
        ...filtroBase,
        estado: { $in: ['Recibido', 'En análisis'] },
      }),
      Solicitud.countDocuments({ ...filtroBase, estado: 'Observado' }),
      Solicitud.countDocuments({
        ...filtroBase,
        estado: 'Rechazado',
        actualizadoEn: { $gte: haceUnaSemana },
      }),
      Solicitud.countDocuments({
        ...filtroBase,
        estado: 'Aprobado',
        actualizadoEn: { $gte: haceUnaSemana },
      }),
      Turno.find({
        afiliadoId: { $in: idsVisibles },
        estado: 'RESERVADO',
      }).select('fecha hora estado'),
    ]);

    const cantidadTurnos = turnosReservados.filter((turno) =>
      esTurnoProximo(turno, ahora)
    ).length;

    respuesta.json({
      pendientes,
      observadas,
      rechazadasSemana,
      aprobadasSemana,
      turnosProximos: cantidadTurnos,
    });
  } catch (error) {
    siguiente(error);
  }
});

rutas.get('/solicitudes', async (peticion, respuesta, siguiente) => {
  try {
    const idsVisibles = await obtenerIdsAfiliadosVisibles(peticion.usuario);
    const solicitudes = await Solicitud.find({
      afiliadoId: { $in: idsVisibles },
    })
      .sort({ creadoEn: -1 })
      .populate('afiliadoId', 'nombre apellido numeroAfiliado numeroIntegrante')
      .populate('prestadorId', 'nombre')
      .populate('especialidadId', 'nombre');

    respuesta.json(solicitudes);
  } catch (error) {
    siguiente(error);
  }
});

rutas.post('/solicitudes', async (peticion, respuesta, siguiente) => {
  try {
    const idsGestionables = await obtenerIdsAfiliadosGestionables(peticion.usuario);
    if (!idsGestionables.includes(String(peticion.body.afiliadoId))) {
      throw new ErrorAplicacion(
        'No podés registrar operaciones para ese integrante',
        403
      );
    }

    await validarDatosSolicitud(peticion.body);
    const solicitud = await Solicitud.create({
      ...peticion.body,
      creadorAfiliadoId: peticion.usuario.afiliadoId,
    });

    respuesta.status(201).json(solicitud);
  } catch (error) {
    siguiente(error);
  }
});

rutas.put('/solicitudes/:id', async (peticion, respuesta, siguiente) => {
  try {
    const idsGestionables = await obtenerIdsAfiliadosGestionables(peticion.usuario);
    const solicitud = await Solicitud.findOne({
      _id: peticion.params.id,
      afiliadoId: { $in: idsGestionables },
    });

    if (!solicitud) throw new ErrorAplicacion('Solicitud no encontrada', 404);
    if (solicitud.estado !== 'Recibido') {
      throw new ErrorAplicacion(
        'Solo se pueden modificar solicitudes recibidas',
        409
      );
    }

    const solicitudCombinada = {
      ...solicitud.toObject(),
      ...peticion.body,
      datos: {
        ...solicitud.datos,
        ...(peticion.body.datos || {}),
      },
    };

    await validarDatosSolicitud(solicitudCombinada);
    Object.assign(solicitud, peticion.body, { estado: 'Recibido' });
    await solicitud.save();
    respuesta.json(solicitud);
  } catch (error) {
    siguiente(error);
  }
});

rutas.delete('/solicitudes/:id', async (peticion, respuesta, siguiente) => {
  try {
    const idsGestionables = await obtenerIdsAfiliadosGestionables(peticion.usuario);
    const solicitud = await Solicitud.findOne({
      _id: peticion.params.id,
      afiliadoId: { $in: idsGestionables },
    });

    if (!solicitud) throw new ErrorAplicacion('Solicitud no encontrada', 404);
    if (solicitud.estado !== 'Recibido') {
      throw new ErrorAplicacion(
        'Solo se pueden eliminar solicitudes recibidas',
        409
      );
    }

    await solicitud.deleteOne();
    respuesta.status(204).send();
  } catch (error) {
    siguiente(error);
  }
});

rutas.post(
  '/solicitudes/:id/responder-observacion',
  async (peticion, respuesta, siguiente) => {
    try {
      const idsGestionables = await obtenerIdsAfiliadosGestionables(
        peticion.usuario
      );
      const solicitud = await Solicitud.findOne({
        _id: peticion.params.id,
        afiliadoId: { $in: idsGestionables },
      });

      if (!solicitud || solicitud.estado !== 'Observado') {
        throw new ErrorAplicacion('La solicitud no está observada', 409);
      }
      if (!String(peticion.body.texto || '').trim()) {
        throw new ErrorAplicacion('Debe escribir una respuesta', 400);
      }

      solicitud.comentarios.push({
        texto: peticion.body.texto,
        usuarioId: peticion.usuario._id,
      });
      solicitud.estado = 'En análisis';
      solicitud.asignadoAUsuarioId = null;
      solicitud.historialEstados.push({
        estado: 'En análisis',
        usuarioId: peticion.usuario._id,
        motivo: 'Respuesta del afiliado',
      });

      await solicitud.save();
      respuesta.json(solicitud);
    } catch (error) {
      siguiente(error);
    }
  }
);

rutas.get('/turnos', async (peticion, respuesta, siguiente) => {
  try {
    const idsVisibles = await obtenerIdsAfiliadosVisibles(peticion.usuario);
    const turnos = await Turno.find({ afiliadoId: { $in: idsVisibles } })
      .sort({ fecha: 1, hora: 1 })
      .populate('prestadorId', 'nombre')
      .populate('agendaId');

    respuesta.json(turnos);
  } catch (error) {
    siguiente(error);
  }
});

rutas.post('/turnos', async (peticion, respuesta, siguiente) => {
  try {
    const idsGestionables = await obtenerIdsAfiliadosGestionables(peticion.usuario);
    if (!idsGestionables.includes(String(peticion.body.afiliadoId))) {
      throw new ErrorAplicacion(
        'No podés reservar para ese integrante',
        403
      );
    }

    const agenda = await Agenda.findById(peticion.body.agendaId);
    if (!agenda) throw new ErrorAplicacion('Agenda no encontrada', 404);

    validarHorarioDisponible(agenda, peticion.body.fecha, peticion.body.hora);

    const turno = await Turno.create({
      agendaId: agenda._id,
      prestadorId: agenda.prestadorId,
      afiliadoId: peticion.body.afiliadoId,
      reservadoPorAfiliadoId: peticion.usuario.afiliadoId,
      fecha: peticion.body.fecha,
      hora: peticion.body.hora,
    });

    respuesta.status(201).json(turno);
  } catch (error) {
    siguiente(error);
  }
});

rutas.post('/turnos/:id/cancelar', async (peticion, respuesta, siguiente) => {
  try {
    const idsGestionables = await obtenerIdsAfiliadosGestionables(peticion.usuario);
    const turno = await Turno.findOne({
      _id: peticion.params.id,
      afiliadoId: { $in: idsGestionables },
      estado: 'RESERVADO',
    });

    if (!turno) throw new ErrorAplicacion('Turno no encontrado', 404);

    const fechaHoraTurno = new Date(turno.fecha);
    const [horas, minutos] = turno.hora.split(':').map(Number);
    fechaHoraTurno.setHours(horas, minutos, 0, 0);

    if (fechaHoraTurno.getTime() - Date.now() < 86400000) {
      throw new ErrorAplicacion(
        'El turno solo puede cancelarse hasta un día antes',
        409
      );
    }

    turno.estado = 'CANCELADO';
    await turno.save();
    respuesta.json(turno);
  } catch (error) {
    siguiente(error);
  }
});

module.exports = rutas;
