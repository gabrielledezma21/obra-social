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
      required: [true, 'El numero de afiliado es obligatorio'],
      unique: [true, 'El numero de afiliado ya se encuentra registrado'],
    },
    numeroIntegrante: {
      type: Schema.Types.Number,
      required: [true, 'El numero de integrante es obligatorio'],
      unique: [true, 'El numero de integrante ya se encuentra registrado'],
    },
    parentesco: {
      type: Schema.Types.String,
      required: [true, 'El parentesco es obligatorio'],
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
    },
    fechaAlta: {
      type: Schema.Types.Date,
      required: [true, 'La fecha de alta es obligatoria'],
    },
    fechaBaja: {
      type: Schema.Types.Date,
    },
    familiares: [{
      type: Schema.Types.ObjectId,
      ref: 'Familiar',
    }],
    afiliadoTitularId: {
      type: Schema.Types.ObjectId,
      ref: 'Afiliado',
    },
  },
  {
    collection: "afiliados",
  }
);

afiliadoSchema.set("toJSON", {
  transform: (_, ret) => {
    delete ret.__v;
    //delete ret._id;
  },
});

const Afiliado = mongoose.model("Afiliado", afiliadoSchema);
module.exports = Afiliado;