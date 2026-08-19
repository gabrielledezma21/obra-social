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

const crearFechaAlta = (mes, indice) => {
  const dia = String(5 + (indice % 20)).padStart(2, '0');
  return new Date(`${mes}-${dia}T12:00:00.000Z`);
};

const cargarAfiliadosMensuales = async () => {
  const direcciones = [];
  const plantillas = [];
  let secuencia = 0;

  for (const [mes, planes] of Object.entries(DISTRIBUCION_ALTAS)) {
    for (const [plan, cantidad] of Object.entries(planes)) {
      for (let indice = 0; indice < cantidad; indice += 1) {
        secuencia += 1;
        direcciones.push({
          calle: `Calle Demo ${secuencia}`,
          altura: 100 + secuencia,
          localidad: ['Moron', 'Haedo', 'Ramos Mejia', 'San Isidro'][
            secuencia % 4
          ],
          codigoPostal: ['1708', '1706', '1704', '1642'][secuencia % 4],
          provincia: 'Buenos Aires',
        });
        plantillas.push({ mes, plan, indice, secuencia });
      }
    }
  }

  const direccionesCreadas = await Direccion.create(direcciones);
  const afiliados = await Afiliado.create(
    plantillas.map(({ mes, plan, indice, secuencia }, posicion) => ({
      nombre: `Demo${secuencia}`,
      apellido: `Plan${plan}`,
      fechaNacimiento: new Date(`19${80 + (secuencia % 18)}-06-15T12:00:00.000Z`),
      tipoDocumento: 'DNI',
      dni: 50000000 + secuencia,
      numeroAfiliado: 3000 + secuencia,
      numeroIntegrante: 1,
      parentesco: 'Titular',
      emails: [{ direccion: `demo${secuencia}@medintegral.test` }],
      telefonos: [{ numero: String(1160000000 + secuencia) }],
      direccionId: direccionesCreadas[posicion]._id,
      direccionesIds: [direccionesCreadas[posicion]._id],
      plan,
      fechaAlta: crearFechaAlta(mes, indice),
    }))
  );

  return afiliados;
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
    emails: [{ direccion: 'laura.prueba@medintegral.test' }],
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
      situacionesTerapeuticas: situaciones[1] ? [situaciones[1]._id] : [],
      emails: [{ direccion: 'martin.prueba@medintegral.test' }],
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
      situacionesTerapeuticas: situaciones[2] ? [situaciones[2]._id] : [],
      emails: [{ direccion: 'sofia.prueba@medintegral.test' }],
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
    throw new Error('La seed base no generó especialidades o centros de atención');
  }

  const buscarEspecialidad = (nombre) =>
    especialidades.find((especialidad) => especialidad.nombre === nombre) ||
    especialidades[0];

  const buscarCentro = (localidad) =>
    centros.find((centro) => centro.direccionId?.localidad === localidad) ||
    centros[0];

  const configuraciones = [
    ['Cardiologia', 'Moron'],
    ['Cardiologia', 'Moron'],
    ['Cardiologia', 'Moron'],
    ['Cardiologia', 'Haedo'],
    ['Clinica Medica', 'Moron'],
    ['Clinica Medica', 'Moron'],
    ['Clinica Medica', 'Ramos Mejia'],
    ['Pediatria', 'Haedo'],
    ['Pediatria', 'Haedo'],
    ['Dermatologia', 'Ramos Mejia'],
    ['Traumatologia', 'San Isidro'],
    ['Ginecologia', 'Moron'],
  ];

  return Prestador.create(
    configuraciones.map(([especialidad, localidad], indice) => ({
      nombre: `Prestador Demo ${String(indice + 1).padStart(2, '0')}`,
      cuilCuit: String(20910000001 + indice),
      emails: [{ direccion: `prestador.demo${indice + 1}@medintegral.test` }],
      telefonos: [{ numero: String(1171000000 + indice) }],
      especialidades: [buscarEspecialidad(especialidad)._id],
      centrosDeAtencion: [buscarCentro(localidad)._id],
    }))
  );
};

const ejecutar = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('La semilla ampliada está bloqueada en producción');
  }

  console.log('⚠️  La semilla ampliada limpia la base configurada antes de cargar datos demo.');
  await ejecutarSeedBase({ limpiar: true });

  const afiliadosMensuales = await cargarAfiliadosMensuales();
  const grupoFamiliar = await cargarGrupoFamiliar();
  const prestadores = await cargarPrestadoresAdicionales();

  console.log('✅ Semilla demo ampliada cargada');
  console.log(`   Afiliados mensuales adicionales: ${afiliadosMensuales.length}`);
  console.log(`   Integrantes del grupo familiar de prueba: ${grupoFamiliar.length}`);
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
