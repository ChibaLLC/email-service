import Redis from "ioredis";

let _connection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (_connection) return _connection;

  _connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

  return _connection;
}
