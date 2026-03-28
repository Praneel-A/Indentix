import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygonAmoy } from "viem/chains";
import { attestationHubAbi } from "../abi/attestationHub.js";
import { assertHex32, env } from "../env.js";

export function getPublicClient() {
  return createPublicClient({
    chain: polygonAmoy,
    transport: http(env.AMOY_RPC_URL),
  });
}

export function getRelayerWalletClient() {
  const account = privateKeyToAccount(env.RELAYER_PRIVATE_KEY as `0x${string}`);
  return createWalletClient({
    account,
    chain: polygonAmoy,
    transport: http(env.AMOY_RPC_URL),
  });
}

export async function writeSetAttestation(params: {
  subjectId: `0x${string}`;
  kycLevel: number;
  riskTier: number;
  providerAttestationHash: `0x${string}`;
}): Promise<Hash> {
  const wallet = getRelayerWalletClient();
  const hash = await wallet.writeContract({
    address: env.ATTESTATION_HUB_ADDRESS as Address,
    abi: attestationHubAbi,
    functionName: "setAttestation",
    args: [
      assertHex32(params.subjectId),
      params.kycLevel,
      params.riskTier,
      assertHex32(params.providerAttestationHash),
    ],
  });
  return hash;
}

export async function waitForTxReceipt(txHash: Hash) {
  const publicClient = getPublicClient();
  return publicClient.waitForTransactionReceipt({ hash: txHash });
}
