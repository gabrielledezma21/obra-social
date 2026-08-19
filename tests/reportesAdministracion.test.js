const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const leer = (rutaRelativa) =>
  fs.readFileSync(path.join(__dirname, '..', rutaRelativa), 'utf8');

test('los reportes por fecha usan límites UTC estables', () => {
  const rutas = leer('src/routes/reporteRutas.js');

  assert.match(rutas, /T00:00:00\.000Z/);
  assert.match(rutas, /MILISEGUNDOS_DIA/);
  assert.match(rutas, /fechaDesde > fechaHasta/);
  assert.match(rutas, /fechaAlta: rango/);
});

test('existe un reporte PDF individual de afiliado', () => {
  const rutas = leer('src/routes/reporteRutas.js');

  assert.match(rutas, /\/afiliados\/:id\/pdf/);
  assert.match(rutas, /application\/pdf/);
  assert.match(rutas, /MedIntegral - Reporte de afiliado/);
  assert.match(rutas, /Grupo familiar/);
  assert.match(rutas, /Novedades terapéuticas/);
});
