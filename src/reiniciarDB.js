const { Prestador, Especialidad, Direccion, Horario, CentroDeAtencion, Agenda, Afiliado } = require('./models');
const { mongo } = require('./config');

// Función para limpiar la base de datos
const cleanDB = async () => {
  await Afiliado.deleteMany({});
  await Prestador.deleteMany({});
  await Especialidad.deleteMany({});
  await Direccion.deleteMany({});
  await Horario.deleteMany({});
  await CentroDeAtencion.deleteMany({});
  await Agenda.deleteMany({});

  console.log('Base de datos limpiada');
};

// Función principal para ejecutar el seed
const runSeed = async () => {
  try {
    // Conectar a MongoDB usando la misma configuración que main.js
    await mongo.conectarDB();

    // Limpiar la base de datos
    await cleanDB();

    // 1. Crear direccion
    const direccion1 = await Direccion.create({
      calle: 'Av. Libertad',
      altura: 123,
      pisoDepto: 4,
      localidad: 'Moreno',
      codigoPostal: '12345',
      provincia: 'Buenos Aires',
    });

    console.log('Direccion creada');

    // 2. Crear horarios
    const horario1 = await Horario.create({
      dias: {
        Lunes: { atiende: true, bloques: [{ horaInicio: 480, horaFin: 720 }] },
        Martes: { atiende: true, bloques: [{ horaInicio: 480, horaFin: 720 }, { horaInicio: 840, horaFin: 1080 }] },
        Miercoles: { atiende: true, bloques: [{ horaInicio: 480, horaFin: 720 }] },
        Jueves: { atiende: false, bloques: [] },
        Viernes: { atiende: false, bloques: [] },
        Sabado: {},
        Domingo: { atiende: false },
      },
      duracionTurno: 20,
    });

    console.log('Horario creado');

    // 3. Crear centros de atencion
    const centroDeAtencion1 = await CentroDeAtencion.create({
      direccionId: direccion1._id,
      horarioId: horario1._id,
    });

    console.log('Centro de atencion creado');

    // 4. Crear Especialidades
    const especialidad1 = await Especialidad.create({
      nombre: 'Cardiologia',
    });
    const especialidad2 = await Especialidad.create({
      nombre: 'Pediatría',
    });

    console.log('Especialidades creadas');

    // 5. Crear prestadores (sin relaciones)
    const prestador1 = await Prestador.create({
      nombre: 'Juan Perez',
      cuilCuit: '20345678901',
      emails: [{ direccion: 'prestador1@example.com' }, { direccion: 'prestador1@outlook.com' }],
      telefonos: [{ numero: '1122334455' }, { numero: '1122334456' }],
      especialidades: [especialidad1._id, especialidad2._id],
      centrosDeAtencion: [centroDeAtencion1._id],
      agendas: [],
      esCentroMedico: false,
    });

    console.log('Prestadores creados');

    console.log('Seed completado exitosamente!');

  } catch (error) {
    console.error('Error en el seed:', error);
  } finally {
    // Cerrar la conexión a MongoDB
    process.exit(0);
  }
};

// Ejecutar el seed
runSeed();