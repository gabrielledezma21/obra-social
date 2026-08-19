const test = require('node:test');
const assert = require('node:assert/strict');
const {
  crearCredencialesGestionTurno,
  generarCodigoReserva,
  generarTokenGestion,
  normalizarCodigoReserva,
  obtenerHashTokenGestion,
  tokenGestionCoincide,
} = require('../src/services/turnosServicio');

test('genera codigos de reserva legibles y con prefijo MED', () => {
  const codigo = generarCodigoReserva();
  assert.match(codigo, /^MED-[A-HJ-NP-Z2-9]{6}$/);
});

test('genera tokens de gestion distintos y suficientemente largos', () => {
  const primero = generarTokenGestion();
  const segundo = generarTokenGestion();

  assert.notEqual(primero, segundo);
  assert.ok(primero.length >= 40);
  assert.ok(segundo.length >= 40);
});

test('almacena solamente el hash y valida el token original', () => {
  const credenciales = crearCredencialesGestionTurno();

  assert.match(credenciales.codigoReserva, /^MED-[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(credenciales.tokenGestionHash.length, 64);
  assert.notEqual(credenciales.tokenGestion, credenciales.tokenGestionHash);
  assert.equal(
    credenciales.tokenGestionHash,
    obtenerHashTokenGestion(credenciales.tokenGestion)
  );
  assert.equal(
    tokenGestionCoincide(
      credenciales.tokenGestion,
      credenciales.tokenGestionHash
    ),
    true
  );
  assert.equal(
    tokenGestionCoincide('token-invalido', credenciales.tokenGestionHash),
    false
  );
});

test('normaliza el codigo de reserva sin alterar su formato', () => {
  assert.equal(normalizarCodigoReserva('  med-abcd23  '), 'MED-ABCD23');
});
