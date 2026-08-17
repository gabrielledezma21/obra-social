const { Router } = require('express');
const { Afiliado, Prestador } = require('../models');
const Solicitud = require('../models/solicitud');
const Turno = require('../models/turno');
const {
  HistoriaClinica,
  SituacionAfiliado,
} = require('../models/historiaClinica');
const ErrorAplicacion = require('../exceptions/appError');
const {
  autenticar,
  requerirRol,
} = require('../middlewares/autenticacionMiddleware');

const rutas = Router();
rutas.use(autenticar, requerirRol('PRESTADOR'));

const obtenerAlcancePrestador = async (prestadorId) => {
  const prestador = await Prestador.findById(prestadorId);
  if (!prestador) return { prestador: null, idsPrestadores: [] };

  const profesionalesAsociados = prestador.esCentroMedico
    ? await Prestador.find({ centroMedicoQueIntegra: prestador._id }).select('_id')
    : [];

  return {
    prestador,
    idsPrestadores: [
      prestador._id,
      ...profesionalesAsociados.map((profesional) => profesional._id),
    ],
  };
};

const puedeProcesarSolicitud = async (usuario, solicitud) => {
  const { prestador, idsPrestadores } = await obtenerAlcancePrestador(
    usuario.prestadorId
  );

  if (!prestador) return false;
  if (solicitud.tipo === 'RECETA') return true;

  return idsPrestadores.some(
    (prestadorId) =>
      String(prestadorId) === String(solicitud.prestadorId || '')
  );
};

rutas.get('/mi-perfil', async (peticion, respuesta, siguiente) => {
  try {
    const prestador = await Prestador.findById(peticion.usuario.prestadorId)
      .populate('especialidades')
      .populate({ path: 'centrosDeAtencion', populate: 'direccionId' });
    respuesta.json(prestador);
  } catch (error) {
    siguiente(error);
  }
});

rutas.get('/solicitudes', async (peticion, respuesta, siguiente) => {
  try {
    const { idsPrestadores } = await obtenerAlcancePrestador(
      peticion.usuario.prestadorId
    );

    const solicitudes = await Solicitud.find({
      $or: [
        { tipo: 'RECETA' },
        { prestadorId: { $in: idsPrestadores } },
      ],
    })
      .sort({ estado: 1, creadoEn: -1 })
      .populate('afiliadoId', 'nombre apellido numeroAfiliado numeroIntegrante')
      .populate('prestadorId', 'nombre')
      .populate('especialidadId', 'nombre');

    respuesta.json(solicitudes);
  } catch (error) {
    siguiente(error);
  }
});

rutas.get('/resumen', async (peticion, respuesta, siguiente) => {
  try {
    const { idsPrestadores } = await obtenerAlcancePrestador(
      peticion.usuario.prestadorId
    );

    const solicitudesDisponibles = await Solicitud.find({
      $or: [
        { tipo: 'RECETA' },
        { prestadorId: { $in: idsPrestadores } },
      ],
    }).select('estado actualizadoEn');

    const pendientes = solicitudesDisponibles.filter((solicitud) =>
      ['Recibido', 'En análisis', 'Observado'].includes(solicitud.estado)
    ).length;
    const resueltas = solicitudesDisponibles.filter((solicitud) =>
      ['Aprobado', 'Rechazado'].includes(solicitud.estado)
    ).length;

    const porDia = Object.values(
      solicitudesDisponibles
        .filter((solicitud) =>
          ['Aprobado', 'Rechazado'].includes(solicitud.estado)
        )
        .reduce((acumulado, solicitud) => {
          const fecha = new Date(solicitud.actualizadoEn)
            .toISOString()
            .slice(0, 10);
          acumulado[fecha] ??= { fecha, cantidad: 0 };
          acumulado[fecha].cantidad += 1;
          return acumulado;
        }, {})
    ).sort((primero, segundo) => primero.fecha.localeCompare(segundo.fecha));

    respuesta.json({ pendientes, resueltas, porDia });
  } catch (error) {
    siguiente(error);
  }
});

rutas.post('/solicitudes/:id/estado', async (peticion, respuesta, siguiente) => {
  try {
    const solicitud = await Solicitud.findById(peticion.params.id);
    if (
      !solicitud ||
      !(await puedeProcesarSolicitud(peticion.usuario, solicitud))
    ) {
      throw new ErrorAplicacion(
        'Solicitud no disponible para este prestador',
        403
      );
    }

    const estadoSiguiente = peticion.body.estado;
    if (
      !['En análisis', 'Observado', 'Aprobado', 'Rechazado'].includes(
        estadoSiguiente
      )
    ) {
      throw new ErrorAplicacion('Estado inválido', 400);
    }

    if (
      ['Observado', 'Rechazado'].includes(estadoSiguiente) &&
      !String(peticion.body.motivo || '').trim()
    ) {
      throw new ErrorAplicacion('Debe indicar un motivo', 400);
    }

    if (
      solicitud.estado === 'En análisis' &&
      solicitud.asignadoAUsuarioId &&
      String(solicitud.asignadoAUsuarioId) !== String(peticion.usuario._id)
    ) {
      throw new ErrorAplicacion(
        'La solicitud está siendo procesada por otro usuario',
        409
      );
    }

    if (
      estadoSiguiente === 'En análisis' &&
      !solicitud.asignadoAUsuarioId
    ) {
      solicitud.asignadoAUsuarioId = peticion.usuario._id;
    }

    if (
      solicitud.estado === 'Observado' &&
      estadoSiguiente !== 'En análisis'
    ) {
      throw new ErrorAplicacion(
        'Una solicitud observada debe volver primero a análisis',
        409
      );
    }

    solicitud.estado = estadoSiguiente;
    solicitud.historialEstados.push({
      estado: estadoSiguiente,
      usuarioId: peticion.usuario._id,
      motivo: peticion.body.motivo || '',
    });

    if (['Aprobado', 'Rechazado'].includes(estadoSiguiente)) {
      solicitud.asignadoAUsuarioId = null;
    }

    await solicitud.save();
    respuesta.json(solicitud);
  } catch (error) {
    siguiente(error);
  }
});

rutas.get('/afiliados/buscar', async (peticion, respuesta, siguiente) => {
  try {
    const textoBusqueda = String(peticion.query.busqueda || '').trim();
    const numeroBusqueda = Number(textoBusqueda);
    const filtros = textoBusqueda
      ? {
          $or: [
            ...(Number.isFinite(numeroBusqueda)
              ? [{ numeroAfiliado: numeroBusqueda }]
              : []),
            { apellido: { $regex: textoBusqueda, $options: 'i' } },
            {
              'telefonos.numero': {
                $regex: textoBusqueda.replace(/\D/g, ''),
              },
            },
          ],
        }
      : {};

    const afiliados = await Afiliado.find(filtros)
      .limit(30)
      .populate('familiares');
    respuesta.json(afiliados);
  } catch (error) {
    siguiente(error);
  }
});

rutas.get('/situaciones/:afiliadoId', async (peticion, respuesta, siguiente) => {
  try {
    const afiliadoObjetivo = await Afiliado.findById(peticion.params.afiliadoId);
    if (!afiliadoObjetivo) {
      throw new ErrorAplicacion('Afiliado no encontrado', 404);
    }

    const titularId =
      afiliadoObjetivo.parentesco === 'Titular'
        ? afiliadoObjetivo._id
        : afiliadoObjetivo.afiliadoTitularId;
    const grupoFamiliar = titularId
      ? await Afiliado.find({
          $or: [{ _id: titularId }, { afiliadoTitularId: titularId }],
        }).select('_id nombre apellido')
      : [afiliadoObjetivo];
    const idsIntegrantes = grupoFamiliar.map((integrante) => integrante._id);

    const situaciones = await SituacionAfiliado.find({
      afiliadoId: { $in: idsIntegrantes },
    })
      .populate('situacionTerapeuticaId')
      .populate('afiliadoId', 'nombre apellido');

    respuesta.json({ integrantes: grupoFamiliar, situaciones });
  } catch (error) {
    siguiente(error);
  }
});

rutas.post('/situaciones', async (peticion, respuesta, siguiente) => {
  try {
    if (!(await Afiliado.exists({ _id: peticion.body.afiliadoId }))) {
      throw new ErrorAplicacion('Afiliado no encontrado', 404);
    }

    const situacion = await SituacionAfiliado.create({
      ...peticion.body,
      registradaPorPrestadorId: peticion.usuario.prestadorId,
    });
    respuesta.status(201).json(situacion);
  } catch (error) {
    siguiente(error);
  }
});

rutas.put('/situaciones/:id', async (peticion, respuesta, siguiente) => {
  try {
    const cambios = { ...peticion.body };
    if (cambios.fechaFin) cambios.activa = false;

    const situacion = await SituacionAfiliado.findByIdAndUpdate(
      peticion.params.id,
      cambios,
      { new: true, runValidators: true }
    );

    if (!situacion) {
      throw new ErrorAplicacion('Situación no encontrada', 404);
    }

    respuesta.json(situacion);
  } catch (error) {
    siguiente(error);
  }
});

rutas.get('/turnos', async (peticion, respuesta, siguiente) => {
  try {
    const { idsPrestadores } = await obtenerAlcancePrestador(
      peticion.usuario.prestadorId
    );
    const filtros = {
      prestadorId: { $in: idsPrestadores },
      estado: { $ne: 'CANCELADO' },
    };

    const turnos = await Turno.find(filtros)
      .sort({ fecha: 1, hora: 1 })
      .populate('afiliadoId', 'nombre apellido numeroAfiliado numeroIntegrante')
      .populate('prestadorId', 'nombre')
      .populate({
        path: 'agendaId',
        populate: [
          { path: 'especialidadId', select: 'nombre' },
          { path: 'centroDeAtencionId', populate: 'direccionId' },
        ],
      });

    const turnosFiltrados = peticion.query.especialidadId
      ? turnos.filter(
          (turno) =>
            String(turno.agendaId?.especialidadId?._id || '') ===
            String(peticion.query.especialidadId)
        )
      : turnos;

    respuesta.json(turnosFiltrados);
  } catch (error) {
    siguiente(error);
  }
});

rutas.post('/turnos/:id/nota', async (peticion, respuesta, siguiente) => {
  try {
    const { idsPrestadores } = await obtenerAlcancePrestador(
      peticion.usuario.prestadorId
    );
    const turno = await Turno.findOne({
      _id: peticion.params.id,
      prestadorId: { $in: idsPrestadores },
    });

    if (!turno) throw new ErrorAplicacion('Turno no encontrado', 404);
    if (!String(peticion.body.nota || '').trim()) {
      throw new ErrorAplicacion('Debe escribir una nota de atención', 400);
    }

    const historia = await HistoriaClinica.create({
      afiliadoId: turno.afiliadoId,
      prestadorId: peticion.usuario.prestadorId,
      turnoId: turno._id,
      nota: peticion.body.nota,
    });

    turno.estado = 'ATENDIDO';
    await turno.save();
    respuesta.status(201).json(historia);
  } catch (error) {
    siguiente(error);
  }
});

rutas.get('/historia/:afiliadoId', async (peticion, respuesta, siguiente) => {
  try {
    const filtros = { afiliadoId: peticion.params.afiliadoId };
    if (peticion.query.soloMias === 'true') {
      filtros.prestadorId = peticion.usuario.prestadorId;
    }

    const historia = await HistoriaClinica.find(filtros)
      .sort({ fecha: -1 })
      .populate('prestadorId', 'nombre');
    respuesta.json(historia);
  } catch (error) {
    siguiente(error);
  }
});

module.exports = rutas;
