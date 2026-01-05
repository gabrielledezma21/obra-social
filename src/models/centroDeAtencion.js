const { mongoose } = require("../config/db");
const { Schema } = require("mongoose");

const centroDeAtencionSchema = new mongoose.Schema(
  {
    direccionId: {
      type: Schema.Types.ObjectId,
      ref: 'Direccion',
      required: [true, 'La direccion es obligatoria'],
    },
    horarioId: {
      type: Schema.Types.ObjectId,
      ref: 'Horario',
      required: [true, 'El centro de atencion debe tener al menos un horario'],
    },
    
  },
  {
    collection: "centrosDeAtencion",
  }
);

centroDeAtencionSchema.set("toJSON", {
  transform: (_, ret) => {
    delete ret.__v;
    //delete ret._id;
  },
});

const CentroDeAtencion = mongoose.model("CentroDeAtencion", centroDeAtencionSchema);
module.exports = CentroDeAtencion;