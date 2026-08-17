const criptografia = require('crypto');
const {
  Prestador,
  Especialidad,
  Direccion,
  Horario,
  CentroDeAtencion,
  Agenda,
  Afiliado,
  SituacionTerapeutica,
} = require('./models');
const Usuario = require('./models/usuario');
const Solicitud = require('./models/solicitud');
const Turno = require('./models/turno');
const {
  HistoriaClinica,
  SituacionAfiliado,
} = require('./models/historiaClinica');
const { mongo } = require('./config');

const generarHashContrasena = (
  contrasena,
  sal = criptografia.randomBytes(16).toString('hex')
) => `${sal}:${criptografia.scryptSync(contrasena, sal, 64).toString('hex')}`;

const sumarDias = (cantidad) => {
  const fecha = new Date();
  fecha.setHours(12, 0, 0, 0);
  fecha.setDate(fecha.getDate() + cantidad);
  return fecha;
};

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

const limpiarBaseDeDatos = async () => {
  await Promise.all([
    HistoriaClinica.deleteMany({}),
    SituacionAfiliado.deleteMany({}),
    Turno.deleteMany({}),
    Solicitud.deleteMany({}),
    Usuario.deleteMany({}),
    Afiliado.deleteMany({}),
    Prestador.deleteMany({}),
    Especialidad.deleteMany({}),
    Direccion.deleteMany({}),
    Horario.deleteMany({}),
    CentroDeAtencion.deleteMany({}),
    Agenda.deleteMany({}),
    SituacionTerapeutica.deleteMany({}),
  ]);
  console.log('✅ Base de datos limpiada');
};

const ejecutarSeed = async ({ limpiar = true } = {}) => {
  try {
    await mongo.conectarDB();

    if (limpiar) {
      await limpiarBaseDeDatos();
    } else {
      const datosExistentes = await Promise.all([
        Afiliado.exists({}),
        Prestador.exists({}),
        Especialidad.exists({}),
        CentroDeAtencion.exists({}),
        Agenda.exists({}),
        Usuario.exists({}),
      ]);

      if (datosExistentes.some(Boolean)) {
        console.log('Seed demo omitida: la base ya contiene datos');
        return { seeded: false };
      }
    }

    const especialidades = await Especialidad.create([
      { nombre: 'Cardiologia' },
      { nombre: 'Pediatria' },
      { nombre: 'Dermatologia' },
      { nombre: 'Clinica Medica' },
      { nombre: 'Traumatologia' },
      { nombre: 'Ginecologia' },
    ]);

    const situacionesTerapeuticas = await SituacionTerapeutica.create([
      { nombre: 'Diabetes tipo 2' },
      { nombre: 'Hipertension arterial' },
      { nombre: 'Embarazo' },
      { nombre: 'Asma' },
      { nombre: 'Rehabilitacion' },
    ]);

    console.log(
      `✅ ${especialidades.length} especialidades y ${situacionesTerapeuticas.length} situaciones terapéuticas creadas`
    );

    const direccionesCentros = await Direccion.create([
      {
        calle: 'Av. Corrientes',
        altura: 100,
        localidad: 'CABA',
        codigoPostal: '1000',
        provincia: 'Buenos Aires',
      },
      {
        calle: 'Av. Rivadavia',
        altura: 17500,
        localidad: 'Moron',
        codigoPostal: '1708',
        provincia: 'Buenos Aires',
      },
      {
        calle: 'Av. Gaona',
        altura: 3200,
        localidad: 'Haedo',
        codigoPostal: '1706',
        provincia: 'Buenos Aires',
      },
      {
        calle: 'Av. Libertador',
        altura: 300,
        localidad: 'San Isidro',
        codigoPostal: '1642',
        provincia: 'Buenos Aires',
      },
      {
        calle: 'Av. de Mayo',
        altura: 850,
        localidad: 'Ramos Mejia',
        codigoPostal: '1704',
        provincia: 'Buenos Aires',
      },
    ]);

    const diaLaboral = {
      atiende: true,
      bloques: [{ horaInicio: 480, horaFin: 1200 }],
    };
    const diaLibre = { atiende: false, bloques: [] };
    const horarioCentro = {
      dias: {
        Lunes: diaLaboral,
        Martes: diaLaboral,
        Miercoles: diaLaboral,
        Jueves: diaLaboral,
        Viernes: diaLaboral,
        Sabado: { atiende: true, bloques: [{ horaInicio: 540, horaFin: 780 }] },
        Domingo: diaLibre,
      },
      duracionTurno: 30,
    };

    const horariosCentros = await Horario.create(
      direccionesCentros.map(() => horarioCentro)
    );

    const centros = await CentroDeAtencion.create(
      direccionesCentros.map((direccion, indice) => ({
        direccionId: direccion._id,
        horarioId: horariosCentros[indice]._id,
      }))
    );

    const prestadores = await Prestador.create([
      {
        nombre: 'Dr. House',
        cuilCuit: '20123456789',
        emails: [{ direccion: 'house@medical.com' }],
        telefonos: [{ numero: '1111111111' }],
        especialidades: [especialidades[0]._id, especialidades[3]._id],
        centrosDeAtencion: [centros[0]._id],
      },
      {
        nombre: 'Dra. Meredith Grey',
        cuilCuit: '27234567894',
        emails: [{ direccion: 'grey@medical.com' }],
        telefonos: [{ numero: '2222222222' }],
        especialidades: [especialidades[3]._id],
        centrosDeAtencion: [centros[1]._id],
      },
      {
        nombre: 'Dr. Stephen Strange',
        cuilCuit: '20345678907',
        emails: [{ direccion: 'strange@medical.com' }],
        telefonos: [{ numero: '3333333333' }],
        especialidades: [especialidades[1]._id, especialidades[2]._id],
        centrosDeAtencion: [centros[2]._id],
      },
      {
        nombre: 'Dra. Juliana Gattas',
        cuilCuit: '27456789012',
        emails: [{ direccion: 'gattas@medical.com' }],
        telefonos: [{ numero: '4444444444' }],
        especialidades: [especialidades[5]._id],
        centrosDeAtencion: [centros[3]._id],
      },
      {
        nombre: 'Clinica Mayo',
        cuilCuit: '30111111111',
        emails: [{ direccion: 'info@clinicamayo.com' }],
        telefonos: [{ numero: '5555555000' }],
        especialidades: [
          especialidades[0]._id,
          especialidades[3]._id,
          especialidades[5]._id,
        ],
        centrosDeAtencion: [centros[0]._id, centros[4]._id],
        esCentroMedico: true,
      },
      {
        nombre: 'Centro MedIntegral Oeste',
        cuilCuit: '30222222222',
        emails: [{ direccion: 'oeste@medintegral.com' }],
        telefonos: [{ numero: '5555555001' }],
        especialidades: [
          especialidades[1]._id,
          especialidades[2]._id,
          especialidades[4]._id,
        ],
        centrosDeAtencion: [centros[1]._id, centros[2]._id],
        esCentroMedico: true,
      },
      {
        nombre: 'Dr. Martin Alvarez',
        cuilCuit: '20567890123',
        emails: [{ direccion: 'alvarez@medical.com' }],
        telefonos: [{ numero: '6666666666' }],
        especialidades: [especialidades[4]._id],
        centrosDeAtencion: [centros[4]._id],
      },
      {
        nombre: 'Dra. Paula Torres',
        cuilCuit: '27678901234',
        emails: [{ direccion: 'torres@medical.com' }],
        telefonos: [{ numero: '7777777777' }],
        especialidades: [especialidades[2]._id],
        centrosDeAtencion: [centros[1]._id],
      },
    ]);

    prestadores[6].centroMedicoQueIntegra = prestadores[4]._id;
    await prestadores[6].save();

    console.log(`✅ ${prestadores.length} prestadores creados`);

    const agendas = await Agenda.create([
      {
        especialidadId: especialidades[0]._id,
        centroDeAtencionId: centros[0]._id,
        prestadorId: prestadores[0]._id,
        horario: crearHorarioAgenda(['Lunes', 'Miercoles'], '09:00', '13:00'),
      },
      {
        especialidadId: especialidades[3]._id,
        centroDeAtencionId: centros[0]._id,
        prestadorId: prestadores[0]._id,
        horario: crearHorarioAgenda(['Viernes'], '14:00', '18:00'),
      },
      {
        especialidadId: especialidades[3]._id,
        centroDeAtencionId: centros[1]._id,
        prestadorId: prestadores[1]._id,
        horario: crearHorarioAgenda(['Martes', 'Jueves'], '10:00', '16:00'),
      },
      {
        especialidadId: especialidades[1]._id,
        centroDeAtencionId: centros[2]._id,
        prestadorId: prestadores[2]._id,
        horario: crearHorarioAgenda(['Lunes', 'Jueves'], '14:00', '19:00'),
      },
      {
        especialidadId: especialidades[5]._id,
        centroDeAtencionId: centros[3]._id,
        prestadorId: prestadores[3]._id,
        horario: crearHorarioAgenda(['Martes', 'Viernes'], '08:00', '12:00'),
      },
      {
        especialidadId: especialidades[0]._id,
        centroDeAtencionId: centros[4]._id,
        prestadorId: prestadores[4]._id,
        horario: crearHorarioAgenda(['Lunes', 'Martes', 'Miercoles'], '08:00', '18:00'),
      },
      {
        especialidadId: especialidades[1]._id,
        centroDeAtencionId: centros[1]._id,
        prestadorId: prestadores[5]._id,
        horario: crearHorarioAgenda(['Lunes', 'Miercoles', 'Viernes'], '09:00', '17:00'),
      },
    ]);

    console.log(
      `✅ ${agendas.length} agendas creadas; ${prestadores.length - 6} prestadores quedan sin agenda para demostrar recordatorios`
    );

    const direccionesAfiliados = await Direccion.create([
      {
        calle: 'Siempre Viva',
        altura: 742,
        localidad: 'Moron',
        codigoPostal: '1708',
        provincia: 'Buenos Aires',
      },
      {
        calle: 'Belgrano',
        altura: 1550,
        localidad: 'Haedo',
        codigoPostal: '1706',
        provincia: 'Buenos Aires',
      },
      {
        calle: 'Mitre',
        altura: 880,
        localidad: 'Ramos Mejia',
        codigoPostal: '1704',
        provincia: 'Buenos Aires',
      },
      {
        calle: 'Sarmiento',
        altura: 420,
        localidad: 'San Isidro',
        codigoPostal: '1642',
        provincia: 'Buenos Aires',
      },
    ]);

    const fechaAltaBase = sumarDias(-420);

    const homero = await Afiliado.create({
      nombre: 'Homero',
      apellido: 'Simpson',
      fechaNacimiento: new Date('1980-05-12'),
      tipoDocumento: 'DNI',
      dni: 10000001,
      numeroAfiliado: 1000,
      numeroIntegrante: 1,
      parentesco: 'Titular',
      emails: [{ direccion: 'homero@simpson.com' }],
      telefonos: [{ numero: '1144444444' }],
      direccionId: direccionesAfiliados[0]._id,
      plan: '210',
      fechaAlta: fechaAltaBase,
    });

    const familiaresSimpson = await Afiliado.create([
      {
        nombre: 'Marge',
        apellido: 'Simpson',
        fechaNacimiento: new Date('1982-03-19'),
        tipoDocumento: 'DNI',
        dni: 10000002,
        numeroAfiliado: 1000,
        numeroIntegrante: 2,
        parentesco: 'Conyuge',
        emails: [{ direccion: 'marge@simpson.com' }],
        telefonos: [{ numero: '1155555555' }],
        direccionId: direccionesAfiliados[0]._id,
        plan: '210',
        fechaAlta: fechaAltaBase,
        afiliadoTitularId: homero._id,
      },
      {
        nombre: 'Bart',
        apellido: 'Simpson',
        fechaNacimiento: new Date('2012-02-23'),
        tipoDocumento: 'DNI',
        dni: 10000003,
        numeroAfiliado: 1000,
        numeroIntegrante: 3,
        parentesco: 'Hijo',
        emails: [{ direccion: 'bart@simpson.com' }],
        telefonos: [{ numero: '1166666666' }],
        direccionId: direccionesAfiliados[0]._id,
        plan: '210',
        fechaAlta: fechaAltaBase,
        afiliadoTitularId: homero._id,
      },
      {
        nombre: 'Lisa',
        apellido: 'Simpson',
        fechaNacimiento: new Date('2010-05-09'),
        tipoDocumento: 'DNI',
        dni: 10000004,
        numeroAfiliado: 1000,
        numeroIntegrante: 4,
        parentesco: 'Hijo',
        emails: [{ direccion: 'lisa@simpson.com' }],
        telefonos: [{ numero: '1177777777' }],
        direccionId: direccionesAfiliados[0]._id,
        plan: '210',
        fechaAlta: fechaAltaBase,
        afiliadoTitularId: homero._id,
      },
    ]);

    const lucia = await Afiliado.create({
      nombre: 'Lucia',
      apellido: 'Fernandez',
      fechaNacimiento: new Date('1991-08-14'),
      tipoDocumento: 'DNI',
      dni: 20000001,
      numeroAfiliado: 2000,
      numeroIntegrante: 1,
      parentesco: 'Titular',
      emails: [{ direccion: 'lucia@demo.com' }],
      telefonos: [{ numero: '1188888888' }],
      direccionId: direccionesAfiliados[1]._id,
      plan: '310',
      fechaAlta: sumarDias(-300),
    });

    const mateo = await Afiliado.create({
      nombre: 'Mateo',
      apellido: 'Fernandez',
      fechaNacimiento: new Date('2015-11-02'),
      tipoDocumento: 'DNI',
      dni: 20000002,
      numeroAfiliado: 2000,
      numeroIntegrante: 2,
      parentesco: 'Hijo',
      emails: [{ direccion: 'mateo@demo.com' }],
      telefonos: [{ numero: '1199999999' }],
      direccionId: direccionesAfiliados[1]._id,
      plan: '310',
      fechaAlta: sumarDias(-300),
      afiliadoTitularId: lucia._id,
    });

    const carlos = await Afiliado.create({
      nombre: 'Carlos',
      apellido: 'Gomez',
      fechaNacimiento: new Date('1975-09-03'),
      tipoDocumento: 'DNI',
      dni: 30000001,
      numeroAfiliado: 3000,
      numeroIntegrante: 1,
      parentesco: 'Titular',
      emails: [{ direccion: 'carlos@demo.com' }],
      telefonos: [{ numero: '1122222222' }],
      direccionId: direccionesAfiliados[2]._id,
      plan: '410',
      fechaAlta: sumarDias(-220),
    });

    const ana = await Afiliado.create({
      nombre: 'Ana',
      apellido: 'Gomez',
      fechaNacimiento: new Date('1978-01-17'),
      tipoDocumento: 'DNI',
      dni: 30000002,
      numeroAfiliado: 3000,
      numeroIntegrante: 2,
      parentesco: 'Conyuge',
      emails: [{ direccion: 'ana@demo.com' }],
      telefonos: [{ numero: '1133333333' }],
      direccionId: direccionesAfiliados[2]._id,
      plan: '410',
      fechaAlta: sumarDias(-220),
      afiliadoTitularId: carlos._id,
    });

    const sofia = await Afiliado.create({
      nombre: 'Sofia',
      apellido: 'Martinez',
      fechaNacimiento: new Date('1988-12-01'),
      tipoDocumento: 'DNI',
      dni: 40000001,
      numeroAfiliado: 4000,
      numeroIntegrante: 1,
      parentesco: 'Titular',
      emails: [{ direccion: 'sofia@demo.com' }],
      telefonos: [{ numero: '1141234567' }],
      direccionId: direccionesAfiliados[3]._id,
      plan: '510',
      fechaAlta: sumarDias(-150),
    });

    const tomas = await Afiliado.create({
      nombre: 'Tomas',
      apellido: 'Martinez',
      fechaNacimiento: new Date('2008-06-21'),
      tipoDocumento: 'DNI',
      dni: 40000002,
      numeroAfiliado: 4000,
      numeroIntegrante: 2,
      parentesco: 'Hijo',
      emails: [{ direccion: 'tomas@demo.com' }],
      telefonos: [{ numero: '1147654321' }],
      direccionId: direccionesAfiliados[3]._id,
      plan: '510',
      fechaAlta: sumarDias(-150),
      afiliadoTitularId: sofia._id,
    });

    const afiliados = [
      homero,
      ...familiaresSimpson,
      lucia,
      mateo,
      carlos,
      ana,
      sofia,
      tomas,
    ];

    console.log(`✅ ${afiliados.length} afiliados creados en 4 grupos familiares`);

    const usuarioAdministrador = await Usuario.create({
      email: 'admin@medintegral.com',
      hashContrasena: generarHashContrasena('Admin1234'),
      rol: 'ADMIN',
      debeCambiarContrasena: false,
    });

    const usuarioHomero = await Usuario.create({
      email: 'homero@simpson.com',
      dniAcceso: '10000001',
      hashContrasena: generarHashContrasena('Demo1234'),
      rol: 'AFILIADO',
      afiliadoId: homero._id,
      debeCambiarContrasena: false,
    });

    const usuarioHouse = await Usuario.create({
      email: 'house@medical.com',
      dniAcceso: '12345678',
      hashContrasena: generarHashContrasena('Demo1234'),
      rol: 'PRESTADOR',
      prestadorId: prestadores[0]._id,
      debeCambiarContrasena: false,
    });

    console.log('✅ Usuarios demo creados para ADMIN, AFILIADO y PRESTADOR');

    const solicitudes = await Solicitud.create([
      {
        tipo: 'RECETA',
        afiliadoId: homero._id,
        creadorAfiliadoId: homero._id,
        estado: 'Recibido',
        datos: {
          medicamento: 'Losartan 50 mg',
          cantidad: 2,
          presentacion: 'Comprimidos',
        },
        observaciones: 'Renovación de tratamiento habitual',
      },
      {
        tipo: 'AUTORIZACION',
        afiliadoId: familiaresSimpson[0]._id,
        creadorAfiliadoId: homero._id,
        prestadorId: prestadores[3]._id,
        especialidadId: especialidades[5]._id,
        estado: 'En análisis',
        datos: {
          fechaPrestacion: sumarDias(12),
          lugar: 'Centro San Isidro',
          diasInternacion: 0,
        },
        observaciones: 'Control ginecológico programado',
        historialEstados: [
          { estado: 'Recibido', fecha: sumarDias(-2) },
          {
            estado: 'En análisis',
            fecha: sumarDias(-1),
            usuarioId: usuarioHouse._id,
          },
        ],
      },
      {
        tipo: 'REINTEGRO',
        afiliadoId: homero._id,
        creadorAfiliadoId: homero._id,
        prestadorId: prestadores[0]._id,
        especialidadId: especialidades[0]._id,
        estado: 'Observado',
        datos: {
          fechaPrestacion: sumarDias(-8),
          lugar: 'Consultorio externo',
          factura: {
            fecha: sumarDias(-8),
            cuit: '30700000001',
            total: 28500,
            personaFacturada: 'Homero Simpson',
          },
          formaPago: 'TRANSFERENCIA',
          cbu: '0000003100012345678901',
        },
        observaciones: 'Falta adjuntar comprobante completo',
        historialEstados: [
          { estado: 'Recibido', fecha: sumarDias(-6) },
          {
            estado: 'En análisis',
            fecha: sumarDias(-5),
            usuarioId: usuarioHouse._id,
          },
          {
            estado: 'Observado',
            fecha: sumarDias(-4),
            usuarioId: usuarioHouse._id,
            motivo: 'Comprobante incompleto',
          },
        ],
        comentarios: [
          {
            texto: 'Por favor adjuntar la segunda hoja de la factura.',
            usuarioId: usuarioHouse._id,
            fecha: sumarDias(-4),
          },
        ],
      },
      {
        tipo: 'RECETA',
        afiliadoId: lucia._id,
        creadorAfiliadoId: lucia._id,
        estado: 'Aprobado',
        datos: {
          medicamento: 'Salbutamol',
          cantidad: 1,
          presentacion: 'Aerosol',
        },
        observaciones: 'Tratamiento de rescate',
        historialEstados: [
          { estado: 'Recibido', fecha: sumarDias(-3) },
          { estado: 'En análisis', fecha: sumarDias(-2) },
          { estado: 'Aprobado', fecha: sumarDias(-1) },
        ],
      },
      {
        tipo: 'AUTORIZACION',
        afiliadoId: carlos._id,
        creadorAfiliadoId: carlos._id,
        prestadorId: prestadores[6]._id,
        especialidadId: especialidades[4]._id,
        estado: 'Rechazado',
        datos: {
          fechaPrestacion: sumarDias(20),
          lugar: 'Clinica Mayo',
          diasInternacion: 1,
        },
        observaciones: 'Práctica fuera de cobertura del plan informado',
        historialEstados: [
          { estado: 'Recibido', fecha: sumarDias(-3) },
          { estado: 'En análisis', fecha: sumarDias(-2) },
          {
            estado: 'Rechazado',
            fecha: sumarDias(-1),
            motivo: 'Requiere documentación adicional',
          },
        ],
      },
    ]);

    console.log(`✅ ${solicitudes.length} solicitudes creadas con todos los estados`);

    const turnos = await Turno.create([
      {
        agendaId: agendas[0]._id,
        prestadorId: prestadores[0]._id,
        afiliadoId: homero._id,
        reservadoPorAfiliadoId: homero._id,
        fecha: sumarDias(3),
        hora: '09:00',
        estado: 'RESERVADO',
      },
      {
        agendaId: agendas[0]._id,
        prestadorId: prestadores[0]._id,
        afiliadoId: familiaresSimpson[0]._id,
        reservadoPorAfiliadoId: homero._id,
        fecha: sumarDias(10),
        hora: '10:00',
        estado: 'RESERVADO',
      },
      {
        agendaId: agendas[2]._id,
        prestadorId: prestadores[1]._id,
        afiliadoId: lucia._id,
        reservadoPorAfiliadoId: lucia._id,
        fecha: sumarDias(5),
        hora: '11:00',
        estado: 'RESERVADO',
      },
      {
        agendaId: agendas[0]._id,
        prestadorId: prestadores[0]._id,
        afiliadoId: homero._id,
        reservadoPorAfiliadoId: homero._id,
        fecha: sumarDias(-14),
        hora: '11:30',
        estado: 'ATENDIDO',
      },
      {
        agendaId: agendas[0]._id,
        prestadorId: prestadores[0]._id,
        afiliadoId: homero._id,
        reservadoPorAfiliadoId: homero._id,
        fecha: sumarDias(-45),
        hora: '12:00',
        estado: 'ATENDIDO',
      },
      {
        agendaId: agendas[3]._id,
        prestadorId: prestadores[2]._id,
        afiliadoId: sofia._id,
        reservadoPorAfiliadoId: sofia._id,
        fecha: sumarDias(8),
        hora: '15:00',
        estado: 'CANCELADO',
      },
    ]);

    console.log(
      `✅ ${turnos.length} turnos creados entre reservados, atendidos y cancelados`
    );

    const historias = await HistoriaClinica.create([
      {
        afiliadoId: homero._id,
        prestadorId: prestadores[0]._id,
        turnoId: turnos[3]._id,
        nota:
          'Control cardiológico. Presión arterial estable. Mantener medicación y actividad física moderada.',
        fecha: sumarDias(-14),
      },
      {
        afiliadoId: homero._id,
        prestadorId: prestadores[0]._id,
        turnoId: turnos[4]._id,
        nota:
          'Consulta por hipertensión. Se indicó control domiciliario de presión durante dos semanas.',
        fecha: sumarDias(-45),
      },
      {
        afiliadoId: lucia._id,
        prestadorId: prestadores[2]._id,
        nota:
          'Antecedente de asma leve. Evolución favorable y sin crisis recientes.',
        fecha: sumarDias(-30),
      },
      {
        afiliadoId: carlos._id,
        prestadorId: prestadores[6]._id,
        nota:
          'Dolor de rodilla derecha posterior a actividad física. Se indica kinesiología y control.',
        fecha: sumarDias(-18),
      },
    ]);

    const situacionesAfiliados = await SituacionAfiliado.create([
      {
        afiliadoId: homero._id,
        situacionTerapeuticaId: situacionesTerapeuticas[1]._id,
        fechaInicio: sumarDias(-180),
        activa: true,
        registradaPorPrestadorId: prestadores[0]._id,
      },
      {
        afiliadoId: lucia._id,
        situacionTerapeuticaId: situacionesTerapeuticas[3]._id,
        fechaInicio: sumarDias(-365),
        activa: true,
        registradaPorPrestadorId: prestadores[2]._id,
      },
      {
        afiliadoId: carlos._id,
        situacionTerapeuticaId: situacionesTerapeuticas[4]._id,
        fechaInicio: sumarDias(-60),
        fechaFin: sumarDias(-5),
        activa: false,
        registradaPorPrestadorId: prestadores[6]._id,
      },
    ]);

    console.log(
      `✅ ${historias.length} notas clínicas y ${situacionesAfiliados.length} situaciones de afiliados creadas`
    );

    console.log('\n🎉 Seed de demostración completada exitosamente');
    console.log('---------------------------------------------');
    console.log('ADMIN      admin@medintegral.com / Admin1234');
    console.log('AFILIADO   10000001 o homero@simpson.com / Demo1234');
    console.log('PRESTADOR  12345678 o house@medical.com / Demo1234');
    console.log('---------------------------------------------');
    console.log(
      'Para probar activación podés usar, por ejemplo, Lucia Fernandez (DNI 20000001, lucia@demo.com) o Dra. Meredith Grey (DNI 23456789, grey@medical.com).'
    );

    return {
      seeded: true,
      usuarioAdministrador,
      usuarioHomero,
      usuarioHouse,
    };
  } catch (error) {
    console.error('❌ Error en la seed:', error);
    throw error;
  }
};

if (require.main === module) {
  ejecutarSeed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = {
  ejecutarSeed,
  runSeed: ejecutarSeed,
};
