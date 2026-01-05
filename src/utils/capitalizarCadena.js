const capitalizarCadena = async (texto) => {
  const cadenaEnMinusculas = texto.toLowerCase();

  return cadenaEnMinusculas
    .split(' ')
    .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
    .join(' ');
};

module.exports = { capitalizarCadena };