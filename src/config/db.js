const mongoose = require('mongoose');
require('dotenv').config();

let connectionPromise;

const conectarDB = async () => {
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!mongoUri) {
        throw new Error('Falta configurar MONGO_URI o MONGODB_URI');
    }

    if (!connectionPromise) {
        connectionPromise = mongoose.connect(mongoUri, {
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
