const { mongoose } = require("../config/db");
const { Schema } = require("mongoose");

const prestadorSchema = new mongoose.Schema(
  {
    nombre: {
      type: Schema.Types.String,
      required: [true, 'El nombre es obligatorio'],
      minlength: [2, 'El nombre debe tener al menos 2 caracteres'],
    },
    cuilCuit: {
      type: Schema.Types.String,
      required: [true, 'El cuilCuit es obligatorio'],
      unique: [true, 'El cuilCuit ya se encuentra registrado'],
      minlength: [11, 'El cuilCuit debe tener al menos 11 caracteres'],
    },
    emails: [{
      direccion: {
        type: Schema.Types.String,
        required: [true, 'El email es obligatorio'],
        unique: [true, 'El email ya se encuentra registrado'],
        validate: {
          validator: function (v) {
            return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
          },
          message: 'El email es invalido',
        },
      },
    }],
    telefonos: [{
      numero: {
        type: Schema.Types.String,
        required: [true, 'El telefono es obligatorio'],
        unique: [true, 'El telefono ya se encuentra registrado'],
        validate: {
          validator: function (v) {
            return /^\d{10}$/.test(v);
          },
          message: 'El telefono es invalido',
        },
      },
    }],
    especialidades: [{
      type: Schema.Types.ObjectId,
      ref: 'Especialidad',
      required: [true, 'El prestador debe tener al menos una especialidad'],
    }],
    centrosDeAtencion: [{
      type: Schema.Types.ObjectId,
      ref: 'CentroDeAtencion',
      required: [true, 'El prestador debe tener al menos un centro de atencion'],
    }],
    esCentroMedico: {
      type: Schema.Types.Boolean,
      default: false,
    },
    centroMedicoQueIntegra: {
      type: Schema.Types.ObjectId,
      ref: 'Prestador',
      default: null,
      validate: {
        validator: function (v) {
          // Un centro médico no puede integrar otro
          if (this.esCentroMedico) {
            return v == null;
          }
          return true;
        },
        message: 'Un centro médico no puede integrar otro centro médico',
      },
    },
  },
  {
    collection: "prestadores",
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

prestadorSchema.virtual('agendas', {
  ref: 'Agenda',
  localField: '_id',
  foreignField: 'prestadorId',
});

prestadorSchema.set("toJSON", {
  virtuals: true,
  transform: (_, ret) => {
    delete ret.__v;
    //delete ret.id;
    //delete ret._id;
  },
});

const Prestador = mongoose.model("Prestador", prestadorSchema);
module.exports = Prestador;