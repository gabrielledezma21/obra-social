const { createClient } = require('redis');

const redisClient = createClient();

redisClient.on('error', (err) => console.error('Redis error: ', err));

let isConnected;

const conectarRedis = async () => {
    console.log('Conectando a Redis...');
    if (!isConnected) {
        await redisClient.connect();
        console.log('Conectado correctamente a Redis');
        isConnected = true;
        //Borrar el contenido de la cache al iniciar el servidor
        try {
            await redisClient.flushAll();
            console.log('Cache de Redis limpiada');
        } catch (error) {
            console.error('Error al limpiar la cache de Redis:', error);
        }
    }
}

module.exports = { redisClient, conectarRedis };