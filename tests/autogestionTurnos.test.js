const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const uriPruebas = process.env.MONGO_URI_TEST;
if (!uriPruebas) {
  throw new Error('Debés definir MONGO_URI_TEST para ejecutar estas pruebas.');
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
const Turno = require('../src/models/turno');

let servidor;
let urlBase;
let tokenAfiliado;
let afiliadoId;

const solicitar = async (ruta, opciones = {}) => {
  const respuesta = await fetch(`${urlBase}${ruta}`, {
    method: opciones.metodo || 'GET',
    headers: {
      ...(opciones.token
        ? { Authorization: `Bearer ${opciones.token}` }
        : {}),
      ...(opciones.cuerpo ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
  });

  const texto = await respuesta.text();
  return {
    estado: respuesta.status,
    datos: texto ? JSON.parse(texto) : null,
  };
};

const estaAAlMenosDosDias = (fechaTexto) => {
  const fecha = new Date(`${fechaTexto}T12:00:00-03:00`);
  return fecha.getTime() - Date.now() > 2 * 86400000;
};

const reservar = async (horario) =>
  solicitar('/portal-afiliado/turnos', {
    metodo: 'POST',
    token: tokenAfiliado,
    cuerpo: {
      agendaId: horario.agendaId,
      afiliadoId,
      fecha: horario.fecha,
      hora: horario.hora,
    },
  });

before(async () => {
  await ejecutarSeed({ clean: true });

  await new Promise((resolver, rechazar) => {
    servidor = aplicacion.listen(0, '127.0.0.1', resolver);
    servidor.once('error', rechazar);
  });
  urlBase = `http://127.0.0.1:${servidor.address().port}`;

  const acceso = await solicitar('/autenticacion/iniciar-sesion', {
    metodo: 'POST',
    cuerpo: {
      identificador: '10000001',
      contrasena: 'Demo1234',
      rol: 'AFILIADO',
    },
  });
  assert.equal(acceso.estado, 200);
  tokenAfiliado = acceso.datos.token;

  const perfil = await solicitar('/portal-afiliado/mi-perfil', {
    token: tokenAfiliado,
  });
  assert.equal(perfil.estado, 200);
  afiliadoId = perfil.datos._id;
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

test('MedIntegral - autogestion segura de turnos', async (t) => {
  const disponibilidad = await solicitar(
    '/portal-afiliado/disponibilidad?limite=80',
    { token: tokenAfiliado }
  );
  assert.equal(disponibilidad.estado, 200);

  const horariosFuturos = disponibilidad.datos.filter((horario) =>
    estaAAlMenosDosDias(horario.fecha)
  );
  assert.ok(horariosFuturos.length >= 2);

  const reservaReagendar = await reservar(horariosFuturos[0]);
  assert.equal(reservaReagendar.estado, 201);
  assert.match(
    reservaReagendar.datos.codigoReserva,
    /^MED-[A-HJ-NP-Z2-9]{6}$/
  );
  assert.ok(reservaReagendar.datos.tokenGestion.length >= 40);
  assert.equal(reservaReagendar.datos.tokenGestionHash, undefined);
  assert.equal(reservaReagendar.datos.historial[0].accion, 'CREADO');

  const almacenado = await Turno.findById(reservaReagendar.datos._id).select(
    '+tokenGestionHash'
  );
  assert.ok(almacenado.tokenGestionHash);
  assert.notEqual(
    almacenado.tokenGestionHash,
    reservaReagendar.datos.tokenGestion
  );

  await t.test('consulta con codigo y token, pero rechaza un token incorrecto', async () => {
    const consulta = await solicitar('/autogestion-turnos/consultar', {
      metodo: 'POST',
      cuerpo: {
        codigoReserva: reservaReagendar.datos.codigoReserva,
        tokenGestion: reservaReagendar.datos.tokenGestion,
      },
    });
    assert.equal(consulta.estado, 200);
    assert.equal(consulta.datos.estado, 'RESERVADO');
    assert.equal(
      consulta.datos.codigoReserva,
      reservaReagendar.datos.codigoReserva
    );

    const incorrecta = await solicitar('/autogestion-turnos/consultar', {
      metodo: 'POST',
      cuerpo: {
        codigoReserva: reservaReagendar.datos.codigoReserva,
        tokenGestion: 'token-incorrecto',
      },
    });
    assert.equal(incorrecta.estado, 401);
  });

  await t.test('permite buscar disponibilidad y reagendar sin iniciar sesion', async () => {
    const credenciales = {
      codigoReserva: reservaReagendar.datos.codigoReserva,
      tokenGestion: reservaReagendar.datos.tokenGestion,
    };
    const libres = await solicitar('/autogestion-turnos/disponibilidad', {
      metodo: 'POST',
      cuerpo: { ...credenciales, limite: 20 },
    });
    assert.equal(libres.estado, 200);
    assert.ok(libres.datos.length > 0);

    const nuevoHorario = libres.datos.find((horario) =>
      estaAAlMenosDosDias(horario.fecha)
    );
    assert.ok(nuevoHorario);

    const reagendada = await solicitar('/autogestion-turnos/reagendar', {
      metodo: 'POST',
      cuerpo: {
        ...credenciales,
        fecha: nuevoHorario.fecha,
        hora: nuevoHorario.hora,
      },
    });
    assert.equal(reagendada.estado, 200);
    assert.equal(reagendada.datos.fecha, nuevoHorario.fecha);
    assert.equal(reagendada.datos.hora, nuevoHorario.hora);
    assert.ok(
      reagendada.datos.historial.some(
        (entrada) => entrada.accion === 'REAGENDADO'
      )
    );
  });

  await t.test('permite cancelar con las credenciales y registra historial', async () => {
    const horarioCancelar = horariosFuturos.find(
      (horario) =>
        `${horario.agendaId}-${horario.fecha}-${horario.hora}` !==
        `${horariosFuturos[0].agendaId}-${horariosFuturos[0].fecha}-${horariosFuturos[0].hora}`
    );
    assert.ok(horarioCancelar);

    const reservaCancelar = await reservar(horarioCancelar);
    assert.equal(reservaCancelar.estado, 201);

    const cancelada = await solicitar('/autogestion-turnos/cancelar', {
      metodo: 'POST',
      cuerpo: {
        codigoReserva: reservaCancelar.datos.codigoReserva,
        tokenGestion: reservaCancelar.datos.tokenGestion,
        motivo: 'No podré asistir',
      },
    });
    assert.equal(cancelada.estado, 200);
    assert.equal(cancelada.datos.estado, 'CANCELADO');
    assert.ok(
      cancelada.datos.historial.some(
        (entrada) => entrada.accion === 'CANCELADO'
      )
    );
  });
});
