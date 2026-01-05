const { mongoose } = require("../config/db");
const { Schema } = require("mongoose");

const direccionSchema = new mongoose.Schema(
  {
    calle: {
      type: Schema.Types.String,
      required: [true, 'La calle es obligatoria'],
      minlength: [3, 'La calle debe tener al menos 3 caracteres'],
    },
    altura: {
      type: Schema.Types.Number,
      required: [true, 'La altura es obligatoria'],
      min: [1, 'La altura debe ser mayor a 0'],
    },
    pisoDepto: {
      type: Schema.Types.String,
      default: null,
    },
    localidad: {
      type: Schema.Types.String,
      required: [true, 'La localidad es obligatoria'],
      minlength: [3, 'La localidad debe tener al menos 3 caracteres'],
    },
    codigoPostal: {
      type: Schema.Types.String,
      required: [true, 'El codigo postal es obligatorio'],
      default: null,
    },
    provincia: {
      type: Schema.Types.String,
      required: [true, 'La provincia es obligatoria'],
      minlength: [3, 'La provincia debe tener al menos 3 caracteres'],
    }
  },
  {
    collection: "direcciones",
  }
);

direccionSchema.set("toJSON", {
  transform: (_, ret) => {
    delete ret.__v;
    //delete ret._id;
  },
});

const Direccion = mongoose.model("Direccion", direccionSchema);
module.exports = Direccion;