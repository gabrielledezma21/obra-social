const { createClient } = require('redis');

let client;
let connectionPromise;

const getClient = () => {
  if (!process.env.REDIS_URL) return null;

  if (!client) {
    client = createClient({ url: process.env.REDIS_URL });
    client.on('error', (error) => console.error('Redis error:', error.message));
  }

  return client;
};

const conectarRedis = async () => {
  const redis = getClient();
  if (!redis) return null;
  if (redis.isReady) return redis;

  if (!connectionPromise) {
    connectionPromise = redis.connect().catch((error) => {
      connectionPromise = undefined;
      throw error;
    });
  }

  await connectionPromise;
  return redis;
};

// La caché es una optimización: sin REDIS_URL la API sigue funcionando con MongoDB.
const redisClient = {
  async get(key) {
    const redis = await conectarRedis();
    return redis ? redis.get(key) : null;
  },
  async set(key, value, options) {
    const redis = await conectarRedis();
    return redis ? redis.set(key, value, options) : null;
  },
  async del(...keys) {
    const redis = await conectarRedis();
    return redis ? redis.del(keys) : 0;
  },
};

module.exports = { redisClient, conectarRedis };
