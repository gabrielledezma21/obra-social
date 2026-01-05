const { Especialidad } = require("../models");

const getEspecialidades = async (_, res) => {

  const especialidades = await Especialidad.find();

  res.status(200).json(especialidades);
}

module.exports = { getEspecialidades };
