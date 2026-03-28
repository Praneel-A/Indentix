import { Redis } from "ioredis";
import { env } from "../env.js";

/** Null when `USE_MEMORY_STORE` — BullMQ and SIWE nonces use memory instead. */
export const redis: Redis | null = env.USE_MEMORY_STORE
  ? null
  : new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
