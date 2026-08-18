const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('la carga demo del servidor nunca solicita limpiar la base', () => {
  const app = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'app.js'),
    'utf8'
  );

  assert.match(app, /ejecutarCargaInicial\(\{ limpiar: false \}\)/);
  assert.doesNotMatch(app, /ejecutarCargaInicial\(\{ clean: false \}\)/);
});
