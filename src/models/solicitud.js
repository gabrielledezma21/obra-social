const { mongoose } = require('../config/db');

const esquemaHistorialEstado = new mongoose.Schema({
  estado: {
    type: String,
    enum: ['Recibido', 'En análisis', 'Observado', 'Aprobado', 'Rechazado'],
    required: true,
  },
  fecha: { type: Date, default: Date.now },
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  motivo: String,
}, { _id: false });

const esquemaComentario = new mongoose.Schema({
  texto: { type: String, required: true, trim: true },
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  fecha: { type: Date, default: Date.now },
}, { _id: false });

const esquemaSolicitud = new mongoose.Schema({
  tipo: {
    type: String,
    enum: ['REINTEGRO', 'AUTORIZACION', 'RECETA'],
    required: true,
  },
  afiliadoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Afiliado',
    required: true,
    index: true,
  },
  creadorAfiliadoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Afiliado',
    required: true,
  },
  prestadorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prestador',
    default: null,
    index: true,
  },
  especialidadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Especialidad',
    default: null,
  },
  estado: {
    type: String,
    enum: ['Recibido', 'En análisis', 'Observado', 'Aprobado', 'Rechazado'],
    default: 'Recibido',
    index: true,
  },
  asignadoAUsuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    default: null,
  },
  datos: { type: mongoose.Schema.Types.Mixed, required: true },
  observaciones: { type: String, default: '' },
  historialEstados: { type: [esquemaHistorialEstado], default: [] },
  comentarios: { type: [esquemaComentario], default: [] },
}, {
  timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' },
  collection: 'solicitudes',
});

esquemaSolicitud.pre('save', function (siguiente) {
  if (this.isNew && this.historialEstados.length === 0) {
    this.historialEstados.push({ estado: 'Recibido' });
  }
  siguiente();
});

module.exports = mongoose.model('Solicitud', esquemaSolicitud);
