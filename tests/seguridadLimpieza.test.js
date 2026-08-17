const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const uriPruebas = process.env.MONGO_URI_TEST;

const obtenerNombreBase = (uri = '') => {
  const sinConsulta = uri.split('?')[0].replace(/\/$/, '');
  return sinConsulta.slice(sinConsulta.lastIndexOf('/') + 1);
};

if (!uriPruebas) {
  throw new Error('Debés definir MONGO_URI_TEST para ejecutar estas pruebas.');
}

if (!/(test|prueba)/i.test(obtenerNombreBase(uriPruebas))) {
  throw new Error('Las pruebas solo pueden usar una base test/prueba.');
}

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = uriPruebas;
delete process.env.MONGODB_URI;
delete process.env.REDIS_URL;
process.env.SEED_DEMO_DATA = 'false';
process.env.SECRETO_AUTENTICACION =
  process.env.SECRETO_AUTENTICACION_TEST || 'medintegral-seguridad-test';

const aplicacion = require('../src/app');
const { runSeed: ejecutarSeed } = require('../src/reiniciarDB');
const { mongoose } = require('../src/config/db');
const {
  Afiliado,
  Prestador,
  CentroDeAtencion,
  Direccion,
  Horario,
  Especialidad,
} = require('../src/models');
const { HistoriaClinica } = require('../src/models/historiaClinica');
const servicioCentroDeAtencion = require('../src/services/centroDeAtencionService');
const {
  logRequest: registrarPeticion,
  ocultarDatosSensibles,
} = require('../src/middlewares/genericMiddleware');

let servidor;
let urlBase;

const solicitar = async (
  ruta,
  { metodo = 'GET', token = '', cuerpo = undefined } = {}
) => {
  const encabezados = {};
  if (token) encabezados.Authorization = `Bearer ${token}`;
  if (cuerpo !== undefined) encabezados['Content-Type'] = 'application/json';

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

  return { estado: respuesta.status, datos };
};

const iniciarAdministrador = async () => {
  const respuesta = await solicitar('/autenticacion/iniciar-sesion', {
    metodo: 'POST',
    cuerpo: {
      identificador: 'admin@medintegral.com',
      contrasena: 'Admin1234',
      rol: 'ADMIN',
    },
  });

  assert.equal(respuesta.estado, 200, JSON.stringify(respuesta.datos));
  return respuesta.datos.token;
};

const crearHorario = () => ({
  duracionTurno: 30,
  dias: {
    Lunes: {
      atiende: true,
      bloques: [{ horaInicio: '09:00', horaFin: '13:00' }],
    },
    Martes: { atiende: false, bloques: [] },
    Miercoles: { atiende: false, bloques: [] },
    Jueves: { atiende: false, bloques: [] },
    Viernes: { atiende: false, bloques: [] },
    Sabado: { atiende: false, bloques: [] },
    Domingo: { atiende: false, bloques: [] },
  },
});

const crearPrestadorPorApi = async ({
  token,
  nombre,
  cuilCuit,
  email,
  telefono,
}) => {
  const especialidad = await Especialidad.findOne({ nombre: 'Cardiologia' });
  assert.ok(especialidad);

  const respuesta = await solicitar('/prestadores', {
    metodo: 'POST',
    token,
    cuerpo: {
      nombre,
      cuilCuit,
      emails: [{ direccion: email }],
      telefonos: [{ numero: telefono }],
      especialidades: [especialidad._id],
      centrosDeAtencion: [
        {
          direccion: {
            calle: 'Centro de Pruebas',
            altura: 101,
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

  assert.equal(respuesta.estado, 201, JSON.stringify(respuesta.datos));
  return respuesta.datos;
};

before(async () => {
  await ejecutarSeed({ clean: true });

  await new Promise((resolver, rechazar) => {
    servidor = aplicacion.listen(0, '127.0.0.1', resolver);
    servidor.once('error', rechazar);
  });

  const direccion = servidor.address();
  urlBase = `http://127.0.0.1:${direccion.port}`;
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

test('MedIntegral - seguridad de logs y limpieza de prestadores', async (t) => {
  await t.test('oculta credenciales y tokens incluso en objetos anidados', () => {
    const datos = {
      identificador: 'usuario@demo.com',
      contrasena: 'secreto-visible-no',
      contrasenaActual: 'actual-visible-no',
      contrasenaNueva: 'nueva-visible-no',
      perfil: {
        nombre: 'Gabriel',
        token: 'token-visible-no',
        nested: [{ password: 'password-visible-no', valor: 'conservar' }],
      },
    };

    const resultado = ocultarDatosSensibles(datos);

    assert.equal(resultado.identificador, 'usuario@demo.com');
    assert.equal(resultado.contrasena, '[OCULTO]');
    assert.equal(resultado.contrasenaActual, '[OCULTO]');
    assert.equal(resultado.contrasenaNueva, '[OCULTO]');
    assert.equal(resultado.perfil.nombre, 'Gabriel');
    assert.equal(resultado.perfil.token, '[OCULTO]');
    assert.equal(resultado.perfil.nested[0].password, '[OCULTO]');
    assert.equal(resultado.perfil.nested[0].valor, 'conservar');
  });

  await t.test('el middleware de log no imprime la contraseña real', () => {
    const registros = [];
    const registrarOriginal = console.log;
    console.log = (valor) => registros.push(valor);

    try {
      let continuo = false;
      registrarPeticion(
        {
          method: 'POST',
          url: '/autenticacion/iniciar-sesion',
          body: {
            identificador: 'admin@medintegral.com',
            contrasena: 'Admin1234',
          },
          params: {},
        },
        {},
        () => {
          continuo = true;
        }
      );

      assert.equal(continuo, true);
      assert.equal(registros.length, 1);
      assert.equal(registros[0].body.contrasena, '[OCULTO]');
      assert.doesNotMatch(JSON.stringify(registros[0]), /Admin1234/);
    } finally {
      console.log = registrarOriginal;
    }
  });

  await t.test('eliminar un prestador nuevo limpia su centro, dirección y horario exclusivos', async () => {
    await ejecutarSeed({ clean: true });
    const token = await iniciarAdministrador();

    const creado = await crearPrestadorPorApi({
      token,
      nombre: 'Dr. Limpieza Exclusiva',
      cuilCuit: '20930000019',
      email: 'limpieza.exclusiva@test.com',
      telefono: '1193000001',
    });

    const idPrestador = String(creado._id);
    const centro = creado.centrosDeAtencion[0];
    const idCentro = String(centro._id);
    const idDireccion = String(centro.direccionId._id);
    const idHorario = String(centro.horarioId._id);

    let respuesta = await solicitar(`/prestadores/${idPrestador}`, {
      metodo: 'DELETE',
      token,
    });
    assert.equal(respuesta.estado, 204, JSON.stringify(respuesta.datos));

    const [prestador, centroPersistido, direccion, horario] = await Promise.all([
      Prestador.findById(idPrestador),
      CentroDeAtencion.findById(idCentro),
      Direccion.findById(idDireccion),
      Horario.findById(idHorario),
    ]);

    assert.equal(prestador, null);
    assert.equal(centroPersistido, null);
    assert.equal(direccion, null);
    assert.equal(horario, null);

    respuesta = await solicitar(`/prestadores/${idPrestador}`, { token });
    assert.equal(respuesta.estado, 404);
  });

  await t.test('un centro compartido se conserva mientras otro prestador lo referencia', async () => {
    await ejecutarSeed({ clean: true });
    const token = await iniciarAdministrador();
    const especialidad = await Especialidad.findOne({ nombre: 'Cardiologia' });

    const centro = await servicioCentroDeAtencion.createCentroDeAtencion({
      direccion: {
        calle: 'Centro Compartido',
        altura: 202,
        localidad: 'Moron',
        codigoPostal: '1708',
        provincia: 'Buenos Aires',
      },
      horario: crearHorario(),
    });

    const [prestadorUno, prestadorDos] = await Prestador.create([
      {
        nombre: 'Dr. Compartido Uno',
        cuilCuit: '20930000029',
        emails: [{ direccion: 'compartido.uno@test.com' }],
        telefonos: [{ numero: '1193000002' }],
        especialidades: [especialidad._id],
        centrosDeAtencion: [centro._id],
      },
      {
        nombre: 'Dr. Compartido Dos',
        cuilCuit: '20930000039',
        emails: [{ direccion: 'compartido.dos@test.com' }],
        telefonos: [{ numero: '1193000003' }],
        especialidades: [especialidad._id],
        centrosDeAtencion: [centro._id],
      },
    ]);

    let respuesta = await solicitar(`/prestadores/${prestadorUno._id}`, {
      metodo: 'DELETE',
      token,
    });
    assert.equal(respuesta.estado, 204, JSON.stringify(respuesta.datos));

    assert.equal(await Prestador.findById(prestadorUno._id), null);
    assert.ok(await Prestador.findById(prestadorDos._id));
    assert.ok(await CentroDeAtencion.findById(centro._id));
    assert.ok(await Direccion.findById(centro.direccionId));
    assert.ok(await Horario.findById(centro.horarioId));

    respuesta = await solicitar(`/prestadores/${prestadorDos._id}`, {
      metodo: 'DELETE',
      token,
    });
    assert.equal(respuesta.estado, 204, JSON.stringify(respuesta.datos));

    assert.equal(await CentroDeAtencion.findById(centro._id), null);
    assert.equal(await Direccion.findById(centro.direccionId), null);
    assert.equal(await Horario.findById(centro.horarioId), null);
  });

  await t.test('la baja física se bloquea si el prestador tiene historia clínica', async () => {
    await ejecutarSeed({ clean: true });
    const token = await iniciarAdministrador();

    const creado = await crearPrestadorPorApi({
      token,
      nombre: 'Dr. Historial Protegido',
      cuilCuit: '20930000049',
      email: 'historial.protegido@test.com',
      telefono: '1193000004',
    });

    const afiliado = await Afiliado.findOne({ dni: 10000001 });
    await HistoriaClinica.create({
      afiliadoId: afiliado._id,
      prestadorId: creado._id,
      nota: 'Antecedente que debe impedir el borrado físico.',
      fecha: new Date(),
    });

    const respuesta = await solicitar(`/prestadores/${creado._id}`, {
      metodo: 'DELETE',
      token,
    });

    assert.equal(respuesta.estado, 409, JSON.stringify(respuesta.datos));
    assert.equal(respuesta.datos?.codigo, 'PRESTADOR_CON_HISTORIAL');
    assert.ok(await Prestador.findById(creado._id));
    assert.ok(await CentroDeAtencion.findById(creado.centrosDeAtencion[0]._id));
  });
});
