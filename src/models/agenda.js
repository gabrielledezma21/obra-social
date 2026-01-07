const { mongoose } = require("../config/db");
const { Schema } = require("mongoose");
const { horarioSchema } = require("./horario");

const agendaSchema = new mongoose.Schema(
  {
    especialidadId: {
      type: Schema.Types.ObjectId,
      ref: 'Especialidad',
      required: [true, 'La agenda debe tener una especialidad'],
    },
    centroDeAtencionId: {
      type: Schema.Types.ObjectId,
      ref: 'CentroDeAtencion',
      required: [true, 'La agenda debe tener un centro de atencion'],
    },
    prestadorId: {
      type: Schema.Types.ObjectId,
      ref: 'Prestador',
      required: [true, 'La agenda debe tener un prestador'],
    },
    horario: {
      type: horarioSchema,
      required: [true, 'La agenda debe tener un horario'],
    },
  },
  {
    collection: "agendas",
  }
);

agendaSchema.set("toJSON", {
  transform: (_, ret) => {
    delete ret.__v;
    //delete ret._id;
  },
});

const Agenda = mongoose.model("Agenda", agendaSchema);
module.exports = Agenda;