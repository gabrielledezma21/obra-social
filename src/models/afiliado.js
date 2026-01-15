const { mongoose } = require("../config/db");
const { Schema } = require("mongoose");

const afiliadoSchema = new mongoose.Schema(
  {
    nombre: {
      type: Schema.Types.String,
      required: [true, 'El nombre es obligatorio'],
      minlength: [2, 'El nombre debe tener al menos 2 caracteres'],
    },
    apellido: {
      type: Schema.Types.String,
      required: [true, 'El apellido es obligatorio'],
      minlength: [2, 'El apellido debe tener al menos 2 caracteres'],
    },
    tipoDocumento: {
      type: Schema.Types.String,
      required: [true, 'El tipo de documento es obligatorio'], 
      enum: {
        values: ['DNI', 'LE', 'LC', 'CI', 'CE'],
        message: 'Tipo de documento no válido'
      }
    },
    dni: {
      type: Schema.Types.Number,
      required: [true, 'El dni es obligatorio'],
      unique: [true, 'El dni ya se encuentra registrado'],
      validate: {
        //numero entre1000000 y 100000000
        validator: function (v) {
          return v >= 1000000 && v < 100000000;
        },
        message: 'El dni es invalido',
      },
    },
    numeroAfiliado: {
      type: Schema.Types.Number,
      // unique: [true, 'El numero de afiliado ya se encuentra registrado'], // Must be shared by family
    },
    numeroIntegrante: {
      type: Schema.Types.Number,
      // unique: [true, 'El numero de integrante ya se encuentra registrado'], // Removed global uniqueness
    },
    parentesco: {
      type: Schema.Types.String,
      required: [true, 'El parentesco es obligatorio'],
      enum: {
        values: ['Titular', 'Conyuge', 'Hijo', 'Familiar a cargo'],
        message: 'Parentesco no válido'
      }
    },
    situacionesTerapeuticas: [{
      type: Schema.Types.ObjectId,
      ref: 'SituacionTerapeutica',
    }],
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
    direccionId: {
      type: Schema.Types.ObjectId,
      ref: 'Direccion',
      required: [true, 'La direccion es obligatoria'],
    },
    plan: {
      type: Schema.Types.String,
      required: [true, 'El plan es obligatorio'],
      enum: {
        values: ['210', '310', '410', '510'],
        message: 'Plan no válido'
      }
    },
    fechaAlta: {
      type: Schema.Types.Date,
      required: [true, 'La fecha de alta es obligatoria'],
    },
    fechaBaja: {
      type: Schema.Types.Date,
    },
    afiliadoTitularId: {
      type: Schema.Types.ObjectId,
      ref: 'Afiliado',
    },
  },
  {
    collection: "afiliados",
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

afiliadoSchema.virtual('familiares', {
  ref: 'Afiliado',
  localField: '_id',
  foreignField: 'afiliadoTitularId',
});

afiliadoSchema.set("toJSON", {
  virtuals: true,
  transform: (_, ret) => {
    delete ret.__v;
    //delete ret.id; // Usually virtuals: true adds 'id', we might want to keep _id only or both? Let's assume standard behavior. user transform removed __v.
    //delete ret._id;
  },
});

const Afiliado = mongoose.model("Afiliado", afiliadoSchema);
module.exports = Afiliado;