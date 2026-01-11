const { Prestador, CentroDeAtencion, Especialidad, Agenda } = require('../models');
const AppError = require("../exceptions/appError");
const { convertirAMinutos } = require('../utils/conversionesDeHorarios');

const existsPrestador = async (req, res, next) => {
    try {
        if (!req.body.prestadorId) {
            return next(new AppError('El prestadorId es requerido', 400, 'PRESTADOR_ID_REQUERIDO'));
        }
        const prestador = await Prestador.findById(req.body.prestadorId);
        if (!prestador) {
            return next(new AppError(`El prestador con id ${req.body.prestadorId} no se encuentra registrado`, 400, 'PRESTADOR_NO_REGISTRADO'));
        }
        next();
    } catch (error) {
        return next(error);
    }
};

const existsCentroAtencion = async (req, res, next) => {
    try {
        if (!req.body.centroDeAtencionId) {
            return next(new AppError('El centroDeAtencionId es requerido', 400, 'CENTRO_ATENCION_ID_REQUERIDO'));
        }
        const centro = await CentroDeAtencion.findById(req.body.centroDeAtencionId);
        if (!centro) {
            return next(new AppError(`El centro de atención con id ${req.body.centroDeAtencionId} no se encuentra registrado`, 400, 'CENTRO_NO_REGISTRADO'));
        }
        next();
    } catch (error) {
        return next(error);
    }
};

const existsEspecialidad = async (req, res, next) => {
    try {
        if (!req.body.especialidadId) {
            return next(new AppError('El especialidadId es requerido', 400, 'ESPECIALIDAD_ID_REQUERIDO'));
        }
        const especialidad = await Especialidad.findById(req.body.especialidadId);
        if (!especialidad) {
            return next(new AppError(`La especialidad con id ${req.body.especialidadId} no se encuentra registrada`, 400, 'ESPECIALIDAD_NO_REGISTRADA'));
        }
        next();
    } catch (error) {
        return next(error);
    }
};

const prestadorConEsaEspecialidad = async (req, res, next) => {
    try {
        const prestador = await Prestador.findById(req.body.prestadorId).populate('especialidades');
        if (!prestador) {
            return next(new AppError(`El prestador con id ${req.body.prestadorId} no existe`, 400, 'PRESTADOR_NO_EXISTE'));
        }

        const especialidadIds = prestador.especialidades.map(e => e._id.toString());
        if (!especialidadIds.includes(req.body.especialidadId.toString())) {
            return next(new AppError(`El prestador con id ${req.body.prestadorId} no posee la especialidad con id ${req.body.especialidadId}`, 400, 'ESPECIALIDAD_NO_ASIGNADA_AL_PRESTADOR'));
        }
        next();
    } catch (error) {
        return next(error);
    }
};

const prestadorAtiendeEnEseCentroAtencion = async (req, res, next) => {
    try {
        const prestador = await Prestador.findById(req.body.prestadorId).populate('centrosDeAtencion');
        if (!prestador) {
            return next(new AppError(`El prestador con id ${req.body.prestadorId} no existe`, 400, 'PRESTADOR_NO_EXISTE'));
        }

        const centroIds = prestador.centrosDeAtencion.map(c => c._id.toString());
        if (!centroIds.includes(req.body.centroDeAtencionId.toString())) {
            return next(new AppError(`El prestador con id ${req.body.prestadorId} no atiende en el centro de atención con id ${req.body.centroDeAtencionId}`, 400, 'CENTRO_DE_ATENCION_NO_ASIGNADO_AL_PRESTADOR'));
        }
        next();
    } catch (error) {
        return next(error);
    }
};

//en este middleware se verifica si el prestador atiende en el rango horario que se envia
// Valida que el horario de la agenda esté contenido dentro del horario del prestador en ese centro
// Valida que solo se actualice el horario
const restrictToHorario = (req, res, next) => {
    const allowedKeys = ['horario'];
    const keys = Object.keys(req.body);
    const invalidKeys = keys.filter(key => !allowedKeys.includes(key));
    if (invalidKeys.length > 0) {
        return next(new AppError(`Solo se permite actualizar el campo 'horario'. Campos inválidos: ${invalidKeys.join(', ')}`, 400, 'CAMPOS_INVALIDOS'));
    }
    next();
};

//en este middleware se verifica si el prestador atiende en el rango horario que se envia
// Valida que el horario de la agenda esté contenido dentro del horario del prestador en ese centro
const horarioDentroDelPrestador = async (req, res, next) => {
    try {
        let { prestadorId, centroDeAtencionId, horario } = req.body;

        // Si es un PUT, recuperamos prestador y centro de la agenda existente
        if (req.method === 'PUT') {
            const agendaExistente = await Agenda.findById(req.params.id);
            if (!agendaExistente) {
                return next(new AppError('Agenda no encontrada', 404, 'AGENDA_NO_ENCONTRADA'));
            }
            prestadorId = agendaExistente.prestadorId;
            centroDeAtencionId = agendaExistente.centroDeAtencionId;
        }

        if (!prestadorId || !centroDeAtencionId || !horario || !horario.dias) {
            return next(new AppError('Faltan datos para validar el horario', 400, 'DATOS_HORARIO_INCOMPLETOS'));
        }

        const prestador = await Prestador.findById(prestadorId)
            .populate({ path: 'centrosDeAtencion', populate: [{ path: 'horarioId' }] });

        if (!prestador) {
            return next(new AppError(`El prestador con id ${prestadorId} no existe`, 400, 'PRESTADOR_NO_EXISTE'));
        }

        const centro = prestador.centrosDeAtencion.find(c => c._id.toString() === centroDeAtencionId.toString());
        if (!centro || !centro.horarioId || !centro.horarioId.dias) {
            return next(new AppError('El centro no tiene horario configurado', 400, 'HORARIO_NO_CONFIGURADO'));
        }

        const diasNuevaAgenda = horario.dias;
        const diasPrestador = centro.horarioId.dias;

        const keysDias = Object.keys(diasNuevaAgenda);
        if (keysDias.length === 0) {
            return next(new AppError('Debe indicar al menos un día', 400, 'DIAS_NO_INFORMADOS'));
        }

        for (const diaKey of keysDias) {
            const diaNuevo = diasNuevaAgenda[diaKey];
            if (!diaNuevo || typeof diaNuevo.atiende === 'undefined') {
                return next(new AppError(`Faltan datos en el día ${diaKey}`, 400, 'DATOS_DIA_INCOMPLETOS'));
            }

            const diaPrestador = diasPrestador[diaKey];
            if (!diaPrestador) {
                return next(new AppError(`El prestador no tiene configurado el día ${diaKey}`, 400, 'DIA_NO_CONFIGURADO'));
            }

            if (diaNuevo.atiende) {
                if (!diaPrestador.atiende) {
                    return next(new AppError(`El prestador no atiende los ${diaKey}`, 400, 'DIA_FUERA_DE_RANGO'));
                }
                if (!Array.isArray(diaNuevo.bloques) || diaNuevo.bloques.length === 0) {
                    return next(new AppError(`Debe informar bloques en ${diaKey}`, 400, 'BLOQUES_REQUERIDOS'));
                }

                for (const bloque of diaNuevo.bloques) {
                    const inicioNuevo = convertirAMinutos(bloque.horaInicio);
                    const finNuevo = convertirAMinutos(bloque.horaFin);

                    const cabeEnPrestador = (diaPrestador.bloques || []).some(pb => {
                        const inicioPrest = convertirAMinutos(pb.horaInicio);
                        const finPrest = convertirAMinutos(pb.horaFin);
                        return inicioNuevo >= inicioPrest && finNuevo <= finPrest;
                    });

                    if (!cabeEnPrestador) {
                        return next(new AppError(`El bloque ${diaKey} ${bloque.horaInicio}-${bloque.horaFin} está fuera del horario del prestador`, 400, 'BLOQUE_FUERA_DE_HORARIO'));
                    }
                }
            }
        }

        next();
    } catch (error) {
        return next(error);
    }
};

// Verifica que los bloques de la nueva agenda no se solapen con otras agendas del prestador en ese centro
const horarioLibre = async (req, res, next) => {
    try {
        let { prestadorId, centroDeAtencionId, horario } = req.body;

        // Si es un PUT, recuperamos prestador y centro de la agenda existente
        if (req.method === 'PUT') {
            const agendaExistente = await Agenda.findById(req.params.id);
            if (!agendaExistente) {
                return next(new AppError('Agenda no encontrada', 404, 'AGENDA_NO_ENCONTRADA'));
            }
            prestadorId = agendaExistente.prestadorId;
            centroDeAtencionId = agendaExistente.centroDeAtencionId;
        }

        if (!prestadorId || !centroDeAtencionId || !horario || !horario.dias) {
            return next(new AppError('Faltan datos para validar disponibilidad', 400, 'DATOS_HORARIO_INCOMPLETOS'));
        }

        // Buscamos agendas conflictivas excluyendo la actual si es update
        const query = { prestadorId, centroDeAtencionId };
        if (req.method === 'PUT') {
            query._id = { $ne: req.params.id };
        }

        const agendas = await Agenda.find(query);

        const diasNuevaAgenda = horario.dias;

        const haySolapamiento = (bloqueNuevo, bloquesExistentes) => {
            const inicioNuevo = convertirAMinutos(bloqueNuevo.horaInicio);
            const finNuevo = convertirAMinutos(bloqueNuevo.horaFin);
            return bloquesExistentes.some(b => {
                const inicioExist = convertirAMinutos(b.horaInicio);
                const finExist = convertirAMinutos(b.horaFin);
                return inicioNuevo < finExist && inicioExist < finNuevo;
            });
        };

        for (const [diaKey, diaNuevo] of Object.entries(diasNuevaAgenda)) {
            if (!diaNuevo?.atiende || !Array.isArray(diaNuevo.bloques)) continue;

            const bloquesExistentes = [];
            agendas.forEach(a => {
                const diaExist = a.horario?.dias?.[diaKey];
                if (diaExist?.atiende && Array.isArray(diaExist.bloques)) {
                    bloquesExistentes.push(...diaExist.bloques);
                }
            });

            for (const bloque of diaNuevo.bloques) {
                if (haySolapamiento(bloque, bloquesExistentes)) {
                    return next(new AppError(`El bloque ${diaKey} ${bloque.horaInicio}-${bloque.horaFin} se solapa con otra agenda`, 400, 'BLOQUE_SOLAPADO'));
                }
            }
        }

        next();
    } catch (error) {
        return next(error);
    }
};

const notExistsAgenda = async (req, res, next) => {
    try {
        const existingAgenda = await Agenda.findOne({
            prestadorId: req.body.prestadorId,
            centroDeAtencionId: req.body.centroDeAtencionId,
            especialidadId: req.body.especialidadId
        });

        if (existingAgenda) {
            return next(new AppError('Ya existe una agenda con los mismos datos (prestador, centro, especialidad)', 400, 'AGENDA_YA_EXISTE'));
        }
        next();
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    existsPrestador,
    existsCentroAtencion,
    existsEspecialidad,
    prestadorConEsaEspecialidad,
    prestadorAtiendeEnEseCentroAtencion,
    horarioDentroDelPrestador,
    horarioLibre,
    notExistsAgenda,
    restrictToHorario
};