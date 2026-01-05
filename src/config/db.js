const mongoose = require('mongoose');
require('dotenv').config();

let isConnected;

const conectarDB = async () => {
    console.log('Conectando a MongoDB...');
    if (!isConnected) {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Conectado correctamente a MongoDB');
        isConnected = true;
    }
}

module.exports = {mongoose, conectarDB};