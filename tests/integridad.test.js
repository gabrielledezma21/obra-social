const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const uriPruebas = process.env.MONGO_URI_TEST;

const obtenerNombreBase = (uri = '') => {
  const sinConsulta = uri.split('?')[0].replace(/\/$/, '');
  return sinConsulta.slice(sinConsulta.lastIndexOf('/') + 1);
};

if (!uriPruebas) {
  throw new Error('Debés definir MONGO_URI_TEST para ejecutar pruebas de integridad.');
}

if (!/(test|prueba)/i.test(obtenerNombreBase(uriPruebas))) {
  throw new Error('Las pruebas de integridad solo pueden usar una base test/prueba.');
}

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = uriPruebas;
delete process.env.MONGODB_URI;
delete process.env.REDIS_URL;
process.env.SEED_DEMO_DATA = 'false';
process.env.SECRETO_AUTENTICACION =
  process.env.SECRETO_AUTENTICACION_TEST || 'medintegral-integridad-test';

const aplicacion = require('../src/app');
const { runSeed: ejecutarSeed } = require('../src/reiniciarDB');
const { mongoose } = require('../src/config/db');
const {
  Afiliado,
  Prestador,
  Agenda,
  Especialidad,
  SituacionTerapeutica,
} = require('../src/models');
const Contador = require('../src/models/contador');
const Usuario = require('../src/models/usuario');
const Solicitud = require('../src/models/solicitud');
const Turno = require('../src/models/turno');
const { HistoriaClinica, SituacionAfiliado } = require('../src/models/historiaClinica');

let servidor;
let urlBase;

const DIAS_SEMANA = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miercoles',
  'Jueves',
  'Viernes',
  'Sabado',
];

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

const reiniciarEscenario = async () => {
  await ejecutarSeed({ clean: true });
  return iniciarAdministrador();
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

test('MedIntegral - integridad, seed y contratos de borde', async (t) => {
  await t.test('la seed limpia también el contador de numeración', async () => {
    await Contador.findByIdAndUpdate(
      'numeroAfiliado',
      { secuencia: 9999 },
      { upsert: true, new: true }
    );

    await ejecutarSeed({ clean: true });

    const contador = await Contador.findById('numeroAfiliado');
    assert.equal(
      contador,
      null,
      'Una seed limpia no debe conservar la secuencia de una ejecución anterior'
    );
  });

  await t.test('todos los turnos de la seed respetan día y horario de su agenda', async () => {
    await ejecutarSeed({ clean: true });
    const turnos = await Turno.find();

    for (const turno of turnos) {
      const agenda = await Agenda.findById(turno.agendaId);
      assert.ok(agenda, `El turno ${turno._id} debe tener una agenda existente`);

      const dia = DIAS_SEMANA[new Date(turno.fecha).getDay()];
      const configuracionDia = agenda.horario?.dias?.[dia];
      assert.equal(
        configuracionDia?.atiende,
        true,
        `El turno ${turno._id} cae un ${dia}, día sin atención en su agenda`
      );

      const [horas, minutos] = turno.hora.split(':').map(Number);
      const minutoTurno = horas * 60 + minutos;
      const dentroDeBloque = (configuracionDia?.bloques || []).some(
        (bloque) =>
          minutoTurno >= Number(bloque.horaInicio) &&
          minutoTurno < Number(bloque.horaFin)
      );

      assert.equal(
        dentroDeBloque,
        true,
        `La hora ${turno.hora} del turno ${turno._id} queda fuera de la agenda`
      );
    }
  });

  await t.test('no se puede eliminar una agenda que conserva turnos', async () => {
    const token = await reiniciarEscenario();
    const turno = await Turno.findOne();
    assert.ok(turno);

    const respuesta = await solicitar(`/agendas/${turno.agendaId}`, {
      metodo: 'DELETE',
      token,
    });

    assert.equal(
      respuesta.estado,
      409,
      `Eliminar una agenda con turnos debe responder 409: ${JSON.stringify(respuesta.datos)}`
    );
    assert.ok(await Agenda.exists({ _id: turno.agendaId }));
    assert.ok(await Turno.exists({ _id: turno._id }));
  });

  await t.test('no se puede eliminar físicamente un afiliado con historia operativa', async () => {
    const token = await reiniciarEscenario();
    const homero = await Afiliado.findOne({ dni: 10000001 });
    assert.ok(homero);

    const [usuarioAntes, solicitudAntes, turnoAntes, historiaAntes, situacionAntes] =
      await Promise.all([
        Usuario.exists({ afiliadoId: homero._id }),
        Solicitud.exists({
          $or: [
            { afiliadoId: homero._id },
            { creadorAfiliadoId: homero._id },
          ],
        }),
        Turno.exists({ afiliadoId: homero._id }),
        HistoriaClinica.exists({ afiliadoId: homero._id }),
        SituacionAfiliado.exists({ afiliadoId: homero._id }),
      ]);

    assert.ok(usuarioAntes && solicitudAntes && turnoAntes && historiaAntes && situacionAntes);

    const respuesta = await solicitar(`/afiliados/${homero._id}`, {
      metodo: 'DELETE',
      token,
    });

    assert.equal(
      respuesta.estado,
      409,
      `La baja física con datos históricos debe bloquearse: ${JSON.stringify(respuesta.datos)}`
    );
    assert.ok(await Afiliado.exists({ _id: homero._id }));
    assert.ok(await Usuario.exists({ afiliadoId: homero._id }));
    assert.ok(await Turno.exists({ afiliadoId: homero._id }));
  });

  await t.test('los listados vacíos responden 200 con un arreglo vacío', async () => {
    let token = await reiniciarEscenario();

    await Agenda.deleteMany({});
    let respuesta = await solicitar('/agendas', { token });
    assert.equal(respuesta.estado, 200, JSON.stringify(respuesta.datos));
    assert.deepEqual(respuesta.datos, []);

    token = await reiniciarEscenario();
    await Prestador.deleteMany({});
    respuesta = await solicitar('/prestadores', { token });
    assert.equal(respuesta.estado, 200, JSON.stringify(respuesta.datos));
    assert.deepEqual(respuesta.datos, []);

    token = await reiniciarEscenario();
    await Afiliado.deleteMany({});
    respuesta = await solicitar('/afiliados', { token });
    assert.equal(respuesta.estado, 200, JSON.stringify(respuesta.datos));
    assert.deepEqual(respuesta.datos, []);
  });

  await t.test('un afiliado no puede guardar referencias terapéuticas inexistentes', async () => {
    const token = await reiniciarEscenario();
    const situacionInexistente = new mongoose.Types.ObjectId();

    const respuesta = await solicitar('/afiliados', {
      metodo: 'POST',
      token,
      cuerpo: {
        nombre: 'Referencia',
        apellido: 'Invalida',
        fechaNacimiento: '1990-01-01',
        tipoDocumento: 'DNI',
        dni: 91999991,
        parentesco: 'Titular',
        emails: [{ direccion: 'referencia.invalida@test.com' }],
        telefonos: [{ numero: '1191999991' }],
        direcciones: [
          {
            calle: 'Prueba',
            altura: 100,
            localidad: 'Moron',
            codigoPostal: '1708',
            provincia: 'Buenos Aires',
          },
        ],
        plan: '210',
        fechaAlta: '2026-01-01',
        situacionesTerapeuticas: [situacionInexistente],
      },
    });

    assert.equal(
      respuesta.estado,
      400,
      `No debe persistirse una referencia terapéutica inexistente: ${JSON.stringify(respuesta.datos)}`
    );
    assert.equal(await Afiliado.exists({ dni: 91999991 }), null);
  });

  await t.test('un prestador no puede guardar especialidades inexistentes', async () => {
    const token = await reiniciarEscenario();
    const especialidadInexistente = new mongoose.Types.ObjectId();

    const respuesta = await solicitar('/prestadores', {
      metodo: 'POST',
      token,
      cuerpo: {
        nombre: 'Dr. Referencia Invalida',
        cuilCuit: '20919999919',
        emails: [{ direccion: 'prestador.invalido@test.com' }],
        telefonos: [{ numero: '1191999992' }],
        especialidades: [especialidadInexistente],
        centrosDeAtencion: [
          {
            direccion: {
              calle: 'Prueba',
              altura: 200,
              localidad: 'Moron',
              codigoPostal: '1708',
              provincia: 'Buenos Aires',
            },
            horario: {
              duracionTurno: 30,
              dias: {
                Lunes: {
                  atiende: true,
                  bloques: [{ horaInicio: '09:00', horaFin: '12:00' }],
                },
              },
            },
          },
        ],
      },
    });

    assert.equal(
      respuesta.estado,
      400,
      `No debe persistirse una especialidad inexistente: ${JSON.stringify(respuesta.datos)}`
    );
    assert.equal(
      await Prestador.exists({ cuilCuit: '20919999919' }),
      null
    );
  });
});
