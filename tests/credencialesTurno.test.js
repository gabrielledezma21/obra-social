const { test } = require('node:test');
const assert = require('node:assert/strict');
const Turno = require('../src/models/turno');
const {
  generarCodigoReserva,
  generarTokenGestion,
  hashearTokenGestion,
  verificarTokenGestion,
} = require('../src/utils/credencialesTurno');
const { construirUrlGestionTurno } = require('../src/services/correoServicio');

test('genera códigos de reserva legibles y tokens criptográficos separados', () => {
  for (let indice = 0; indice < 20; indice += 1) {
    assert.match(
      generarCodigoReserva(),
      /^MED-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/
    );
  }

  const token = generarTokenGestion();
  const hash = hashearTokenGestion(token);

  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(token, hash);
  assert.equal(verificarTokenGestion(token, hash), true);
  assert.equal(verificarTokenGestion(`${token}x`, hash), false);
});

test('el modelo guarda solo el hash como campo privado', () => {
  const campoHash = Turno.schema.path('tokenGestionHash');
  const campoCodigo = Turno.schema.path('codigoReserva');

  assert.equal(campoHash.options.select, false);
  assert.equal(campoCodigo.options.unique, true);
  assert.ok(Turno.schema.path('historial'));
});

test('el token del enlace queda en el fragmento y no en la query', () => {
  const anterior = process.env.URL_FRONTEND;
  process.env.URL_FRONTEND = 'https://medintegral.example';

  const url = construirUrlGestionTurno({
    codigoReserva: 'MED-8F4K2P',
    tokenGestion: 'token-seguro',
    accion: 'reagendar',
  });

  assert.equal(
    url,
    'https://medintegral.example/turnos/gestionar?codigo=MED-8F4K2P#token=token-seguro&accion=reagendar'
  );
  assert.equal(url.split('#')[0].includes('token-seguro'), false);

  if (anterior === undefined) delete process.env.URL_FRONTEND;
  else process.env.URL_FRONTEND = anterior;
});
