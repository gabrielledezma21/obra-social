const { mongoose } = require("../config/db");
const { Schema } = require("mongoose");

const especialidadSchema = new mongoose.Schema(
  {
    nombre: {
      type: Schema.Types.String,
      required: [true, 'El nombre es obligatorio'],
      minlength: [3, 'El nombre debe tener al menos 3 caracteres'],
    },
  },
  {
    collection: "especialidades",
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

especialidadSchema.virtual('prestadores', {
  ref: 'Prestador',
  localField: '_id',
  foreignField: 'especialidades',
});

especialidadSchema.virtual('agendas', {
  ref: 'Agenda',
  localField: '_id',
  foreignField: 'especialidadId',
});

especialidadSchema.set("toJSON", {
  virtuals: true,
  transform: (_, ret) => {
    delete ret.__v;
    delete ret.id;
    //delete ret._id;
  },
});

const Especialidad = mongoose.model("Especialidad", especialidadSchema);
module.exports = Especialidad;