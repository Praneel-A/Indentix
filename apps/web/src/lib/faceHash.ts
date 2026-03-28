import { keccak256, stringToHex } from "viem";

/**
 * Coarse quantization — keep in sync with apps/api/src/lib/face.ts.
 * Round to 1 decimal so same person across captures gets a stable hash.
 */
export function normalizeEmbedding(raw: number[]): number[] {
  return raw.map((x) => Math.round(x * 10) / 10);
}

export function embeddingToCommitment(embedding: number[]): `0x${string}` {
  const n = normalizeEmbedding(embedding);
  return keccak256(stringToHex(JSON.stringify(n)));
}
