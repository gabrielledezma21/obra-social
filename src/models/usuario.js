const { mongoose } = require('../config/db');

const esquemaUsuario = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  dniAcceso: {
    type: String,
    trim: true,
    default: null,
  },
  hashContrasena: { type: String, required: true },
  debeCambiarContrasena: { type: Boolean, default: false },
  rol: {
    type: String,
    enum: ['AFILIADO', 'PRESTADOR', 'ADMIN'],
    required: true,
  },
  afiliadoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Afiliado',
    default: null,
  },
  prestadorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prestador',
    default: null,
  },
  activo: { type: Boolean, default: true },
}, {
  timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' },
  collection: 'usuarios',
});

esquemaUsuario.index({ email: 1, rol: 1 }, { unique: true });
esquemaUsuario.index(
  { dniAcceso: 1, rol: 1 },
  {
    unique: true,
    partialFilterExpression: { dniAcceso: { $type: 'string' } },
  }
);

esquemaUsuario.set('toJSON', {
  transform: (_documento, resultado) => {
    delete resultado.__v;
    delete resultado.hashContrasena;
  },
});

module.exports = mongoose.model('Usuario', esquemaUsuario);
