const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const leer = (rutaRelativa) =>
  fs.readFileSync(path.join(__dirname, '..', rutaRelativa), 'utf8');

test('la semilla ampliada contiene una distribución mensual conocida por plan', () => {
  const semilla = leer('scripts/cargarSemillaDemoAmpliada.js');

  assert.match(
    semilla,
    /'2026-01': \{ '210': 1, '310': 0, '410': 2, '510': 3 \}/
  );
  assert.match(
    semilla,
    /'2026-02': \{ '210': 0, '310': 1, '410': 3, '510': 1 \}/
  );
  assert.match(
    semilla,
    /'2026-03': \{ '210': 4, '310': 3, '410': 4, '510': 2 \}/
  );
});

test('la semilla ampliada está bloqueada en producción y genera datos variados', () => {
  const semilla = leer('scripts/cargarSemillaDemoAmpliada.js');
  const paquete = leer('package.json');

  assert.match(semilla, /NODE_ENV === 'production'/);
  assert.match(semilla, /cargarGrupoFamiliar/);
  assert.match(semilla, /cargarPrestadoresAdicionales/);
  assert.match(semilla, /HistoriaClinica\.create/);
  assert.match(semilla, /SituacionAfiliado\.create/);
  assert.match(paquete, /db:demo-ampliada/);
});

test('la semilla agrega especialidades y situaciones terapéuticas variadas', () => {
  const semilla = leer('scripts/cargarSemillaDemoAmpliada.js');

  for (const especialidad of [
    'Oftalmologia',
    'Neurologia',
    'Psiquiatria',
    'Endocrinologia',
    'Gastroenterologia',
    'Kinesiologia',
    'Nutricion',
    'Odontologia',
    'Neumonologia',
  ]) {
    assert.match(semilla, new RegExp(especialidad));
  }

  assert.match(semilla, /Especialidades totales/);
  assert.match(semilla, /Situaciones terapéuticas totales/);
});

test('los prestadores demo usan correos compatibles con el validador actual', () => {
  const semilla = leer('scripts/cargarSemillaDemoAmpliada.js');

  assert.match(semilla, /prestador\.demo\$\{indice \+ 1\}@medintegral\.com/);
  assert.doesNotMatch(semilla, /prestador\.demo[^'`]*@medintegral\.test/);
});

test('las agendas ampliadas identifican los prestadores por rango estable de CUIT', () => {
  const agendas = leer('scripts/completarAgendasDemo.js');

  assert.match(agendas, /cuilCuit: \/\^209100000\//);
  assert.match(agendas, /await mongo\.conectarDB\(\)/);
  assert.match(agendas, /candidatos\.slice\(0, 9\)/);
});
