import Redis from "ioredis";
import { env } from "std-env";

let _connection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (_connection) return _connection;

  _connection = new Redis(env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

  return _connection;
}
