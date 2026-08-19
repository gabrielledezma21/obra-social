const { runSeed: ejecutarSeedBase } = require('../src/reiniciarDB');
const {
  Afiliado,
  Prestador,
  Especialidad,
  Direccion,
  CentroDeAtencion,
  SituacionTerapeutica,
} = require('../src/models');
const {
  SituacionAfiliado,
  HistoriaClinica,
} = require('../src/models/historiaClinica');

const DISTRIBUCION_ALTAS = {
  '2026-01': { '210': 1, '310': 0, '410': 2, '510': 3 },
  '2026-02': { '210': 0, '310': 1, '410': 3, '510': 1 },
  '2026-03': { '210': 4, '310': 3, '410': 4, '510': 2 },
};

const ESPECIALIDADES_ADICIONALES = [
  'Oftalmologia',
  'Neurologia',
  'Psiquiatria',
  'Otorrinolaringologia',
  'Endocrinologia',
  'Gastroenterologia',
  'Urologia',
  'Kinesiologia',
  'Nutricion',
  'Odontologia',
  'Reumatologia',
  'Neumonologia',
];

const SITUACIONES_ADICIONALES = [
  'Hipotiroidismo',
  'Migraña',
  'Alergia estacional',
  'Lumbalgia cronica',
  'Colesterol elevado',
  'Ansiedad',
];

const PERSONAS_DEMO = [
  ['Valentina', 'Acosta'],
  ['Mateo', 'Benitez'],
  ['Camila', 'Cabrera'],
  ['Joaquin', 'Dominguez'],
  ['Martina', 'Escobar'],
  ['Bautista', 'Fernandez'],
  ['Renata', 'Gimenez'],
  ['Tomas', 'Herrera'],
  ['Catalina', 'Ibarra'],
  ['Santino', 'Juarez'],
  ['Emilia', 'Ledesma'],
  ['Felipe', 'Molina'],
  ['Julieta', 'Navarro'],
  ['Franco', 'Ortega'],
  ['Malena', 'Pereyra'],
  ['Thiago', 'Quiroga'],
  ['Josefina', 'Romero'],
  ['Bruno', 'Sosa'],
  ['Alma', 'Torres'],
  ['Lautaro', 'Vega'],
  ['Mia', 'Aguirre'],
  ['Benjamin', 'Correa'],
  ['Olivia', 'Medina'],
  ['Lucas', 'Roldan'],
];

const LOCALIDADES_DEMO = [
  ['Moron', '1708'],
  ['Haedo', '1706'],
  ['Ramos Mejia', '1704'],
  ['San Isidro', '1642'],
  ['CABA', '1000'],
];

const CALLES_DEMO = [
  'Belgrano',
  'Mitre',
  'Sarmiento',
  'Las Heras',
  'San Martin',
  'Rivadavia',
  'Alvear',
  'Brown',
];

const crearFechaAlta = (mes, indice) => {
  const dia = String(5 + (indice % 20)).padStart(2, '0');
  return new Date(`${mes}-${dia}T12:00:00.000Z`);
};

const cargarCatalogosAdicionales = async () => {
  const especialidadesExistentes = new Set(
    (await Especialidad.find()).map((especialidad) => especialidad.nombre)
  );
  const nuevasEspecialidades = ESPECIALIDADES_ADICIONALES.filter(
    (nombre) => !especialidadesExistentes.has(nombre)
  );
  if (nuevasEspecialidades.length) {
    await Especialidad.create(
      nuevasEspecialidades.map((nombre) => ({ nombre }))
    );
  }

  const situacionesExistentes = new Set(
    (await SituacionTerapeutica.find()).map((situacion) => situacion.nombre)
  );
  const nuevasSituaciones = SITUACIONES_ADICIONALES.filter(
    (nombre) => !situacionesExistentes.has(nombre)
  );
  if (nuevasSituaciones.length) {
    await SituacionTerapeutica.create(
      nuevasSituaciones.map((nombre) => ({ nombre }))
    );
  }

  return {
    especialidades: await Especialidad.countDocuments(),
    situaciones: await SituacionTerapeutica.countDocuments(),
  };
};

const cargarAfiliadosMensuales = async () => {
  const direcciones = [];
  const plantillas = [];
  let secuencia = 0;

  for (const [mes, planes] of Object.entries(DISTRIBUCION_ALTAS)) {
    for (const [plan, cantidad] of Object.entries(planes)) {
      for (let indice = 0; indice < cantidad; indice += 1) {
        secuencia += 1;
        const [localidad, codigoPostal] =
          LOCALIDADES_DEMO[(secuencia - 1) % LOCALIDADES_DEMO.length];
        direcciones.push({
          calle: CALLES_DEMO[(secuencia - 1) % CALLES_DEMO.length],
          altura: 200 + secuencia * 17,
          localidad,
          codigoPostal,
          provincia: 'Buenos Aires',
        });
        plantillas.push({ mes, plan, indice, secuencia });
      }
    }
  }

  const direccionesCreadas = await Direccion.create(direcciones);
  return Afiliado.create(
    plantillas.map(({ mes, plan, indice, secuencia }, posicion) => {
      const [nombre, apellido] = PERSONAS_DEMO[posicion % PERSONAS_DEMO.length];
      return {
        nombre,
        apellido,
        fechaNacimiento: new Date(
          `19${70 + (secuencia % 28)}-${String(1 + (secuencia % 12)).padStart(
            2,
            '0'
          )}-15T12:00:00.000Z`
        ),
        tipoDocumento: 'DNI',
        dni: 50000000 + secuencia,
        numeroAfiliado: 3000 + secuencia,
        numeroIntegrante: 1,
        parentesco: 'Titular',
        emails: [
          {
            direccion: `${nombre}.${apellido}${secuencia}@medintegral.com`.toLowerCase(),
          },
        ],
        telefonos: [{ numero: String(1160000000 + secuencia) }],
        direccionId: direccionesCreadas[posicion]._id,
        direccionesIds: [direccionesCreadas[posicion]._id],
        plan,
        fechaAlta: crearFechaAlta(mes, indice),
      };
    })
  );
};

const cargarGrupoFamiliar = async () => {
  const situaciones = await SituacionTerapeutica.find().sort({ nombre: 1 });
  const direcciones = await Direccion.create([
    {
      calle: 'Los Tilos',
      altura: 880,
      localidad: 'Moron',
      codigoPostal: '1708',
      provincia: 'Buenos Aires',
    },
    {
      calle: 'Los Tilos',
      altura: 880,
      localidad: 'Moron',
      codigoPostal: '1708',
      provincia: 'Buenos Aires',
    },
    {
      calle: 'Los Tilos',
      altura: 880,
      localidad: 'Moron',
      codigoPostal: '1708',
      provincia: 'Buenos Aires',
    },
  ]);

  const titular = await Afiliado.create({
    nombre: 'Laura',
    apellido: 'Prueba',
    fechaNacimiento: new Date('1987-04-12T12:00:00.000Z'),
    tipoDocumento: 'DNI',
    dni: 50990001,
    numeroAfiliado: 9900,
    numeroIntegrante: 1,
    parentesco: 'Titular',
    situacionesTerapeuticas: situaciones[0] ? [situaciones[0]._id] : [],
    emails: [{ direccion: 'laura.prueba@medintegral.com' }],
    telefonos: [{ numero: '1169990001' }],
    direccionId: direcciones[0]._id,
    direccionesIds: [direcciones[0]._id],
    plan: '410',
    fechaAlta: new Date('2026-04-10T12:00:00.000Z'),
  });

  const familiares = await Afiliado.create([
    {
      nombre: 'Martin',
      apellido: 'Prueba',
      fechaNacimiento: new Date('1985-11-20T12:00:00.000Z'),
      tipoDocumento: 'DNI',
      dni: 50990002,
      numeroAfiliado: 9900,
      numeroIntegrante: 2,
      parentesco: 'Conyuge',
      situacionesTerapeuticas: situaciones[4] ? [situaciones[4]._id] : [],
      emails: [{ direccion: 'martin.prueba@medintegral.com' }],
      telefonos: [{ numero: '1169990002' }],
      direccionId: direcciones[1]._id,
      direccionesIds: [direcciones[1]._id],
      plan: '410',
      fechaAlta: new Date('2026-04-10T12:00:00.000Z'),
      afiliadoTitularId: titular._id,
    },
    {
      nombre: 'Sofia',
      apellido: 'Prueba',
      fechaNacimiento: new Date('2014-08-03T12:00:00.000Z'),
      tipoDocumento: 'DNI',
      dni: 50990003,
      numeroAfiliado: 9900,
      numeroIntegrante: 3,
      parentesco: 'Hijo',
      situacionesTerapeuticas: situaciones[7] ? [situaciones[7]._id] : [],
      emails: [{ direccion: 'sofia.prueba@medintegral.com' }],
      telefonos: [{ numero: '1169990003' }],
      direccionId: direcciones[2]._id,
      direccionesIds: [direcciones[2]._id],
      plan: '410',
      fechaAlta: new Date('2026-04-10T12:00:00.000Z'),
      afiliadoTitularId: titular._id,
    },
  ]);

  const prestador = await Prestador.findOne();
  if (prestador && situaciones[0]) {
    await SituacionAfiliado.create({
      afiliadoId: titular._id,
      situacionTerapeuticaId: situaciones[0]._id,
      fechaInicio: new Date('2026-05-01T12:00:00.000Z'),
      registradaPorPrestadorId: prestador._id,
    });
    await HistoriaClinica.create({
      afiliadoId: titular._id,
      prestadorId: prestador._id,
      nota: 'Control clínico de demostración para validar el reporte individual.',
      fecha: new Date('2026-05-15T15:00:00.000Z'),
    });
  }

  return [titular, ...familiares];
};

const cargarPrestadoresAdicionales = async () => {
  const especialidades = await Especialidad.find();
  const centros = await CentroDeAtencion.find().populate('direccionId');

  if (especialidades.length === 0 || centros.length === 0) {
    throw new Error(
      'La seed base no generó especialidades o centros de atención'
    );
  }

  const buscarEspecialidad = (nombre) => {
    const especialidad = especialidades.find((item) => item.nombre === nombre);
    if (!especialidad) throw new Error(`Especialidad demo inexistente: ${nombre}`);
    return especialidad;
  };

  const buscarCentro = (localidad) =>
    centros.find((centro) => centro.direccionId?.localidad === localidad) ||
    centros[0];

  const configuraciones = [
    {
      nombre: 'Dra. Agustina Rios',
      especialidades: ['Cardiologia', 'Clinica Medica'],
      localidad: 'Moron',
    },
    {
      nombre: 'Dr. Nicolas Suarez',
      especialidades: ['Neurologia'],
      localidad: 'CABA',
    },
    {
      nombre: 'Dra. Florencia Campos',
      especialidades: ['Oftalmologia'],
      localidad: 'Haedo',
    },
    {
      nombre: 'Dr. Ignacio Peralta',
      especialidades: ['Traumatologia', 'Kinesiologia'],
      localidad: 'Ramos Mejia',
    },
    {
      nombre: 'Dra. Carla Montes',
      especialidades: ['Endocrinologia', 'Nutricion'],
      localidad: 'Moron',
    },
    {
      nombre: 'Dr. Federico Paz',
      especialidades: ['Gastroenterologia'],
      localidad: 'San Isidro',
    },
    {
      nombre: 'Dra. Marina Luna',
      especialidades: ['Pediatria', 'Neumonologia'],
      localidad: 'Haedo',
    },
    {
      nombre: 'Dr. Sebastian Vera',
      especialidades: ['Urologia'],
      localidad: 'CABA',
    },
    {
      nombre: 'Dra. Rocio Salas',
      especialidades: ['Psiquiatria'],
      localidad: 'Ramos Mejia',
    },
    {
      nombre: 'Dr. Gonzalo Arias',
      especialidades: ['Otorrinolaringologia'],
      localidad: 'Moron',
    },
    {
      nombre: 'Dra. Pilar Costa',
      especialidades: ['Dermatologia', 'Reumatologia'],
      localidad: 'San Isidro',
    },
    {
      nombre: 'Centro Odontologico MedIntegral',
      especialidades: ['Odontologia'],
      localidad: 'Moron',
      esCentroMedico: true,
    },
  ];

  return Prestador.create(
    configuraciones.map((configuracion, indice) => ({
      nombre: configuracion.nombre,
      cuilCuit: String(20910000001 + indice),
      emails: [
        { direccion: `prestador.demo${indice + 1}@medintegral.com` },
      ],
      telefonos: [{ numero: String(1171000000 + indice) }],
      especialidades: configuracion.especialidades.map(
        (nombre) => buscarEspecialidad(nombre)._id
      ),
      centrosDeAtencion: [buscarCentro(configuracion.localidad)._id],
      esCentroMedico: Boolean(configuracion.esCentroMedico),
    }))
  );
};

const ejecutar = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('La semilla ampliada está bloqueada en producción');
  }

  console.log(
    '⚠️  La semilla ampliada limpia la base configurada antes de cargar datos demo.'
  );
  await ejecutarSeedBase({ limpiar: true });

  const catalogos = await cargarCatalogosAdicionales();
  const afiliadosMensuales = await cargarAfiliadosMensuales();
  const grupoFamiliar = await cargarGrupoFamiliar();
  const prestadores = await cargarPrestadoresAdicionales();

  console.log('✅ Semilla demo ampliada cargada');
  console.log(`   Especialidades totales: ${catalogos.especialidades}`);
  console.log(`   Situaciones terapéuticas totales: ${catalogos.situaciones}`);
  console.log(
    `   Afiliados mensuales adicionales: ${afiliadosMensuales.length}`
  );
  console.log(
    `   Integrantes del grupo familiar de prueba: ${grupoFamiliar.length}`
  );
  console.log(`   Prestadores adicionales: ${prestadores.length}`);
  console.log('   Distribución esperada de altas:');
  console.table(DISTRIBUCION_ALTAS);
};

ejecutar()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error al cargar la semilla ampliada:', error);
    process.exit(1);
  });
