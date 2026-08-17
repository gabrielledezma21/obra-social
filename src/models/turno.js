const { mongoose } = require('../config/db');

const esquemaTurno = new mongoose.Schema({
  agendaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agenda',
    required: true,
    index: true,
  },
  prestadorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prestador',
    required: true,
    index: true,
  },
  afiliadoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Afiliado',
    required: true,
    index: true,
  },
  reservadoPorAfiliadoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Afiliado',
    required: true,
  },
  fecha: { type: Date, required: true, index: true },
  hora: {
    type: String,
    required: true,
    match: /^([01]\d|2[0-3]):[0-5]\d$/,
  },
  estado: {
    type: String,
    enum: ['RESERVADO', 'CANCELADO', 'ATENDIDO'],
    default: 'RESERVADO',
  },
}, {
  timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' },
  collection: 'turnos',
});

esquemaTurno.index(
  { agendaId: 1, fecha: 1, hora: 1 },
  {
    unique: true,
    partialFilterExpression: { estado: 'RESERVADO' },
  }
);

module.exports = mongoose.model('Turno', esquemaTurno);
