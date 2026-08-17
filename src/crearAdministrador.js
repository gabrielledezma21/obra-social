const criptografia = require('crypto');
const { mongo } = require('./config');
const Usuario = require('./models/usuario');

const generarHashContrasena = (
  contrasena,
  sal = criptografia.randomBytes(16).toString('hex')
) => `${sal}:${criptografia.scryptSync(contrasena, sal, 64).toString('hex')}`;

const crearAdministrador = async () => {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const contrasena = String(process.env.ADMIN_PASSWORD || '');

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error('ADMIN_EMAIL debe contener un email válido');
  }
  if (contrasena.length < 8) {
    throw new Error('ADMIN_PASSWORD debe tener al menos 8 caracteres');
  }

  await mongo.conectarDB();

  const administradorExistente = await Usuario.findOne({ rol: 'ADMIN', email });
  if (administradorExistente) {
    console.log(`El administrador ${email} ya existe.`);
    return administradorExistente;
  }

  const administrador = await Usuario.create({
    email,
    hashContrasena: generarHashContrasena(contrasena),
    rol: 'ADMIN',
    debeCambiarContrasena: false,
  });

  console.log(`Administrador creado correctamente: ${administrador.email}`);
  return administrador;
};

if (require.main === module) {
  crearAdministrador()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(`No se pudo crear el administrador: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { crearAdministrador };
