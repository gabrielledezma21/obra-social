require('dotenv').config();

const { APP } = require('./app');

const PORT = process.env.PORT || 3002;

APP.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
