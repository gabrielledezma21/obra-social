const { Router } = require('express');
const { Afiliado, Prestador, Agenda } = require('../models');
const { SituacionAfiliado } = require('../models/historiaClinica');

const rutas = Router();

const crearRangoFechas = (desde, hasta) => {
  const rango = {};
  if (desde) rango.$gte = new Date(`${desde}T00:00:00`);
  if (hasta) {
    rango.$lt = new Date(
      new Date(`${hasta}T00:00:00`).getTime() + 86400000
    );
  }
  return rango;
};

const convertirAMinutos = (valor) => {
  if (typeof valor === 'number') return valor;
  const [horas, minutos] = String(valor).split(':').map(Number);
  return horas * 60 + minutos;
};

const convertirAHora = (minutosTotales) =>
  `${String(Math.floor(minutosTotales / 60)).padStart(2, '0')}:${String(
    minutosTotales % 60
  ).padStart(2, '0')}`;

rutas.get('/afiliados-altas', async (peticion, respuesta, siguiente) => {
  try {
    const rango = crearRangoFechas(peticion.query.desde, peticion.query.hasta);
    const filtros = Object.keys(rango).length ? { fechaAlta: rango } : {};
    const afiliados = await Afiliado.find(filtros)
      .sort({ fechaAlta: -1 })
      .select(
        'nombre apellido numeroAfiliado numeroIntegrante fechaAlta parentesco plan'
      );

    respuesta.json({ total: afiliados.length, elementos: afiliados });
  } catch (error) {
    siguiente(error);
  }
});

rutas.get('/prestadores-altas', async (peticion, respuesta, siguiente) => {
  try {
    const desde = peticion.query.desde
      ? new Date(`${peticion.query.desde}T00:00:00`)
      : null;
    const hasta = peticion.query.hasta
      ? new Date(
          new Date(`${peticion.query.hasta}T00:00:00`).getTime() + 86400000
        )
      : null;

    const prestadores = await Prestador.find().select(
      'nombre cuilCuit especialidades esCentroMedico'
    );
    const elementos = prestadores
      .filter((prestador) => {
        const fechaAlta = prestador._id.getTimestamp();
        return (
          (!desde || fechaAlta >= desde) && (!hasta || fechaAlta < hasta)
        );
      })
      .map((prestador) => ({
        ...prestador.toObject(),
        fechaAlta: prestador._id.getTimestamp(),
      }));

    respuesta.json({ total: elementos.length, elementos });
  } catch (error) {
    siguiente(error);
  }
});

rutas.get('/prestadores-distribucion', async (_peticion, respuesta, siguiente) => {
  try {
    const prestadores = await Prestador.find()
      .populate('especialidades', 'nombre')
      .populate({
        path: 'centrosDeAtencion',
        populate: { path: 'direccionId', select: 'codigoPostal' },
      });

    const cantidadesEspecialidades = {};
    const cantidadesCodigosPostales = {};

    prestadores.forEach((prestador) => {
      (prestador.especialidades || []).forEach((especialidad) => {
        cantidadesEspecialidades[especialidad.nombre] =
          (cantidadesEspecialidades[especialidad.nombre] || 0) + 1;
      });

      const codigosPostalesUnicos = new Set(
        (prestador.centrosDeAtencion || [])
          .map((centro) => centro.direccionId?.codigoPostal)
          .filter(Boolean)
      );
      codigosPostalesUnicos.forEach((codigoPostal) => {
        cantidadesCodigosPostales[codigoPostal] =
          (cantidadesCodigosPostales[codigoPostal] || 0) + 1;
      });
    });

    respuesta.json({
      porEspecialidad: Object.entries(cantidadesEspecialidades).map(
        ([nombre, cantidad]) => ({ nombre, cantidad })
      ),
      porCodigoPostal: Object.entries(cantidadesCodigosPostales).map(
        ([codigoPostal, cantidad]) => ({ codigoPostal, cantidad })
      ),
    });
  } catch (error) {
    siguiente(error);
  }
});

rutas.get('/situaciones/:afiliadoId', async (peticion, respuesta, siguiente) => {
  try {
    const afiliadoObjetivo = await Afiliado.findById(peticion.params.afiliadoId);
    if (!afiliadoObjetivo) {
      return respuesta.status(404).json({ mensaje: 'Afiliado no encontrado' });
    }

    const titularId =
      afiliadoObjetivo.parentesco === 'Titular'
        ? afiliadoObjetivo._id
        : afiliadoObjetivo.afiliadoTitularId;
    const grupoFamiliar = titularId
      ? await Afiliado.find({
          $or: [{ _id: titularId }, { afiliadoTitularId: titularId }],
        }).populate('situacionesTerapeuticas')
      : [afiliadoObjetivo];
    const idsIntegrantes = grupoFamiliar.map((integrante) => integrante._id);

    const novedades = await SituacionAfiliado.find({
      afiliadoId: { $in: idsIntegrantes },
    })
      .populate('situacionTerapeuticaId')
      .populate('afiliadoId', 'nombre apellido');

    respuesta.json({ integrantes: grupoFamiliar, novedades });
  } catch (error) {
    siguiente(error);
  }
});

rutas.get('/prestadores-sin-agenda', async (_peticion, respuesta, siguiente) => {
  try {
    const prestadoresConAgenda = await Agenda.distinct('prestadorId');
    const prestadores = await Prestador.find({
      _id: { $nin: prestadoresConAgenda },
    })
      .select('nombre cuilCuit especialidades')
      .populate('especialidades', 'nombre');

    respuesta.json(prestadores);
  } catch (error) {
    siguiente(error);
  }
});

rutas.get(
  '/prestadores/:id/horarios-sin-turnos',
  async (peticion, respuesta, siguiente) => {
    try {
      const prestador = await Prestador.findById(peticion.params.id).populate({
        path: 'centrosDeAtencion',
        populate: [{ path: 'horarioId' }, { path: 'direccionId' }],
      });

      if (!prestador) {
        return respuesta.status(404).json({ mensaje: 'Prestador no encontrado' });
      }

      const agendas = await Agenda.find({ prestadorId: prestador._id });
      const horariosLibres = [];

      for (const centro of prestador.centrosDeAtencion || []) {
        const agendasDelCentro = agendas.filter(
          (agenda) =>
            String(agenda.centroDeAtencionId) === String(centro._id)
        );
        const dias = centro.horarioId?.dias || {};

        for (const [dia, configuracion] of Object.entries(dias)) {
          if (!configuracion?.atiende) continue;

          const bloquesConAgenda = agendasDelCentro
            .flatMap((agenda) =>
              agenda.horario?.dias?.[dia]?.atiende
                ? agenda.horario.dias[dia].bloques || []
                : []
            )
            .map((bloque) => [
              convertirAMinutos(bloque.horaInicio),
              convertirAMinutos(bloque.horaFin),
            ])
            .sort((primero, segundo) => primero[0] - segundo[0]);

          for (const bloque of configuracion.bloques || []) {
            let cursorMinutos = convertirAMinutos(bloque.horaInicio);
            const finBloque = convertirAMinutos(bloque.horaFin);

            for (const [inicioOcupado, finOcupado] of bloquesConAgenda) {
              if (finOcupado <= cursorMinutos || inicioOcupado >= finBloque) {
                continue;
              }

              if (inicioOcupado > cursorMinutos) {
                horariosLibres.push({
                  centro,
                  dia,
                  horaInicio: convertirAHora(cursorMinutos),
                  horaFin: convertirAHora(
                    Math.min(inicioOcupado, finBloque)
                  ),
                });
              }

              cursorMinutos = Math.max(cursorMinutos, finOcupado);
              if (cursorMinutos >= finBloque) break;
            }

            if (cursorMinutos < finBloque) {
              horariosLibres.push({
                centro,
                dia,
                horaInicio: convertirAHora(cursorMinutos),
                horaFin: convertirAHora(finBloque),
              });
            }
          }
        }
      }

      respuesta.json(horariosLibres);
    } catch (error) {
      siguiente(error);
    }
  }
);

module.exports = rutas;
