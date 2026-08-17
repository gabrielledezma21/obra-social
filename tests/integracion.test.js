const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const uriPruebas = process.env.MONGO_URI_TEST;

const obtenerNombreBase = (uri = '') => {
  const sinConsulta = uri.split('?')[0].replace(/\/$/, '');
  return sinConsulta.slice(sinConsulta.lastIndexOf('/') + 1);
};

const nombreBasePruebas = obtenerNombreBase(uriPruebas);

if (!uriPruebas) {
  throw new Error(
    'Debés definir MONGO_URI_TEST con una base exclusiva para ejecutar los tests.'
  );
}

if (!/(test|prueba)/i.test(nombreBasePruebas)) {
  throw new Error(
    `La base de pruebas debe incluir "test" o "prueba" en su nombre. Recibida: ${nombreBasePruebas || 'sin nombre'}`
  );
}

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = uriPruebas;
delete process.env.MONGODB_URI;
delete process.env.REDIS_URL;
process.env.SEED_DEMO_DATA = 'false';
process.env.SECRETO_AUTENTICACION =
  process.env.SECRETO_AUTENTICACION_TEST || 'medintegral-secreto-pruebas';

const aplicacion = require('../src/app');
const { runSeed: ejecutarSeed } = require('../src/reiniciarDB');
const { mongoose } = require('../src/config/db');
const {
  Afiliado,
  Prestador,
  Agenda,
  Especialidad,
  CentroDeAtencion,
  Direccion,
  SituacionTerapeutica,
} = require('../src/models');
const Usuario = require('../src/models/usuario');
const Solicitud = require('../src/models/solicitud');
const Turno = require('../src/models/turno');
const {
  HistoriaClinica,
  SituacionAfiliado,
} = require('../src/models/historiaClinica');

let servidor;
let urlBase;

const tokens = {
  administrador: '',
  afiliado: '',
  prestador: '',
};

const contexto = {
  homeroId: '',
  houseId: '',
  especialidadId: '',
  situacionTerapeuticaId: '',
  agendaHouseId: '',
  solicitudFlujoId: '',
};

const DIAS_SEMANA = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miercoles',
  'Jueves',
  'Viernes',
  'Sabado',
];

const formatearFecha = (fecha) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(
    fecha.getDate()
  ).padStart(2, '0')}`;

const obtenerFechaFuturaParaDia = (diaObjetivo, minimoDias = 7) => {
  const indiceObjetivo = DIAS_SEMANA.indexOf(diaObjetivo);
  if (indiceObjetivo < 0) throw new Error(`Día inválido: ${diaObjetivo}`);

  const fecha = new Date();
  fecha.setHours(12, 0, 0, 0);

  for (let desplazamiento = minimoDias; desplazamiento <= minimoDias + 14; desplazamiento += 1) {
    const candidata = new Date(fecha);
    candidata.setDate(candidata.getDate() + desplazamiento);
    if (candidata.getDay() === indiceObjetivo) return candidata;
  }

  throw new Error(`No se pudo encontrar una fecha futura para ${diaObjetivo}`);
};

const obtenerFechaPasadaParaDia = (diaObjetivo, minimoDias = 7) => {
  const indiceObjetivo = DIAS_SEMANA.indexOf(diaObjetivo);
  if (indiceObjetivo < 0) throw new Error(`Día inválido: ${diaObjetivo}`);

  const fecha = new Date();
  fecha.setHours(12, 0, 0, 0);

  for (let desplazamiento = minimoDias; desplazamiento <= minimoDias + 14; desplazamiento += 1) {
    const candidata = new Date(fecha);
    candidata.setDate(candidata.getDate() - desplazamiento);
    if (candidata.getDay() === indiceObjetivo) return candidata;
  }

  throw new Error(`No se pudo encontrar una fecha pasada para ${diaObjetivo}`);
};

const crearHorario = (
  diasActivos = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'],
  horaInicio = '08:00',
  horaFin = '18:00',
  duracionTurno = 30
) => {
  const dias = {};
  DIAS_SEMANA.slice(1).concat('Domingo').forEach((dia) => {
    dias[dia] = { atiende: false, bloques: [] };
  });

  diasActivos.forEach((dia) => {
    dias[dia] = {
      atiende: true,
      bloques: [{ horaInicio, horaFin }],
    };
  });

  return { dias, duracionTurno };
};

const solicitar = async (
  ruta,
  { metodo = 'GET', token = '', cuerpo = undefined } = {}
) => {
  const encabezados = {};
  if (cuerpo !== undefined) encabezados['Content-Type'] = 'application/json';
  if (token) encabezados.Authorization = `Bearer ${token}`;

  const respuesta = await fetch(`${urlBase}${ruta}`, {
    method: metodo,
    headers: encabezados,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });

  const texto = await respuesta.text();
  let datos = null;
  if (texto) {
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = texto;
    }
  }

  return {
    estado: respuesta.status,
    datos,
    encabezados: respuesta.headers,
  };
};

const exigirEstado = (respuesta, estadoEsperado, contextoError = '') => {
  assert.equal(
    respuesta.estado,
    estadoEsperado,
    `${contextoError}\nRespuesta: ${JSON.stringify(respuesta.datos, null, 2)}`
  );
};

const iniciarSesion = async (identificador, contrasena, rol) => {
  const respuesta = await solicitar('/autenticacion/iniciar-sesion', {
    metodo: 'POST',
    cuerpo: { identificador, contrasena, rol },
  });
  exigirEstado(respuesta, 200, `No se pudo iniciar sesión como ${rol}`);
  assert.ok(respuesta.datos?.token, `El login de ${rol} no devolvió token`);
  assert.equal(respuesta.datos?.usuario?.rol, rol);
  return respuesta.datos.token;
};

const obtenerId = (valor) => String(valor?._id ?? valor?.id ?? valor ?? '');

const cargarContextoSeed = async () => {
  const [homero, house, situacionTerapeutica] = await Promise.all([
    Afiliado.findOne({ dni: 10000001 }),
    Prestador.findOne({ nombre: 'Dr. House' }),
    SituacionTerapeutica.findOne(),
  ]);

  assert.ok(homero, 'La seed debe contener a Homero Simpson');
  assert.ok(house, 'La seed debe contener a Dr. House');
  assert.ok(house.especialidades?.length, 'Dr. House debe tener especialidad');
  assert.ok(situacionTerapeutica, 'La seed debe contener situaciones terapéuticas');

  const agendaHouse = await Agenda.findOne({ prestadorId: house._id });
  assert.ok(agendaHouse, 'Dr. House debe tener al menos una agenda');

  contexto.homeroId = obtenerId(homero);
  contexto.houseId = obtenerId(house);
  contexto.especialidadId = obtenerId(house.especialidades[0]);
  contexto.situacionTerapeuticaId = obtenerId(situacionTerapeutica);
  contexto.agendaHouseId = obtenerId(agendaHouse);
};

before(async () => {
  await ejecutarSeed({ clean: true });
  await cargarContextoSeed();

  await new Promise((resolver, rechazar) => {
    servidor = aplicacion.listen(0, '127.0.0.1', resolver);
    servidor.once('error', rechazar);
  });

  const direccion = servidor.address();
  urlBase = `http://127.0.0.1:${direccion.port}`;

  tokens.administrador = await iniciarSesion(
    'admin@medintegral.com',
    'Admin1234',
    'ADMIN'
  );
  tokens.afiliado = await iniciarSesion('10000001', 'Demo1234', 'AFILIADO');
  tokens.prestador = await iniciarSesion('12345678', 'Demo1234', 'PRESTADOR');
});

after(async () => {
  if (servidor) {
    await new Promise((resolver) => servidor.close(resolver));
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test('MedIntegral - integración completa de API y persistencia', async (t) => {
  await t.test('salud, autenticación y permisos por rol', async () => {
    let respuesta = await solicitar('/health');
    exigirEstado(respuesta, 200, 'GET /health');
    assert.equal(respuesta.datos?.estado, 'ok');

    respuesta = await solicitar('/afiliados');
    exigirEstado(respuesta, 401, 'Las rutas administrativas deben exigir token');

    respuesta = await solicitar('/autenticacion/iniciar-sesion', {
      metodo: 'POST',
      cuerpo: {
        identificador: 'admin@medintegral.com',
        contrasena: 'incorrecta',
        rol: 'ADMIN',
      },
    });
    exigirEstado(respuesta, 401, 'Una contraseña incorrecta debe rechazarse');

    const tokenAdministrador = await iniciarSesion(
      'admin@medintegral.com',
      'Admin1234',
      'ADMIN'
    );
    assert.ok(tokenAdministrador);

    const tokenAfiliado = await iniciarSesion('10000001', 'Demo1234', 'AFILIADO');
    assert.ok(tokenAfiliado);

    const tokenPrestador = await iniciarSesion('12345678', 'Demo1234', 'PRESTADOR');
    assert.ok(tokenPrestador);

    respuesta = await solicitar('/prestadores', { token: tokens.afiliado });
    exigirEstado(respuesta, 403, 'AFILIADO no debe entrar a administración');

    respuesta = await solicitar('/afiliados', { token: tokens.prestador });
    exigirEstado(respuesta, 403, 'PRESTADOR no debe entrar a administración');

    respuesta = await solicitar('/portal-afiliado/mi-perfil', {
      token: tokens.administrador,
    });
    exigirEstado(respuesta, 403, 'ADMIN no debe entrar al portal afiliado');

    respuesta = await solicitar('/portal-prestador/mi-perfil', {
      token: tokens.afiliado,
    });
    exigirEstado(respuesta, 403, 'AFILIADO no debe entrar al portal prestador');

    respuesta = await solicitar('/afiliados', { token: 'token-invalido' });
    exigirEstado(respuesta, 401, 'Un token inválido debe rechazarse');
  });

  await t.test('seed, relaciones y todos los GET administrativos principales', async () => {
    const [
      cantidadAfiliados,
      cantidadPrestadores,
      cantidadAgendas,
      cantidadEspecialidades,
      cantidadSituaciones,
    ] = await Promise.all([
      Afiliado.countDocuments(),
      Prestador.countDocuments(),
      Agenda.countDocuments(),
      Especialidad.countDocuments(),
      SituacionTerapeutica.countDocuments(),
    ]);

    assert.equal(cantidadAfiliados, 10);
    assert.equal(cantidadPrestadores, 8);
    assert.equal(cantidadAgendas, 7);
    assert.equal(cantidadEspecialidades, 6);
    assert.equal(cantidadSituaciones, 5);

    let respuesta = await solicitar('/afiliados', { token: tokens.administrador });
    exigirEstado(respuesta, 200, 'GET /afiliados');
    assert.equal(respuesta.datos.length, 10);
    const homero = respuesta.datos.find((afiliado) => afiliado.dni === 10000001);
    assert.ok(homero, 'La seed debe contener a Homero');
    assert.equal(obtenerId(homero), contexto.homeroId);

    respuesta = await solicitar(`/afiliados/${contexto.homeroId}`, {
      token: tokens.administrador,
    });
    exigirEstado(respuesta, 200, 'GET /afiliados/:id');
    assert.equal(respuesta.datos?.familiares?.length, 3);
    for (const familiar of respuesta.datos.familiares) {
      assert.equal(
        obtenerId(familiar.afiliadoTitularId),
        contexto.homeroId,
        'Cada integrante debe conservar la referencia a su titular'
      );
    }

    respuesta = await solicitar('/afiliados?apellido=Simpson', {
      token: tokens.administrador,
    });
    exigirEstado(respuesta, 200, 'GET /afiliados?apellido=Simpson');
    assert.equal(respuesta.datos.length, 4);

    respuesta = await solicitar('/afiliados?credencial=1000-3', {
      token: tokens.administrador,
    });
    exigirEstado(respuesta, 200, 'GET /afiliados?credencial=1000-3');
    assert.equal(respuesta.datos.length, 1);
    assert.equal(respuesta.datos[0].nombre, 'Bart');

    for (const ruta of ['/afiliados/provincias', '/afiliados/localidades']) {
      respuesta = await solicitar(ruta, { token: tokens.administrador });
      exigirEstado(respuesta, 200, `GET ${ruta}`);
      assert.ok(Array.isArray(respuesta.datos));
    }

    respuesta = await solicitar('/prestadores', { token: tokens.administrador });
    exigirEstado(respuesta, 200, 'GET /prestadores');
    assert.equal(respuesta.datos.length, 8);
    const house = respuesta.datos.find((prestador) => prestador.nombre === 'Dr. House');
    assert.ok(house, 'La seed debe contener a Dr. House');
    assert.equal(obtenerId(house), contexto.houseId);

    respuesta = await solicitar(`/prestadores/${contexto.houseId}`, {
      token: tokens.administrador,
    });
    exigirEstado(respuesta, 200, 'GET /prestadores/:id');
    assert.ok(Array.isArray(respuesta.datos?.agendas));
    assert.ok(respuesta.datos.agendas.length >= 2);

    for (const ruta of ['/prestadores/provincias', '/prestadores/localidades']) {
      respuesta = await solicitar(ruta, { token: tokens.administrador });
      exigirEstado(respuesta, 200, `GET ${ruta}`);
      assert.ok(Array.isArray(respuesta.datos));
    }

    respuesta = await solicitar('/agendas', { token: tokens.administrador });
    exigirEstado(respuesta, 200, 'GET /agendas');
    assert.equal(respuesta.datos.length, 7);
    assert.ok(
      respuesta.datos.some((agenda) => obtenerId(agenda) === contexto.agendaHouseId),
      'La agenda de Dr. House debe aparecer en el listado'
    );

    respuesta = await solicitar(`/agendas/${contexto.agendaHouseId}`, {
      token: tokens.administrador,
    });
    exigirEstado(respuesta, 200, 'GET /agendas/:id');
    assert.equal(obtenerId(respuesta.datos?.prestadorId), contexto.houseId);
    assert.ok(respuesta.datos?.centroDeAtencionId?.direccionId);

    respuesta = await solicitar('/especialidades', { token: tokens.administrador });
    exigirEstado(respuesta, 200, 'GET /especialidades');
    assert.equal(respuesta.datos.length, 6);

    respuesta = await solicitar('/situaciones-terapeuticas', {
      token: tokens.administrador,
    });
    exigirEstado(respuesta, 200, 'GET /situaciones-terapeuticas');
    assert.equal(respuesta.datos.length, 5);
    assert.ok(
      respuesta.datos.some(
        (situacion) => obtenerId(situacion) === contexto.situacionTerapeuticaId
      )
    );

    const rutasReportes = [
      '/reportes/afiliados-altas',
      '/reportes/prestadores-altas',
      '/reportes/prestadores-distribucion',
      '/reportes/prestadores-sin-agenda',
      `/reportes/prestadores/${contexto.houseId}/horarios-sin-turnos`,
      `/reportes/situaciones/${contexto.homeroId}`,
    ];

    for (const ruta of rutasReportes) {
      respuesta = await solicitar(ruta, { token: tokens.administrador });
      exigirEstado(respuesta, 200, `GET ${ruta}`);
    }

    const afiliadosNoTitulares = await Afiliado.find({
      parentesco: { $ne: 'Titular' },
    });
    for (const integrante of afiliadosNoTitulares) {
      assert.ok(integrante.afiliadoTitularId, 'Todo familiar debe referenciar un titular');
      const titular = await Afiliado.findById(integrante.afiliadoTitularId);
      assert.ok(titular, 'El titular referenciado debe existir');
      assert.equal(integrante.numeroAfiliado, titular.numeroAfiliado);
    }

    const agendas = await Agenda.find();
    for (const agenda of agendas) {
      const prestador = await Prestador.findById(agenda.prestadorId);
      const centro = await CentroDeAtencion.findById(agenda.centroDeAtencionId);
      const especialidad = await Especialidad.findById(agenda.especialidadId);
      assert.ok(prestador, 'Toda agenda debe referenciar un prestador existente');
      assert.ok(centro, 'Toda agenda debe referenciar un centro existente');
      assert.ok(especialidad, 'Toda agenda debe referenciar una especialidad existente');
      assert.ok(
        prestador.especialidades.some(
          (id) => String(id) === String(agenda.especialidadId)
        ),
        'La especialidad de la agenda debe pertenecer al prestador'
      );
      assert.ok(
        prestador.centrosDeAtencion.some(
          (id) => String(id) === String(agenda.centroDeAtencionId)
        ),
        'El centro de la agenda debe pertenecer al prestador'
      );
    }
  });

  await t.test('CRUD de afiliados persiste creación, edición, grupo familiar y baja', async () => {
    const datosTitular = {
      nombre: 'Prueba',
      apellido: 'Persistencia',
      fechaNacimiento: '1987-04-10',
      tipoDocumento: 'DNI',
      dni: 91000001,
      parentesco: 'Titular',
      emails: [{ direccion: 'persistencia.afiliado@test.com' }],
      telefonos: [{ numero: '1191000001' }],
      direcciones: [
        {
          calle: 'Calle Pruebas',
          altura: 123,
          localidad: 'Moron',
          codigoPostal: '1708',
          provincia: 'Buenos Aires',
        },
      ],
      plan: '210',
      fechaAlta: '2026-01-15',
    };

    let respuesta = await solicitar('/afiliados', {
      metodo: 'POST',
      token: tokens.administrador,
      cuerpo: datosTitular,
    });
    exigirEstado(respuesta, 201, 'POST /afiliados');
    const titularId = obtenerId(respuesta.datos);
    assert.ok(titularId);
    assert.equal(respuesta.datos.numeroIntegrante, 1);

    let persistido = await Afiliado.findById(titularId).populate('direccionId');
    assert.ok(persistido, 'El titular debe persistirse en MongoDB');
    assert.equal(persistido.nombre, 'Prueba');
    assert.equal(persistido.direccionId.calle, 'Calle Pruebas');

    respuesta = await solicitar(`/afiliados/${titularId}`, {
      token: tokens.administrador,
    });
    exigirEstado(respuesta, 200, 'GET del afiliado recién creado');
    assert.equal(respuesta.datos.nombre, 'Prueba');

    respuesta = await solicitar(`/afiliados/${titularId}`, {
      metodo: 'PUT',
      token: tokens.administrador,
      cuerpo: {
        nombre: 'Prueba Editada',
        plan: '310',
        emails: [{ direccion: 'afiliado.editado@test.com' }],
        telefonos: [{ numero: '1191000002' }],
        direcciones: [
          {
            calle: 'Avenida Persistencia',
            altura: 456,
            localidad: 'Haedo',
            codigoPostal: '1706',
            provincia: 'Buenos Aires',
          },
        ],
      },
    });
    exigirEstado(respuesta, 200, 'PUT /afiliados/:id');

    respuesta = await solicitar(`/afiliados/${titularId}`, {
      token: tokens.administrador,
    });
    exigirEstado(respuesta, 200, 'GET después de editar afiliado');
    assert.equal(respuesta.datos.nombre, 'Prueba Editada');
    assert.equal(respuesta.datos.plan, '310');
    assert.equal(respuesta.datos.emails[0].direccion, 'afiliado.editado@test.com');
    assert.equal(respuesta.datos.direccionId.calle, 'Avenida Persistencia');

    persistido = await Afiliado.findById(titularId).populate('direccionId');
    assert.equal(persistido.nombre, 'Prueba Editada');
    assert.equal(persistido.plan, '310');
    assert.equal(persistido.direccionId.calle, 'Avenida Persistencia');

    respuesta = await solicitar('/afiliados', {
      metodo: 'POST',
      token: tokens.administrador,
      cuerpo: {
        nombre: 'Dependiente',
        apellido: 'Persistencia',
        fechaNacimiento: '2015-07-02',
        tipoDocumento: 'DNI',
        dni: 91000002,
        parentesco: 'Hijo',
        emails: [{ direccion: 'dependiente@test.com' }],
        telefonos: [{ numero: '1191000003' }],
        direcciones: [
          {
            calle: 'Avenida Persistencia',
            altura: 456,
            localidad: 'Haedo',
            codigoPostal: '1706',
            provincia: 'Buenos Aires',
          },
        ],
        plan: '310',
        fechaAlta: '2026-01-15',
        afiliadoTitularId: titularId,
      },
    });
    exigirEstado(respuesta, 201, 'POST familiar');
    const familiarId = obtenerId(respuesta.datos);
    assert.equal(respuesta.datos.numeroAfiliado, persistido.numeroAfiliado);
    assert.equal(respuesta.datos.numeroIntegrante, 2);

    respuesta = await solicitar(`/afiliados/${titularId}`, {
      token: tokens.administrador,
    });
    exigirEstado(respuesta, 200, 'GET titular con familiar');
    assert.ok(
      respuesta.datos.familiares.some((familiar) => obtenerId(familiar) === familiarId),
      'El familiar debe aparecer en el grupo familiar del titular'
    );

    respuesta = await solicitar('/afiliados', { token: tokens.administrador });
    exigirEstado(respuesta, 200, 'GET listado después de crear familiar');
    assert.ok(
      respuesta.datos.some((afiliado) => obtenerId(afiliado) === familiarId),
      'El GET general debe incluir integrantes familiares'
    );

    respuesta = await solicitar(`/afiliados/${titularId}`, {
      metodo: 'DELETE',
      token: tokens.administrador,
    });
    exigirEstado(respuesta, 204, 'DELETE titular');

    assert.equal(await Afiliado.findById(titularId), null);
    assert.equal(await Afiliado.findById(familiarId), null);

    respuesta = await solicitar(`/afiliados/${titularId}`, {
      token: tokens.administrador,
    });
    exigirEstado(respuesta, 404, 'El afiliado eliminado no debe recuperarse');
  });

  await t.test('CRUD de prestadores y agendas persiste correctamente', async () => {
    const especialidad = await Especialidad.findOne({ nombre: 'Cardiologia' });
    assert.ok(especialidad);

    let respuesta = await solicitar('/prestadores', {
      metodo: 'POST',
      token: tokens.administrador,
      cuerpo: {
        nombre: 'Dr. Persistencia API',
        cuilCuit: '20910000019',
        emails: [{ direccion: 'prestador.persistencia@test.com' }],
        telefonos: [{ numero: '1191000010' }],
        especialidades: [especialidad._id],
        centrosDeAtencion: [
          {
            direccion: {
              calle: 'Consultorio Test',
              altura: 999,
              localidad: 'Moron',
              codigoPostal: '1708',
              provincia: 'Buenos Aires',
            },
            horario: crearHorario(),
          },
        ],
        esCentroMedico: false,
      },
    });
    exigirEstado(respuesta, 201, 'POST /prestadores');
    const prestadorId = obtenerId(respuesta.datos);
    const centroId = obtenerId(respuesta.datos.centrosDeAtencion?.[0]);
    assert.ok(prestadorId);
    assert.ok(centroId);

    let prestadorPersistido = await Prestador.findById(prestadorId);
    assert.ok(prestadorPersistido, 'El prestador debe persistirse');
    assert.equal(prestadorPersistido.nombre, 'Dr. Persistencia API');

    respuesta = await solicitar(`/prestadores/${prestadorId}`, {
      token: tokens.administrador,
    });
    exigirEstado(respuesta, 200, 'GET prestador creado');
    assert.equal(respuesta.datos.nombre, 'Dr. Persistencia API');
    assert.ok(respuesta.datos.centrosDeAtencion?.[0]?.direccionId);

    respuesta = await solicitar(`/prestadores/${prestadorId}`, {
      metodo: 'PUT',
      token: tokens.administrador,
      cuerpo: {
        nombre: 'Dr. Persistencia Editado',
        emails: [{ direccion: 'prestador.editado@test.com' }],
        telefonos: [{ numero: '1191000011' }],
      },
    });
    exigirEstado(respuesta, 200, 'PUT /prestadores/:id');

    respuesta = await solicitar(`/prestadores/${prestadorId}`, {
      token: tokens.administrador,
    });
    exigirEstado(respuesta, 200, 'GET prestador después de editar');
    assert.equal(respuesta.datos.nombre, 'Dr. Persistencia Editado');
    assert.equal(respuesta.datos.emails[0].direccion, 'prestador.editado@test.com');

    prestadorPersistido = await Prestador.findById(prestadorId);
    assert.equal(prestadorPersistido.nombre, 'Dr. Persistencia Editado');

    const horarioAgenda = crearHorario(['Martes'], '09:00', '12:00');
    respuesta = await solicitar('/agendas', {
      metodo: 'POST',
      token: tokens.administrador,
      cuerpo: {
        especialidadId: especialidad._id,
        centroDeAtencionId: centroId,
        prestadorId,
        horario: horarioAgenda,
      },
    });
    exigirEstado(respuesta, 201, 'POST /agendas');
    const agendaId = obtenerId(respuesta.datos);

    let agendaPersistida = await Agenda.findById(agendaId);
    assert.ok(agendaPersistida, 'La agenda debe persistirse');
    assert.equal(String(agendaPersistida.prestadorId), prestadorId);

    respuesta = await solicitar(`/agendas/${agendaId}`, {
      token: tokens.administrador,
    });
    exigirEstado(respuesta, 200, 'GET agenda creada');
    assert.equal(obtenerId(respuesta.datos.prestadorId), prestadorId);

    respuesta = await solicitar('/agendas', {
      metodo: 'POST',
      token: tokens.administrador,
      cuerpo: {
        especialidadId: especialidad._id,
        centroDeAtencionId: centroId,
        prestadorId,
        horario: crearHorario(['Jueves'], '09:00', '11:00'),
      },
    });
    exigirEstado(
      respuesta,
      409,
      'No debe permitirse duplicar prestador/centro/especialidad en otra agenda'
    );

    const horarioEditado = crearHorario(['Miercoles'], '13:00', '16:00');
    respuesta = await solicitar(`/agendas/${agendaId}`, {
      metodo: 'PUT',
      token: tokens.administrador,
      cuerpo: { horario: horarioEditado },
    });
    exigirEstado(respuesta, 200, 'PUT /agendas/:id');

    respuesta = await solicitar(`/agendas/${agendaId}`, {
      token: tokens.administrador,
    });
    exigirEstado(respuesta, 200, 'GET agenda después de editar');
    assert.equal(respuesta.datos.horario.dias.Miercoles.atiende, true);
    assert.equal(respuesta.datos.horario.dias.Martes.atiende, false);

    agendaPersistida = await Agenda.findById(agendaId);
    assert.equal(agendaPersistida.horario.dias.Miercoles.atiende, true);

    respuesta = await solicitar(`/prestadores/${prestadorId}`, {
      metodo: 'DELETE',
      token: tokens.administrador,
    });
    exigirEstado(
      respuesta,
      409,
      'No se debe poder borrar un prestador mientras tenga agendas'
    );

    respuesta = await solicitar(`/agendas/${agendaId}`, {
      metodo: 'DELETE',
      token: tokens.administrador,
    });
    exigirEstado(respuesta, 204, 'DELETE agenda');
    assert.equal(await Agenda.findById(agendaId), null);

    respuesta = await solicitar(`/prestadores/${prestadorId}`, {
      metodo: 'DELETE',
      token: tokens.administrador,
    });
    exigirEstado(respuesta, 204, 'DELETE prestador sin agendas');
    assert.equal(await Prestador.findById(prestadorId), null);
  });

  await t.test('portal afiliado: GET, solicitudes, turnos y persistencia', async () => {
    let respuesta = await solicitar('/portal-afiliado/mi-perfil', {
      token: tokens.afiliado,
    });
    exigirEstado(respuesta, 200, 'GET portal afiliado/mi-perfil');
    assert.equal(respuesta.datos.dni, 10000001);
    assert.equal(obtenerId(respuesta.datos), contexto.homeroId);

    for (const ruta of [
      '/portal-afiliado/resumen',
      '/portal-afiliado/cartilla',
      '/portal-afiliado/solicitudes',
      '/portal-afiliado/turnos',
    ]) {
      respuesta = await solicitar(ruta, { token: tokens.afiliado });
      exigirEstado(respuesta, 200, `GET ${ruta}`);
    }

    respuesta = await solicitar('/portal-afiliado/solicitudes', {
      metodo: 'POST',
      token: tokens.afiliado,
      cuerpo: {
        tipo: 'RECETA',
        afiliadoId: contexto.homeroId,
        datos: {
          medicamento: 'Medicamento de prueba',
          cantidad: 1,
          presentacion: 'Comprimidos',
        },
        observaciones: 'Solicitud creada por test',
      },
    });
    exigirEstado(respuesta, 201, 'POST solicitud afiliado');
    const solicitudEditableId = obtenerId(respuesta.datos);

    let solicitudPersistida = await Solicitud.findById(solicitudEditableId);
    assert.ok(solicitudPersistida);
    assert.equal(solicitudPersistida.estado, 'Recibido');

    respuesta = await solicitar(`/portal-afiliado/solicitudes/${solicitudEditableId}`, {
      metodo: 'PUT',
      token: tokens.afiliado,
      cuerpo: {
        datos: {
          medicamento: 'Medicamento editado',
          cantidad: 2,
          presentacion: 'Comprimidos',
        },
        observaciones: 'Solicitud editada por test',
      },
    });
    exigirEstado(respuesta, 200, 'PUT solicitud afiliado');

    solicitudPersistida = await Solicitud.findById(solicitudEditableId);
    assert.equal(solicitudPersistida.datos.medicamento, 'Medicamento editado');
    assert.equal(solicitudPersistida.datos.cantidad, 2);

    respuesta = await solicitar('/portal-afiliado/solicitudes', {
      token: tokens.afiliado,
    });
    exigirEstado(respuesta, 200, 'GET solicitudes después de editar');
    const solicitudDesdeGet = respuesta.datos.find(
      (solicitud) => obtenerId(solicitud) === solicitudEditableId
    );
    assert.equal(solicitudDesdeGet.datos.medicamento, 'Medicamento editado');

    respuesta = await solicitar(`/portal-afiliado/solicitudes/${solicitudEditableId}`, {
      metodo: 'DELETE',
      token: tokens.afiliado,
    });
    exigirEstado(respuesta, 204, 'DELETE solicitud recibida');
    assert.equal(await Solicitud.findById(solicitudEditableId), null);

    respuesta = await solicitar('/portal-afiliado/solicitudes', {
      metodo: 'POST',
      token: tokens.afiliado,
      cuerpo: {
        tipo: 'RECETA',
        afiliadoId: contexto.homeroId,
        datos: {
          medicamento: 'Flujo prestador',
          cantidad: 1,
          presentacion: 'Caja',
        },
      },
    });
    exigirEstado(respuesta, 201, 'POST solicitud para flujo de prestador');
    contexto.solicitudFlujoId = obtenerId(respuesta.datos);

    const fechaTurno = formatearFecha(obtenerFechaFuturaParaDia('Lunes', 8));
    respuesta = await solicitar(
      `/portal-afiliado/disponibilidad?fecha=${fechaTurno}&prestadorId=${contexto.houseId}`,
      { token: tokens.afiliado }
    );
    exigirEstado(respuesta, 200, 'GET disponibilidad');
    assert.ok(respuesta.datos.length > 0, 'Debe haber al menos un horario disponible');

    const disponibilidad = respuesta.datos[0];
    respuesta = await solicitar('/portal-afiliado/turnos', {
      metodo: 'POST',
      token: tokens.afiliado,
      cuerpo: {
        agendaId: disponibilidad.agendaId,
        afiliadoId: contexto.homeroId,
        fecha: disponibilidad.fecha,
        hora: disponibilidad.hora,
      },
    });
    exigirEstado(respuesta, 201, 'POST reserva de turno');
    const turnoId = obtenerId(respuesta.datos);

    let turnoPersistido = await Turno.findById(turnoId);
    assert.ok(turnoPersistido);
    assert.equal(turnoPersistido.estado, 'RESERVADO');

    respuesta = await solicitar('/portal-afiliado/turnos', {
      token: tokens.afiliado,
    });
    exigirEstado(respuesta, 200, 'GET turnos después de reservar');
    assert.ok(respuesta.datos.some((turno) => obtenerId(turno) === turnoId));

    respuesta = await solicitar('/portal-afiliado/turnos', {
      metodo: 'POST',
      token: tokens.afiliado,
      cuerpo: {
        agendaId: disponibilidad.agendaId,
        afiliadoId: contexto.homeroId,
        fecha: disponibilidad.fecha,
        hora: disponibilidad.hora,
      },
    });
    exigirEstado(respuesta, 409, 'No debe permitirse reservar dos veces el mismo slot');

    respuesta = await solicitar(`/portal-afiliado/turnos/${turnoId}/cancelar`, {
      metodo: 'POST',
      token: tokens.afiliado,
      cuerpo: {},
    });
    exigirEstado(respuesta, 200, 'POST cancelar turno');

    turnoPersistido = await Turno.findById(turnoId);
    assert.equal(turnoPersistido.estado, 'CANCELADO');
  });

  await t.test('portal prestador: GET, estados, historia y situaciones persisten', async () => {
    assert.ok(contexto.solicitudFlujoId, 'El flujo de afiliado debe crear una solicitud');

    for (const ruta of [
      '/portal-prestador/mi-perfil',
      '/portal-prestador/resumen',
      '/portal-prestador/solicitudes',
      '/portal-prestador/turnos',
      '/portal-prestador/afiliados/buscar?busqueda=Simpson',
      `/portal-prestador/situaciones/${contexto.homeroId}`,
      `/portal-prestador/historia/${contexto.homeroId}`,
      `/portal-prestador/historia/${contexto.homeroId}?soloMias=true`,
    ]) {
      const respuesta = await solicitar(ruta, { token: tokens.prestador });
      exigirEstado(respuesta, 200, `GET ${ruta}`);
    }

    let respuesta = await solicitar(
      `/portal-prestador/solicitudes/${contexto.solicitudFlujoId}/estado`,
      {
        metodo: 'POST',
        token: tokens.prestador,
        cuerpo: { estado: 'En análisis' },
      }
    );
    exigirEstado(respuesta, 200, 'Prestador toma solicitud');

    let solicitudPersistida = await Solicitud.findById(contexto.solicitudFlujoId);
    assert.equal(solicitudPersistida.estado, 'En análisis');
    assert.ok(solicitudPersistida.asignadoAUsuarioId);

    respuesta = await solicitar(
      `/portal-prestador/solicitudes/${contexto.solicitudFlujoId}/estado`,
      {
        metodo: 'POST',
        token: tokens.prestador,
        cuerpo: { estado: 'Aprobado' },
      }
    );
    exigirEstado(respuesta, 200, 'Prestador aprueba solicitud');

    solicitudPersistida = await Solicitud.findById(contexto.solicitudFlujoId);
    assert.equal(solicitudPersistida.estado, 'Aprobado');
    assert.equal(solicitudPersistida.asignadoAUsuarioId, null);

    respuesta = await solicitar(
      `/portal-afiliado/solicitudes/${contexto.solicitudFlujoId}`,
      {
        metodo: 'PUT',
        token: tokens.afiliado,
        cuerpo: { observaciones: 'No debería permitirse' },
      }
    );
    exigirEstado(
      respuesta,
      409,
      'Una solicitud aprobada no debe poder modificarse por el afiliado'
    );

    respuesta = await solicitar('/portal-prestador/situaciones', {
      metodo: 'POST',
      token: tokens.prestador,
      cuerpo: {
        afiliadoId: contexto.homeroId,
        situacionTerapeuticaId: contexto.situacionTerapeuticaId,
        fechaInicio: new Date().toISOString(),
        activa: true,
      },
    });
    exigirEstado(respuesta, 201, 'POST situación terapéutica');
    const situacionId = obtenerId(respuesta.datos);

    let situacionPersistida = await SituacionAfiliado.findById(situacionId);
    assert.ok(situacionPersistida);
    assert.equal(situacionPersistida.activa, true);

    respuesta = await solicitar(`/portal-prestador/situaciones/${situacionId}`, {
      metodo: 'PUT',
      token: tokens.prestador,
      cuerpo: { fechaFin: new Date().toISOString() },
    });
    exigirEstado(respuesta, 200, 'PUT situación terapéutica');

    situacionPersistida = await SituacionAfiliado.findById(situacionId);
    assert.equal(situacionPersistida.activa, false);
    assert.ok(situacionPersistida.fechaFin);

    const agendaHouse = await Agenda.findById(contexto.agendaHouseId);
    assert.ok(agendaHouse);
    const fechaPasada = obtenerFechaPasadaParaDia('Lunes', 8);
    const turnoPasado = await Turno.create({
      agendaId: agendaHouse._id,
      prestadorId: agendaHouse.prestadorId,
      afiliadoId: contexto.homeroId,
      reservadoPorAfiliadoId: contexto.homeroId,
      fecha: fechaPasada,
      hora: '10:30',
      estado: 'RESERVADO',
    });

    respuesta = await solicitar(`/portal-prestador/turnos/${turnoPasado._id}/nota`, {
      metodo: 'POST',
      token: tokens.prestador,
      cuerpo: { nota: 'Nota clínica persistida desde el test de integración.' },
    });
    exigirEstado(respuesta, 201, 'POST nota clínica');
    const historiaId = obtenerId(respuesta.datos);

    const [historiaPersistida, turnoAtendido] = await Promise.all([
      HistoriaClinica.findById(historiaId),
      Turno.findById(turnoPasado._id),
    ]);
    assert.ok(historiaPersistida);
    assert.equal(
      historiaPersistida.nota,
      'Nota clínica persistida desde el test de integración.'
    );
    assert.equal(turnoAtendido.estado, 'ATENDIDO');

    respuesta = await solicitar(`/portal-prestador/historia/${contexto.homeroId}`, {
      token: tokens.prestador,
    });
    exigirEstado(respuesta, 200, 'GET historia después de crear nota');
    assert.ok(respuesta.datos.some((registro) => obtenerId(registro) === historiaId));
  });

  await t.test('activación y cambio de contraseña persisten para afiliado y prestador', async () => {
    let respuesta = await solicitar('/autenticacion/activar-afiliado', {
      metodo: 'POST',
      cuerpo: { dni: '20000001', email: 'lucia@demo.com' },
    });
    exigirEstado(respuesta, 201, 'Activación de afiliado');

    respuesta = await solicitar('/autenticacion/iniciar-sesion', {
      metodo: 'POST',
      cuerpo: {
        identificador: '20000001',
        contrasena: '20000001',
        rol: 'AFILIADO',
      },
    });
    exigirEstado(respuesta, 200, 'Login temporal de afiliado activado');
    assert.equal(respuesta.datos.usuario.debeCambiarContrasena, true);
    const tokenLucia = respuesta.datos.token;

    respuesta = await solicitar('/portal-afiliado/mi-perfil', { token: tokenLucia });
    exigirEstado(
      respuesta,
      403,
      'La cuenta con contraseña temporal no debe entrar al portal'
    );
    assert.equal(respuesta.datos?.codigo, 'CAMBIO_CONTRASENA_REQUERIDO');

    respuesta = await solicitar('/autenticacion/cambiar-contrasena', {
      metodo: 'POST',
      token: tokenLucia,
      cuerpo: {
        contrasenaActual: '20000001',
        contrasenaNueva: 'LuciaDemo1234',
      },
    });
    exigirEstado(respuesta, 200, 'Cambio de contraseña de afiliado');

    const usuarioLucia = await Usuario.findOne({
      rol: 'AFILIADO',
      dniAcceso: '20000001',
    });
    assert.equal(usuarioLucia.debeCambiarContrasena, false);

    const tokenLuciaNuevo = await iniciarSesion(
      '20000001',
      'LuciaDemo1234',
      'AFILIADO'
    );
    respuesta = await solicitar('/portal-afiliado/mi-perfil', {
      token: tokenLuciaNuevo,
    });
    exigirEstado(respuesta, 200, 'Afiliado debe entrar después de cambiar contraseña');

    respuesta = await solicitar('/autenticacion/activar-prestador', {
      metodo: 'POST',
      cuerpo: { dni: '23456789', email: 'grey@medical.com' },
    });
    exigirEstado(respuesta, 201, 'Activación de prestador');

    respuesta = await solicitar('/autenticacion/iniciar-sesion', {
      metodo: 'POST',
      cuerpo: {
        identificador: '23456789',
        contrasena: '23456789',
        rol: 'PRESTADOR',
      },
    });
    exigirEstado(respuesta, 200, 'Login temporal de prestador activado');
    const tokenGrey = respuesta.datos.token;

    respuesta = await solicitar('/autenticacion/cambiar-contrasena', {
      metodo: 'POST',
      token: tokenGrey,
      cuerpo: {
        contrasenaActual: '23456789',
        contrasenaNueva: 'GreyDemo1234',
      },
    });
    exigirEstado(respuesta, 200, 'Cambio de contraseña de prestador');

    const tokenGreyNuevo = await iniciarSesion(
      '23456789',
      'GreyDemo1234',
      'PRESTADOR'
    );
    respuesta = await solicitar('/portal-prestador/mi-perfil', {
      token: tokenGreyNuevo,
    });
    exigirEstado(respuesta, 200, 'Prestador debe entrar después de cambiar contraseña');
  });

  await t.test('integridad referencial final de datos persistidos', async () => {
    const solicitudes = await Solicitud.find();
    for (const solicitud of solicitudes) {
      assert.ok(
        await Afiliado.exists({ _id: solicitud.afiliadoId }),
        `Solicitud ${solicitud._id} referencia un afiliado inexistente`
      );
      assert.ok(
        await Afiliado.exists({ _id: solicitud.creadorAfiliadoId }),
        `Solicitud ${solicitud._id} referencia un creador inexistente`
      );
      if (solicitud.prestadorId) {
        assert.ok(
          await Prestador.exists({ _id: solicitud.prestadorId }),
          `Solicitud ${solicitud._id} referencia un prestador inexistente`
        );
      }
      if (solicitud.especialidadId) {
        assert.ok(
          await Especialidad.exists({ _id: solicitud.especialidadId }),
          `Solicitud ${solicitud._id} referencia una especialidad inexistente`
        );
      }
    }

    const turnos = await Turno.find();
    for (const turno of turnos) {
      assert.ok(
        await Agenda.exists({ _id: turno.agendaId }),
        `Turno ${turno._id} referencia una agenda inexistente`
      );
      assert.ok(
        await Prestador.exists({ _id: turno.prestadorId }),
        `Turno ${turno._id} referencia un prestador inexistente`
      );
      assert.ok(
        await Afiliado.exists({ _id: turno.afiliadoId }),
        `Turno ${turno._id} referencia un afiliado inexistente`
      );
    }

    const historias = await HistoriaClinica.find();
    for (const historia of historias) {
      assert.ok(await Afiliado.exists({ _id: historia.afiliadoId }));
      assert.ok(await Prestador.exists({ _id: historia.prestadorId }));
      if (historia.turnoId) {
        assert.ok(await Turno.exists({ _id: historia.turnoId }));
      }
    }

    const situaciones = await SituacionAfiliado.find();
    for (const situacion of situaciones) {
      assert.ok(await Afiliado.exists({ _id: situacion.afiliadoId }));
      assert.ok(
        await SituacionTerapeutica.exists({ _id: situacion.situacionTerapeuticaId })
      );
      if (situacion.registradaPorPrestadorId) {
        assert.ok(
          await Prestador.exists({ _id: situacion.registradaPorPrestadorId })
        );
      }
    }

    const usuarios = await Usuario.find();
    for (const usuario of usuarios) {
      if (usuario.afiliadoId) {
        assert.ok(
          await Afiliado.exists({ _id: usuario.afiliadoId }),
          `Usuario ${usuario._id} referencia un afiliado inexistente`
        );
      }
      if (usuario.prestadorId) {
        assert.ok(
          await Prestador.exists({ _id: usuario.prestadorId }),
          `Usuario ${usuario._id} referencia un prestador inexistente`
        );
      }
    }

    const direcciones = await Direccion.countDocuments();
    assert.ok(direcciones > 0, 'La base debe conservar direcciones válidas');
  });
});
