const test = require('node:test');
const assert = require('node:assert/strict');
const {
  crearFechaPersistencia,
  esTurnoProximo,
} = require('../src/utils/fechaTurnos');

test('clasifica un turno de hoy usando fecha y hora de Argentina', () => {
  const ahora = new Date('2026-08-17T15:00:00-03:00');
  const fecha = crearFechaPersistencia('2026-08-17');

  assert.equal(
    esTurnoProximo(
      { fecha, hora: '14:30', estado: 'RESERVADO' },
      ahora
    ),
    false
  );
  assert.equal(
    esTurnoProximo(
      { fecha, hora: '16:30', estado: 'RESERVADO' },
      ahora
    ),
    true
  );
  assert.equal(
    esTurnoProximo(
      { fecha, hora: '18:00', estado: 'CANCELADO' },
      ahora
    ),
    false
  );
});
