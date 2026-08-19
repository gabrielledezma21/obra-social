const { Prestador, Agenda } = require('../src/models');
const { mongo } = require('../src/config');
const { mongoose } = require('../src/config/db');

const crearHorarioAgenda = (
  diasAtencion,
  horaInicio,
  horaFin,
  duracionTurno = 30
) => {
  const convertirAMinutos = (hora) => {
    const [horas, minutos] = hora.split(':').map(Number);
    return horas * 60 + minutos;
  };

  const dias = {};
  [
    'Lunes',
    'Martes',
    'Miercoles',
    'Jueves',
    'Viernes',
    'Sabado',
    'Domingo',
  ].forEach((dia) => {
    dias[dia] = { atiende: false, bloques: [] };
  });

  diasAtencion.forEach((dia) => {
    dias[dia] = {
      atiende: true,
      bloques: [
        {
          horaInicio: convertirAMinutos(horaInicio),
          horaFin: convertirAMinutos(horaFin),
        },
      ],
    };
  });

  return { dias, duracionTurno };
};

const configuraciones = [
  { dias: ['Lunes', 'Miercoles'], desde: '08:00', hasta: '12:00' },
  { dias: ['Martes', 'Jueves'], desde: '09:00', hasta: '13:00' },
  { dias: ['Lunes', 'Viernes'], desde: '14:00', hasta: '18:00' },
  { dias: ['Miercoles', 'Viernes'], desde: '10:00', hasta: '16:00' },
  { dias: ['Lunes', 'Martes'], desde: '08:30', hasta: '13:30' },
  { dias: ['Jueves', 'Viernes'], desde: '13:00', hasta: '18:00' },
  { dias: ['Martes', 'Miercoles'], desde: '09:30', hasta: '15:30' },
  { dias: ['Lunes', 'Jueves'], desde: '12:00', hasta: '17:00' },
  { dias: ['Miercoles', 'Sabado'], desde: '09:00', hasta: '13:00' },
];

const ejecutar = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('La carga de agendas demo está bloqueada en producción');
  }

  await mongo.conectarDB();

  const prestadoresDemo = await Prestador.find({
    nombre: /^Prestador Demo /,
  })
    .sort({ nombre: 1 })
    .populate('especialidades')
    .populate('centrosDeAtencion');

  if (prestadoresDemo.length !== 12) {
    throw new Error(
      `Se esperaban 12 prestadores demo adicionales y se encontraron ${prestadoresDemo.length}`
    );
  }

  const prestadoresConAgenda = new Set(
    (
      await Agenda.find({
        prestadorId: { $in: prestadoresDemo.map((prestador) => prestador._id) },
      })
    ).map((agenda) => String(agenda.prestadorId))
  );

  const candidatos = prestadoresDemo.filter(
    (prestador) => !prestadoresConAgenda.has(String(prestador._id))
  );

  const agendasAAgregar = candidatos.slice(0, 9).map((prestador, indice) => {
    const especialidad = prestador.especialidades?.[0];
    const centro = prestador.centrosDeAtencion?.[0];

    if (!especialidad || !centro) {
      throw new Error(
        `El prestador ${prestador.nombre} no tiene especialidad o centro configurado`
      );
    }

    const configuracion = configuraciones[indice % configuraciones.length];
    return {
      especialidadId: especialidad._id,
      centroDeAtencionId: centro._id,
      prestadorId: prestador._id,
      horario: crearHorarioAgenda(
        configuracion.dias,
        configuracion.desde,
        configuracion.hasta
      ),
    };
  });

  if (agendasAAgregar.length) {
    await Agenda.create(agendasAAgregar);
  }

  const [cantidadPrestadores, cantidadAgendas] = await Promise.all([
    Prestador.countDocuments(),
    Agenda.countDocuments(),
  ]);

  console.log('✅ Agendas demo ampliadas cargadas');
  console.log(`   Prestadores totales: ${cantidadPrestadores}`);
  console.log(`   Agendas totales: ${cantidadAgendas}`);
  console.log(
    `   Prestadores demo sin agenda: ${12 - agendasAAgregar.length} (intencional para probar recordatorios)`
  );
};

ejecutar()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Error al completar agendas demo:', error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
