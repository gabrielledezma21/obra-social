const { mongoose } = require('../config/db');

const esquemaUsuario = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  hashContrasena: { type: String, required: true },
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

esquemaUsuario.set('toJSON', {
  transform: (_documento, resultado) => {
    delete resultado.__v;
    delete resultado.hashContrasena;
  },
});

module.exports = mongoose.model('Usuario', esquemaUsuario);
