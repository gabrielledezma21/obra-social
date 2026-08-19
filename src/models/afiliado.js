const { mongoose } = require('../config/db');
const { Schema: Esquema } = require('mongoose');

const esquemaAfiliado = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre es obligatorio'],
    minlength: 2,
    trim: true,
  },
  apellido: {
    type: String,
    required: [true, 'El apellido es obligatorio'],
    minlength: 2,
    trim: true,
    index: true,
  },
  fechaNacimiento: { type: Date, default: null, index: true },
  tipoDocumento: {
    type: String,
    required: true,
    enum: ['DNI', 'LE', 'LC', 'CI', 'CE'],
  },
  dni: {
    type: Number,
    required: true,
    unique: true,
    validate: {
      validator: (valor) => valor >= 1000000 && valor < 100000000,
      message: 'El dni es inválido',
    },
  },
  numeroAfiliado: {
    type: Number,
    required: true,
    min: 1,
    max: 9999999,
    index: true,
  },
  numeroIntegrante: {
    type: Number,
    required: true,
    min: 1,
    max: 99,
  },
  parentesco: {
    type: String,
    required: true,
    enum: ['Titular', 'Conyuge', 'Hijo', 'Familiar a cargo'],
  },
  situacionesTerapeuticas: [{
    type: Esquema.Types.ObjectId,
    ref: 'SituacionTerapeutica',
  }],
  emails: [{
    direccion: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^\S+@\S+\.\S+$/,
    },
  }],
  telefonos: [{
    numero: {
      type: String,
      required: true,
      match: /^\d{10,15}$/,
    },
  }],
  direccionId: {
    type: Esquema.Types.ObjectId,
    ref: 'Direccion',
    required: true,
  },
  direccionesIds: [{ type: Esquema.Types.ObjectId, ref: 'Direccion' }],
  comparteDomicilioTitular: {
    type: Boolean,
    default: false,
  },
  plan: {
    type: String,
    required: true,
    enum: ['210', '310', '410', '510', 'Bronce', 'Plata', 'Oro', 'Platino'],
  },
  fechaAlta: { type: Date, required: true, index: true },
  fechaBaja: { type: Date, default: null, index: true },
  afiliadoTitularId: {
    type: Esquema.Types.ObjectId,
    ref: 'Afiliado',
    default: null,
  },
}, {
  collection: 'afiliados',
  timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

esquemaAfiliado.index(
  { numeroAfiliado: 1, numeroIntegrante: 1 },
  { unique: true }
);

esquemaAfiliado.virtual('familiares', {
  ref: 'Afiliado',
  localField: '_id',
  foreignField: 'afiliadoTitularId',
});

esquemaAfiliado.virtual('credencial').get(function () {
  return `${String(this.numeroAfiliado || '').padStart(7, '0')}-${String(
    this.numeroIntegrante || ''
  ).padStart(2, '0')}`;
});

esquemaAfiliado.virtual('vigente').get(function () {
  const ahora = new Date();
  return this.fechaAlta <= ahora && (!this.fechaBaja || this.fechaBaja > ahora);
});

esquemaAfiliado.set('toJSON', {
  virtuals: true,
  transform: (_documento, resultado) => {
    delete resultado.__v;
  },
});

module.exports = mongoose.model('Afiliado', esquemaAfiliado);
