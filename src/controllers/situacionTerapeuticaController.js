const { SituacionTerapeutica } = require("../models");

const getSituacionesTerapeuticas = async (_, res) => {

  const situacionesTerapeuticas = await SituacionTerapeutica.find();

  res.status(200).json(situacionesTerapeuticas);
}

module.exports = { getSituacionesTerapeuticas };