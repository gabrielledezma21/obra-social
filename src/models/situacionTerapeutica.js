const { mongoose } = require("../config/db");
const { Schema } = require("mongoose");

const situacionTerapeuticaSchema = new mongoose.Schema(
  {
    nombre:{
      type: Schema.Types.String,
      required: [true, 'El nombre es obligatorio'],
      minlength: [3, 'El nombre debe tener al menos 3 caracteres'],
    },
    afiliados: [{
      type: Schema.Types.ObjectId,
      ref: 'Afiliado',
    }],
  },
  {
    collection: "situacionesTerapeuticas",
  }
);

situacionTerapeuticaSchema.set("toJSON", {
  transform: (_, ret) => {
    delete ret.__v;
    //delete ret._id;
  },
});

const SituacionTerapeutica = mongoose.model("SituacionTerapeutica", situacionTerapeuticaSchema);
module.exports = SituacionTerapeutica;