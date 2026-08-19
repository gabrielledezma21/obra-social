const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const leer = (rutaRelativa) =>
  fs.readFileSync(path.join(__dirname, '..', rutaRelativa), 'utf8');

test('la baja del titular se propaga automaticamente al grupo familiar', () => {
  const servicio = leer('src/services/afiliadoService.js');

  assert.match(servicio, /propagarFechaBajaDelTitular/);
  assert.match(servicio, /afiliadoActual\.parentesco !== 'Titular'/);
  assert.match(servicio, /Object\.prototype\.hasOwnProperty\.call\(datos, 'fechaBaja'\)/);
  assert.match(servicio, /\{ afiliadoTitularId: afiliadoActual\._id \}/);
  assert.match(servicio, /fechaBaja: afiliadoActualizado\.fechaBaja \|\| null/);
});

test('un familiar nuevo hereda la baja futura del titular', () => {
  const servicio = leer('src/services/afiliadoService.js');

  assert.match(servicio, /if \(titular\.fechaBaja\)/);
  assert.match(servicio, /fechaBaja = titular\.fechaBaja/);
});

test('al cambiar la baja del titular se invalida la cache de todo el grupo', () => {
  const controlador = leer('src/controllers/afiliadoController.js');

  assert.match(controlador, /const cambiaFechaBaja = Object\.prototype\.hasOwnProperty\.call/);
  assert.match(controlador, /const afectaGrupo = peticion\.body\.aplicarAGrupoFamiliar \|\| cambiaFechaBaja/);
  assert.match(controlador, /\{ afiliadoTitularId: afiliadoActual\._id \}/);
});
