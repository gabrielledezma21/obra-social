const { mongoose } = require('../config/db');

const esquemaHistoriaClinica = new mongoose.Schema({
  afiliadoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Afiliado',
    required: true,
    index: true,
  },
  prestadorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prestador',
    required: true,
    index: true,
  },
  turnoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Turno',
    default: null,
  },
  nota: { type: String, required: true, trim: true },
  fecha: { type: Date, default: Date.now, index: true },
}, {
  timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' },
  collection: 'historiasClinicas',
});

const esquemaSituacionAfiliado = new mongoose.Schema({
  afiliadoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Afiliado',
    required: true,
    index: true,
  },
  situacionTerapeuticaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SituacionTerapeutica',
    required: true,
  },
  fechaInicio: { type: Date, default: Date.now },
  fechaFin: { type: Date, default: null },
  activa: { type: Boolean, default: true },
  registradaPorPrestadorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prestador',
    default: null,
  },
}, {
  timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' },
  collection: 'situacionesAfiliados',
});

const HistoriaClinica = mongoose.model('HistoriaClinica', esquemaHistoriaClinica);
const SituacionAfiliado = mongoose.model(
  'SituacionAfiliado',
  esquemaSituacionAfiliado
);

module.exports = { HistoriaClinica, SituacionAfiliado };
