const { Router } = require('express');
const PDFDocument = require('pdfkit-table');
const { Afiliado, Prestador, Agenda } = require('../models');
const { SituacionAfiliado } = require('../models/historiaClinica');

const rutas = Router();

const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MILISEGUNDOS_DIA = 86400000;

const crearFechaUtc = (valor) => {
  if (!valor) return null;
  if (!PATRON_FECHA.test(String(valor))) {
    throw new Error('La fecha debe tener formato AAAA-MM-DD');
  }

  const fecha = new Date(`${valor}T00:00:00.000Z`);
  if (Number.isNaN(fecha.getTime())) {
    throw new Error('La fecha indicada no es válida');
  }
  return fecha;
};

const crearRangoFechas = (desde, hasta) => {
  const fechaDesde = crearFechaUtc(desde);
  const fechaHasta = crearFechaUtc(hasta);

  if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
    throw new Error('La fecha desde no puede ser posterior a la fecha hasta');
  }

  const rango = {};
  if (fechaDesde) rango.$gte = fechaDesde;
  if (fechaHasta) {
    rango.$lt = new Date(fechaHasta.getTime() + MILISEGUNDOS_DIA);
  }
  return rango;
};

const formatearFecha = (valor) => {
  if (!valor) return '—';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleDateString('es-AR', { timeZone: 'UTC' });
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
        'nombre apellido dni numeroAfiliado numeroIntegrante fechaAlta parentesco plan'
      );

    respuesta.json({ total: afiliados.length, elementos: afiliados });
  } catch (error) {
    siguiente(error);
  }
});

rutas.get('/prestadores-altas', async (peticion, respuesta, siguiente) => {
  try {
    const rango = crearRangoFechas(peticion.query.desde, peticion.query.hasta);
    const prestadores = await Prestador.find().select(
      'nombre cuilCuit especialidades esCentroMedico'
    );

    const elementos = prestadores
      .filter((prestador) => {
        if (Object.keys(rango).length === 0) return true;
        const fechaAlta = prestador._id.getTimestamp();
        return (
          (!rango.$gte || fechaAlta >= rango.$gte) &&
          (!rango.$lt || fechaAlta < rango.$lt)
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

rutas.get('/afiliados/:id/pdf', async (peticion, respuesta, siguiente) => {
  try {
    const afiliado = await Afiliado.findById(peticion.params.id)
      .populate('situacionesTerapeuticas', 'nombre')
      .populate('direccionId');

    if (!afiliado) {
      return respuesta.status(404).json({ mensaje: 'Afiliado no encontrado' });
    }

    const titularId =
      afiliado.parentesco === 'Titular'
        ? afiliado._id
        : afiliado.afiliadoTitularId;

    const grupoFamiliar = titularId
      ? await Afiliado.find({
          $or: [{ _id: titularId }, { afiliadoTitularId: titularId }],
        })
          .populate('situacionesTerapeuticas', 'nombre')
          .sort({ numeroIntegrante: 1 })
      : [afiliado];

    const idsGrupo = grupoFamiliar.map((integrante) => integrante._id);
    const novedades = await SituacionAfiliado.find({
      afiliadoId: { $in: idsGrupo },
    })
      .populate('situacionTerapeuticaId', 'nombre')
      .populate('afiliadoId', 'nombre apellido')
      .sort({ creadoEn: -1 });

    respuesta.setHeader('Content-Type', 'application/pdf');
    respuesta.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte-afiliado-${afiliado.numeroAfiliado}-${afiliado.numeroIntegrante}.pdf"`
    );

    const documento = new PDFDocument({ margin: 48, size: 'A4' });
    documento.pipe(respuesta);

    documento.fontSize(20).text('MedIntegral - Reporte de afiliado');
    documento.moveDown();
    documento.fontSize(12);
    documento.text(`Nombre: ${afiliado.nombre} ${afiliado.apellido}`);
    documento.text(`DNI: ${afiliado.dni}`);
    documento.text(`Credencial: ${afiliado.credencial}`);
    documento.text(`Parentesco: ${afiliado.parentesco}`);
    documento.text(`Plan: ${afiliado.plan}`);
    documento.text(`Fecha de alta: ${formatearFecha(afiliado.fechaAlta)}`);
    documento.text(`Fecha de baja: ${formatearFecha(afiliado.fechaBaja)}`);
    documento.moveDown();

    documento.fontSize(15).text('Grupo familiar');
    documento.moveDown(0.5);
    grupoFamiliar.forEach((integrante) => {
      const situaciones = (integrante.situacionesTerapeuticas || [])
        .map((situacion) => situacion.nombre)
        .filter(Boolean)
        .join(', ');
      documento
        .fontSize(11)
        .text(
          `${integrante.credencial} · ${integrante.nombre} ${integrante.apellido} · ${integrante.parentesco} · Plan ${integrante.plan}`
        );
      documento
        .fontSize(10)
        .text(`Situaciones terapéuticas: ${situaciones || 'Sin registros'}`);
      documento.moveDown(0.4);
    });

    documento.moveDown();
    documento.fontSize(15).text('Novedades terapéuticas');
    documento.moveDown(0.5);

    if (novedades.length === 0) {
      documento.fontSize(11).text('Sin novedades registradas.');
    } else {
      novedades.forEach((novedad) => {
        documento
          .fontSize(10)
          .text(
            `${novedad.afiliadoId?.nombre || ''} ${
              novedad.afiliadoId?.apellido || ''
            } · ${
              novedad.situacionTerapeuticaId?.nombre || 'Situación'
            } · ${novedad.estado || ''}`
          );
        if (novedad.observaciones) {
          documento
            .fontSize(9)
            .text(`Observaciones: ${novedad.observaciones}`);
        }
        documento.moveDown(0.35);
      });
    }

    documento.end();
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
