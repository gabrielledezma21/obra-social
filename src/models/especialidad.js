const { mongoose } = require("../config/db");
const { Schema } = require("mongoose");

const especialidadSchema = new mongoose.Schema(
  {
    nombre:{
      type: Schema.Types.String,
      required: [true, 'El nombre es obligatorio'],
      minlength: [3, 'El nombre debe tener al menos 3 caracteres'],
    },
    prestadores: [{
      type: Schema.Types.ObjectId,
      ref: 'Prestador',
    }],
    agendas: [{
      type: Schema.Types.ObjectId,
      ref: 'Agenda',
    }],
  },
  {
    collection: "especialidades",
  }
);

especialidadSchema.set("toJSON", {
  transform: (_, ret) => {
    delete ret.__v;
    //delete ret._id;
  },
});

const Especialidad = mongoose.model("Especialidad", especialidadSchema);
module.exports = Especialidad;