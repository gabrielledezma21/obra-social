const mongoose = require('mongoose');
require('dotenv').config();

let connectionPromise;

const conectarDB = async () => {
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    if (!process.env.MONGO_URI) {
        throw new Error('Falta configurar la variable MONGO_URI');
    }

    if (!connectionPromise) {
        connectionPromise = mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
        }).catch((error) => {
            connectionPromise = undefined;
            throw error;
        });
    }

    await connectionPromise;
    return mongoose.connection;
}

module.exports = {mongoose, conectarDB};
