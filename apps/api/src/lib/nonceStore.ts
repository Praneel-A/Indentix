import { redis } from "./redis.js";
import { env } from "../env.js";

const mem = new Map<string, { value: string; expiresAt: number }>();
const NONCE_TTL_MS = 300_000;

function r() {
  if (!redis) throw new Error("Redis required when USE_MEMORY_STORE=false");
  return redis;
}

export async function saveNonce(walletAddress: string, nonce: string) {
  const key = walletAddress.toLowerCase();
  if (env.USE_MEMORY_STORE) {
    mem.set(key, { value: nonce, expiresAt: Date.now() + NONCE_TTL_MS });
    return;
  }
  await r().set(`siwe:nonce:${key}`, nonce, "EX", 300);
}

export async function readNonce(walletAddress: string): Promise<string | null> {
  const key = walletAddress.toLowerCase();
  if (env.USE_MEMORY_STORE) {
    const row = mem.get(key);
    if (!row) return null;
    if (Date.now() > row.expiresAt) {
      mem.delete(key);
      return null;
    }
    return row.value;
  }
  return r().get(`siwe:nonce:${key}`);
}

export async function clearNonce(walletAddress: string) {
  const key = walletAddress.toLowerCase();
  if (env.USE_MEMORY_STORE) {
    mem.delete(key);
    return;
  }
  await r().del(`siwe:nonce:${key}`);
}
