import { getAddress, keccak256, stringToHex, type Address } from "viem";

/** Deterministic subject id for AttestationHub (no PII). */
export function subjectIdFromWallet(address: Address): `0x${string}` {
  const a = getAddress(address);
  return keccak256(stringToHex(`indentix:amoy:${a.toLowerCase()}`));
}
