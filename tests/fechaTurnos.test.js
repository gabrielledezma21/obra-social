const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  crearFechaHoraArgentina,
  crearFechaPersistencia,
  esFechaValida,
  formatearFechaPersistida,
  obtenerClaveDia,
  sumarDias,
} = require('../src/utils/fechaTurnos');

test('las fechas de turnos se mantienen en el mismo día calendario', () => {
  const fecha = crearFechaPersistencia('2026-08-17');

  assert.ok(fecha instanceof Date);
  assert.equal(formatearFechaPersistida(fecha), '2026-08-17');
  assert.equal(obtenerClaveDia('2026-08-17'), 'Lunes');
  assert.equal(sumarDias('2026-08-17', 1), '2026-08-18');
});

test('la hora del turno se interpreta en horario de Argentina', () => {
  const fechaHora = crearFechaHoraArgentina('2026-08-17', '09:30');

  assert.equal(fechaHora.toISOString(), '2026-08-17T12:30:00.000Z');
});

test('se rechazan fechas calendario y horarios inválidos', () => {
  assert.equal(esFechaValida('2026-02-30'), false);
  assert.equal(esFechaValida('17-08-2026'), false);
  assert.equal(crearFechaHoraArgentina('2026-08-17', '25:00'), null);
});
