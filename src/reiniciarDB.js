const { Prestador, Especialidad, Direccion, Horario, CentroDeAtencion, Agenda, Afiliado, SituacionTerapeutica } = require('./models');
const { mongo } = require('./config');

const cleanDB = async () => {
  await Promise.all([
    Afiliado.deleteMany({}),
    Prestador.deleteMany({}),
    Especialidad.deleteMany({}),
    Direccion.deleteMany({}),
    Horario.deleteMany({}),
    CentroDeAtencion.deleteMany({}),
    Agenda.deleteMany({}),
    SituacionTerapeutica.deleteMany({})
  ]);
  console.log('✅ Base de datos limpiada');
};

const createAgendaHorario = (diaSemana, horaInicio, horaFin, duracionTurno = 30) => {
  const diaLibre = { atiende: false, bloques: [] };
  const dias = {
    Lunes: diaLibre, Martes: diaLibre, Miercoles: diaLibre, Jueves: diaLibre, Viernes: diaLibre, Sabado: diaLibre, Domingo: diaLibre
  };

  // Convert HH:MM to minutes
  const toMin = (time) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  dias[diaSemana] = {
    atiende: true,
    bloques: [{ horaInicio: toMin(horaInicio), horaFin: toMin(horaFin) }]
  };

  return { dias, duracionTurno };
};

const runSeed = async () => {
  try {
    await mongo.conectarDB();
    await cleanDB();

    // 1. Especialidades
    const especialidades = await Especialidad.create([
      { nombre: 'Cardiologia' },
      { nombre: 'Pediatria' },
      { nombre: 'Dermatologia' }
    ]);
    console.log(`✅ ${especialidades.length} Especialidades creadas`);

    // 2. Situaciones Terapeuticas
    const situaciones = await SituacionTerapeutica.create([
      { nombre: 'Discapacidad' },
      { nombre: 'Embarazo' },
      { nombre: 'Cronico' }
    ]);
    console.log(`✅ ${situaciones.length} Situaciones Terapéuticas creadas`);

    // 3. Direcciones y Horarios para Centros
    const direcciones = await Direccion.create([
      { calle: 'Av. Corrientes', altura: 100, localidad: 'CABA', codigoPostal: '1000', provincia: 'Buenos Aires' },
      { calle: 'Av. Santa Fe', altura: 200, localidad: 'CABA', codigoPostal: '1425', provincia: 'Buenos Aires' },
      { calle: 'Av. Libertador', altura: 300, localidad: 'San Isidro', codigoPostal: '1642', provincia: 'Buenos Aires' }
    ]);

    const diaBase = { atiende: true, bloques: [{ horaInicio: 540, horaFin: 1080 }] }; // 9 to 18
    const diaLibre = { atiende: false, bloques: [] };
    const horarioBase = {
      dias: {
        Lunes: diaBase, Martes: diaBase, Miercoles: diaBase, Jueves: diaBase, Viernes: diaBase,
        Sabado: diaLibre, Domingo: diaLibre
      },
      duracionTurno: 30
    };

    const horarios = await Horario.create([horarioBase, horarioBase, horarioBase]);

    // 4. Centros de Atencion
    const centros = await CentroDeAtencion.create([
      { direccionId: direcciones[0]._id, horarioId: horarios[0]._id },
      { direccionId: direcciones[1]._id, horarioId: horarios[1]._id },
      { direccionId: direcciones[2]._id, horarioId: horarios[2]._id }
    ]);
    console.log(`✅ ${centros.length} Centros de Atención creados`);

    // 5. Prestadores
    const prestadores = await Prestador.create([
      {
        nombre: 'Dr. House',
        cuilCuit: '20123456789',
        emails: [{ direccion: 'house@medical.com' }],
        telefonos: [{ numero: '1111111111' }],
        especialidades: [especialidades[0]._id], // Cardiologia
        centrosDeAtencion: [centros[0]._id],
        agendas: []
      },
      {
        nombre: 'Dr. Strange',
        cuilCuit: '20987654321',
        emails: [{ direccion: 'strange@magic.com' }],
        telefonos: [{ numero: '2222222222' }],
        especialidades: [especialidades[1]._id, especialidades[2]._id], // Pediatria, Dermato
        centrosDeAtencion: [centros[1]._id, centros[2]._id],
        agendas: []
      },
      { // Added missing opening brace here
        nombre: 'Dra. Grey',
        cuilCuit: '27123456789',
        emails: [{ direccion: 'grey@anatomy.com' }],
        telefonos: [{ numero: '3333333333' }],
        especialidades: [especialidades[2]._id], // Dermato
        centrosDeAtencion: [centros[0]._id, centros[2]._id],
        agendas: [],
        centroMedicoQueIntegra: null // No integra, o podemos hacer que House sea CM.
      },
      // 5.1 Un Centro Medico (Prestador que es CM)
      {
        nombre: 'Clinica Mayo',
        cuilCuit: '30111111111',
        emails: [{ direccion: 'info@mayo.com' }],
        telefonos: [{ numero: '5555555000' }],
        especialidades: [especialidades[0]._id],
        centrosDeAtencion: [centros[0]._id],
        esCentroMedico: true,
        agendas: []
      },
      // 5.2 Prestador que integra la Clinica
      {
        nombre: 'Dr. Asociado',
        cuilCuit: '20999999999',
        emails: [{ direccion: 'asociado@mayo.com' }],
        telefonos: [{ numero: '5555555001' }],
        especialidades: [especialidades[0]._id],
        centrosDeAtencion: [centros[0]._id],
        esCentroMedico: false,
        centroMedicoQueIntegra: null, // Asignaremos despues o... wait, referenced by ID which doesn't exist yet in array creation.
        agendas: []
      },
      // Dr. Tester - Para tests de creación de agenda
      {
        nombre: 'Dr. Tester',
        cuilCuit: '20555555555',
        emails: [{ direccion: 'tester@test.com' }],
        telefonos: [{ numero: '4444444444' }],
        especialidades: [especialidades[0]._id], // Cardiologia
        centrosDeAtencion: [centros[0]._id], // Usa Centro 0
        agendas: []
      }
    ]);
    console.log(`✅ ${prestadores.length} Prestadores creados`);

    // Vincular Dr. Asociado a Clinica Mayo
    const clinica = prestadores.find(p => p.nombre === 'Clinica Mayo');
    const asociado = prestadores.find(p => p.nombre === 'Dr. Asociado');
    if (clinica && asociado) {
      asociado.centroMedicoQueIntegra = clinica._id;
      await asociado.save();
      console.log("✅ Dr. Asociado vinculado a Clinica Mayo");
    }

    // 6. Agendas (Interconectadas)
    // Usamos el helper para crear objetos horario completos
    const agenda1Horario = createAgendaHorario('Lunes', '09:00', '13:00');
    const agenda2Horario = createAgendaHorario('Martes', '14:00', '18:00');
    const agenda3Horario = createAgendaHorario('Miercoles', '10:00', '14:00');

    const agendas = await Agenda.create([
      {
        especialidadId: especialidades[0]._id, // Cardiologia
        centroDeAtencionId: centros[0]._id,
        prestadorId: prestadores[0]._id, // House
        horario: agenda1Horario
      },
      {
        especialidadId: especialidades[1]._id, // Pediatria
        centroDeAtencionId: centros[1]._id,
        prestadorId: prestadores[1]._id, // Strange
        horario: agenda2Horario
      },
      {
        especialidadId: especialidades[2]._id, // Dermato
        centroDeAtencionId: centros[2]._id,
        prestadorId: prestadores[2]._id, // Grey
        horario: agenda3Horario
      }
    ]);
    console.log(`✅ ${agendas.length} Agendas creadas`);

    // 7. Afiliados (Titulares y Familiares)
    const direccionAfiliado = await Direccion.create({
      calle: 'Calle Falsa', altura: 123, localidad: 'Springfield', codigoPostal: '9999', provincia: 'Buenos Aires'
    });

    // Titular 1
    const titular1 = await Afiliado.create({
      nombre: 'Homero', apellido: 'Simpson', tipoDocumento: 'DNI', dni: 10000001,
      numeroAfiliado: 1000, numeroIntegrante: 1, parentesco: 'Titular',
      emails: [{ direccion: 'homero@simpson.com' }], telefonos: [{ numero: '1144444444' }],
      direccionId: direccionAfiliado._id, plan: '210', fechaAlta: new Date(),
      situacionesTerapeuticas: [situaciones[0]._id] // Discapacidad
    });

    // Familiar 1 (Hijo de Homero)
    await Afiliado.create({
      nombre: 'Bart', apellido: 'Simpson', tipoDocumento: 'DNI', dni: 10000002,
      numeroAfiliado: 1000, numeroIntegrante: 2, parentesco: 'Hijo',
      emails: [{ direccion: 'bart@simpson.com' }], telefonos: [{ numero: '1155555555' }],
      direccionId: direccionAfiliado._id, plan: '210', fechaAlta: new Date(),
      afiliadoTitularId: titular1._id
    });

    // Titular 2
    await Afiliado.create({
      nombre: 'Marge', apellido: 'Bouvier', tipoDocumento: 'DNI', dni: 20000001,
      numeroAfiliado: 2000, numeroIntegrante: 1, parentesco: 'Titular',
      emails: [{ direccion: 'marge@bouvier.com' }], telefonos: [{ numero: '1166666666' }],
      direccionId: direccionAfiliado._id, plan: '310', fechaAlta: new Date(),
      situacionesTerapeuticas: [situaciones[1]._id] // Embarazo
    });

    console.log(`✅ Afiliados creados (Titulares y Familiares)`);

    console.log('🎉 Seed completado exitosamente!');

  } catch (error) {
    console.error('❌ Error en el seed:', error);
  } finally {
    process.exit(0);
  }
};

runSeed();