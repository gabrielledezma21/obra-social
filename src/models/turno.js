const { mongoose } = require('../config/db');
const {
  crearCredencialesGestionTurno,
  crearEntradaHistorial,
} = require('../services/turnosServicio');

const esquemaHistorialTurno = new mongoose.Schema(
  {
    accion: {
      type: String,
      enum: ['CREADO', 'REAGENDADO', 'CANCELADO', 'ATENDIDO'],
      required: true,
    },
    actorRol: {
      type: String,
      enum: ['AFILIADO', 'PRESTADOR', 'ADMIN', 'SISTEMA', 'PUBLICO'],
      required: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    fechaAnterior: { type: Date, default: null },
    horaAnterior: { type: String, default: null },
    fechaNueva: { type: Date, default: null },
    horaNueva: { type: String, default: null },
    motivo: { type: String, trim: true, default: '' },
    registradoEn: { type: Date, default: Date.now },
  },
  { _id: false }
);

const esquemaTurno = new mongoose.Schema(
  {
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
    codigoReserva: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
      unique: true,
      sparse: true,
    },
    tokenGestionHash: {
      type: String,
      select: false,
      default: null,
    },
    tokenGestionCreadoEn: {
      type: Date,
      default: null,
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
    historial: {
      type: [esquemaHistorialTurno],
      default: [],
    },
  },
  {
    timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' },
    collection: 'turnos',
    toJSON: {
      transform(documento, objeto) {
        delete objeto.tokenGestionHash;
        if (documento.$locals?.tokenGestion) {
          objeto.tokenGestion = documento.$locals.tokenGestion;
        }
        return objeto;
      },
    },
  }
);

esquemaTurno.pre('validate', function prepararCredenciales(siguiente) {
  if (!this.isNew || this.codigoReserva) return siguiente();

  const credenciales = crearCredencialesGestionTurno();
  this.codigoReserva = credenciales.codigoReserva;
  this.tokenGestionHash = credenciales.tokenGestionHash;
  this.tokenGestionCreadoEn = credenciales.tokenGestionCreadoEn;
  this.$locals.tokenGestion = credenciales.tokenGestion;

  if (!this.historial.length) {
    this.historial.push(
      crearEntradaHistorial({
        accion: 'CREADO',
        actorRol: this.$locals.actorRol || 'AFILIADO',
        actorId: this.$locals.actorId || this.reservadoPorAfiliadoId,
        fechaNueva: this.fecha,
        horaNueva: this.hora,
      })
    );
  }

  return siguiente();
});

esquemaTurno.pre('save', function registrarCambioEstado(siguiente) {
  if (this.isNew || !this.isModified('estado')) return siguiente();

  const accion =
    this.estado === 'CANCELADO'
      ? 'CANCELADO'
      : this.estado === 'ATENDIDO'
        ? 'ATENDIDO'
        : null;
  if (!accion) return siguiente();

  const ultimo = this.historial[this.historial.length - 1];
  if (ultimo?.accion === accion) return siguiente();

  this.historial.push(
    crearEntradaHistorial({
      accion,
      actorRol:
        this.$locals.actorRol ||
        (accion === 'ATENDIDO' ? 'PRESTADOR' : 'AFILIADO'),
      actorId: this.$locals.actorId || null,
      fechaAnterior: this.fecha,
      horaAnterior: this.hora,
      motivo: this.$locals.motivo || '',
    })
  );

  return siguiente();
});

esquemaTurno.index(
  { agendaId: 1, fecha: 1, hora: 1 },
  {
    unique: true,
    partialFilterExpression: { estado: 'RESERVADO' },
  }
);

module.exports = mongoose.model('Turno', esquemaTurno);
