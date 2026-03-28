import { keccak256, stringToHex } from "viem";

const DESCRIPTOR_LEN = 128;

export function normalizeEmbedding(raw: number[]): number[] {
  return raw.map((x) => Math.round(x * 10) / 10);
}

export function preciseEmbedding(raw: number[]): number[] {
  return raw.map((x) => Math.round(x * 1e6) / 1e6);
}

export function embeddingToCommitment(embedding: number[]): `0x${string}` {
  const n = normalizeEmbedding(embedding);
  if (n.length !== DESCRIPTOR_LEN) {
    throw new Error(`Expected ${DESCRIPTOR_LEN} dimensions`);
  }
  return keccak256(stringToHex(JSON.stringify(n)));
}

/**
 * Euclidean distance (L2 norm) — the metric face-api.js is designed for.
 * Lower = more similar.
 *
 * Same person across captures: 0.2 – 0.45
 * Different person:            0.7 – 1.3+
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function averageEmbeddings(samples: number[][]): number[] {
  if (samples.length === 0) throw new Error("No samples");
  const len = samples[0].length;
  const avg = new Array<number>(len).fill(0);
  for (const s of samples) {
    for (let i = 0; i < len; i++) avg[i] += s[i];
  }
  for (let i = 0; i < len; i++) avg[i] /= samples.length;
  return avg;
}

/**
 * face-api.js recommended threshold: 0.6 Euclidean distance.
 * distance ≤ 0.6 → SAME person (PASS)
 * distance > 0.6 → DIFFERENT person (FAIL)
 */
export const FACE_MATCH_THRESHOLD = 0.35;
