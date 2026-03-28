import { getAddress, keccak256, stringToHex, type Address } from "viem";

export function subjectIdFromWallet(address: Address): `0x${string}` {
  const a = getAddress(address);
  return keccak256(stringToHex(`indentix:amoy:${a.toLowerCase()}`));
}
