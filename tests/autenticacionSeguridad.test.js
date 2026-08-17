const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  firmarToken,
  verificarToken,
  obtenerSecreto,
} = require('../src/middlewares/autenticacionMiddleware');

const restaurarVariable = (nombre, valor) => {
  if (valor === undefined) delete process.env[nombre];
  else process.env[nombre] = valor;
};

test('MedIntegral - configuración y seguridad de tokens', async (t) => {
  await t.test('producción exige un secreto configurado', () => {
    const entornoAnterior = process.env.NODE_ENV;
    const secretoAnterior = process.env.SECRETO_AUTENTICACION;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.SECRETO_AUTENTICACION;

      assert.throws(
        () => obtenerSecreto(),
        (error) =>
          error?.code === 'CONFIGURACION_AUTENTICACION_INVALIDA' &&
          error?.statusCode === 500
      );
      assert.throws(() => firmarToken({ usuarioId: 'usuario-prueba' }));
    } finally {
      restaurarVariable('NODE_ENV', entornoAnterior);
      restaurarVariable('SECRETO_AUTENTICACION', secretoAnterior);
    }
  });

  await t.test('desarrollo puede usar el secreto local de respaldo', () => {
    const entornoAnterior = process.env.NODE_ENV;
    const secretoAnterior = process.env.SECRETO_AUTENTICACION;

    try {
      process.env.NODE_ENV = 'development';
      delete process.env.SECRETO_AUTENTICACION;

      assert.equal(
        obtenerSecreto(),
        'medintegral-desarrollo-cambiar-secreto'
      );
      const token = firmarToken({ usuarioId: 'usuario-prueba' });
      assert.equal(verificarToken(token).usuarioId, 'usuario-prueba');
    } finally {
      restaurarVariable('NODE_ENV', entornoAnterior);
      restaurarVariable('SECRETO_AUTENTICACION', secretoAnterior);
    }
  });

  await t.test('un token alterado es rechazado', () => {
    const secretoAnterior = process.env.SECRETO_AUTENTICACION;
    try {
      process.env.SECRETO_AUTENTICACION = 'secreto-test-tokens';
      const token = firmarToken({ usuarioId: 'usuario-prueba' });
      const [cuerpo, firma] = token.split('.');
      const firmaAlterada = `${firma.slice(0, -1)}${firma.endsWith('a') ? 'b' : 'a'}`;

      assert.throws(
        () => verificarToken(`${cuerpo}.${firmaAlterada}`),
        (error) => error?.code === 'TOKEN_INVALIDO' && error?.statusCode === 401
      );
    } finally {
      restaurarVariable('SECRETO_AUTENTICACION', secretoAnterior);
    }
  });

  await t.test('un token vencido es rechazado', () => {
    const secretoAnterior = process.env.SECRETO_AUTENTICACION;
    const ahoraOriginal = Date.now;

    try {
      process.env.SECRETO_AUTENTICACION = 'secreto-test-vencimiento';
      const instanteEmision = 1_800_000_000_000;
      Date.now = () => instanteEmision;
      const token = firmarToken({ usuarioId: 'usuario-prueba' });

      Date.now = () => instanteEmision + 13 * 60 * 60 * 1000;
      assert.throws(
        () => verificarToken(token),
        (error) => error?.code === 'TOKEN_EXPIRADO' && error?.statusCode === 401
      );
    } finally {
      Date.now = ahoraOriginal;
      restaurarVariable('SECRETO_AUTENTICACION', secretoAnterior);
    }
  });
});
