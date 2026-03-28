import { keccak256, stringToHex } from "viem";

export function normalizeEmbedding(raw: number[]): number[] {
  return raw.map((x) => Math.round(x * 10) / 10);
}

export function preciseEmbedding(raw: number[]): number[] {
  return raw.map((x) => Math.round(x * 1e6) / 1e6);
}

export function embeddingToCommitment(embedding: number[]): string {
  return keccak256(stringToHex(JSON.stringify(normalizeEmbedding(embedding))));
}

export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; sum += d * d; }
  return Math.sqrt(sum);
}

export function averageEmbeddings(samples: number[][]): number[] {
  const len = samples[0].length;
  const avg = new Array<number>(len).fill(0);
  for (const s of samples) for (let i = 0; i < len; i++) avg[i] += s[i];
  for (let i = 0; i < len; i++) avg[i] /= samples.length;
  return avg;
}

export const MATCH_THRESHOLD = 0.35;
