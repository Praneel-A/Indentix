import { config } from "dotenv";
import { z } from "zod";

config({ path: ".env" });

const hexAddr = /^0x[a-fA-F0-9]{40}$/;
const hexPk = /^0x[a-fA-F0-9]{64}$/;
const hex32 = /^0x[a-fA-F0-9]{64}$/;

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  /** When true, nonces + chain jobs run in-process (no Redis). For local demo only. */
  USE_MEMORY_STORE: z.coerce.boolean().default(false),
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
  JWT_SECRET: z.string().min(16),
  AMOY_RPC_URL: z.string().url(),
  RELAYER_PRIVATE_KEY: z.string().regex(hexPk),
  ATTESTATION_HUB_ADDRESS: z.string().regex(hexAddr),
  WEBHOOK_SECRET: z.string().optional(),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:5173,http://127.0.0.1:5173"),
  CHAIN_ID: z.coerce.number().default(80002),
});

export type Env = z.infer<typeof schema>;

export const env: Env = schema.parse(process.env);

export function assertHex32(value: string): `0x${string}` {
  if (!hex32.test(value)) throw new Error("Expected bytes32 hex");
  return value as `0x${string}`;
}
