const { mongoose } = require('../config/db');

const esquemaHistorialTurno = new mongoose.Schema(
  {
    accion: {
      type: String,
      required: true,
      enum: [
        'CREADO',
        'REAGENDADO',
        'CANCELADO',
        'ATENDIDO',
        'CREDENCIALES_REGENERADAS',
      ],
    },
    fecha: { type: Date, default: Date.now, required: true },
    actorTipo: {
      type: String,
      required: true,
      enum: ['AFILIADO', 'ADMIN', 'PRESTADOR', 'PUBLICO', 'SISTEMA'],
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    fechaAnterior: { type: Date, default: null },
    horaAnterior: { type: String, default: null },
    fechaNueva: { type: Date, default: null },
    horaNueva: { type: String, default: null },
    motivo: { type: String, trim: true, default: null },
  },
  { _id: false }
);

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
  codigoReserva: {
    type: String,
    trim: true,
    uppercase: true,
    unique: true,
    sparse: true,
  },
  tokenGestionHash: {
    type: String,
    default: null,
    select: false,
  },
  tokenGestionGeneradoEn: { type: Date, default: null },
  historial: {
    type: [esquemaHistorialTurno],
    default: [],
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
