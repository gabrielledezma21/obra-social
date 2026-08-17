const { mongoose } = require('../config/db');

const esquemaContador = new mongoose.Schema({
  _id: { type: String, required: true },
  secuencia: { type: Number, default: 0 },
}, {
  collection: 'contadores',
  versionKey: false,
});

module.exports = mongoose.model('Contador', esquemaContador);
