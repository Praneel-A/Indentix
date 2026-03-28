import { Queue, Worker, type Job } from "bullmq";
import { encodePacked, keccak256, getAddress, type Address } from "viem";
import { prisma } from "./prisma.js";
import { redis } from "./redis.js";
import { subjectIdFromWallet } from "./subject.js";
import { writeSetAttestation, waitForTxReceipt } from "./chain.js";
import { assertHex32, env } from "../env.js";

export const CHAIN_QUEUE = "chain";

let chainQueue: Queue | null = null;

function getQueue(): Queue {
  if (!redis) {
    throw new Error("Queue requires Redis (disable USE_MEMORY_STORE)");
  }
  if (!chainQueue) {
    chainQueue = new Queue(CHAIN_QUEUE, { connection: redis });
  }
  return chainQueue;
}

export interface SetAttestationJob {
  jobId: string;
  userId: string;
  walletAddress: Address;
  applicantId: string;
  kycLevel: number;
  riskTier: number;
}

function providerAttestationHash(params: {
  wallet: Address;
  kycLevel: number;
  riskTier: number;
  applicantId: string;
}): `0x${string}` {
  const w = getAddress(params.wallet);
  return keccak256(
    encodePacked(
      ["string", "address", "uint8", "uint8", "string"],
      [
        "indentix/v1",
        w,
        params.kycLevel,
        params.riskTier,
        params.applicantId,
      ],
    ),
  );
}

async function runSetAttestationJob(job: SetAttestationJob) {
  const { walletAddress, applicantId, kycLevel, riskTier } = job;
  const subjectId = subjectIdFromWallet(walletAddress);
  const ph = providerAttestationHash({
    wallet: walletAddress,
    kycLevel,
    riskTier,
    applicantId,
  });

  const onChainJob = await prisma.onChainJob.findUnique({
    where: { id: job.jobId },
  });
  if (!onChainJob || onChainJob.status === "confirmed") {
    return;
  }

  await prisma.onChainJob.update({
    where: { id: job.jobId },
    data: { status: "sent" },
  });

  try {
    const txHash = await writeSetAttestation({
      subjectId,
      kycLevel,
      riskTier,
      providerAttestationHash: assertHex32(ph),
    });
    await prisma.onChainJob.update({
      where: { id: job.jobId },
      data: { txHash, status: "sent" },
    });
    await waitForTxReceipt(txHash);
    await prisma.onChainJob.update({
      where: { id: job.jobId },
      data: { status: "confirmed" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.onChainJob.update({
      where: { id: job.jobId },
      data: { status: "failed", error: message },
    });
    throw e;
  }
}

export async function enqueueChainJob(data: SetAttestationJob) {
  if (env.USE_MEMORY_STORE) {
    setImmediate(() => {
      runSetAttestationJob(data).catch((err) => {
        console.error("[chain] inline job failed", err);
      });
    });
    return;
  }
  await getQueue().add("setAttestation", data, { jobId: data.jobId });
}

export function startChainWorker() {
  if (env.USE_MEMORY_STORE || !redis) {
    return null;
  }
  const worker = new Worker<SetAttestationJob>(
    CHAIN_QUEUE,
    async (job: Job<SetAttestationJob>) => {
      await runSetAttestationJob(job.data);
    },
    { connection: redis, concurrency: 1 },
  );

  worker.on("failed", (job, err) => {
    console.error("[chain worker] job failed", job?.id, err);
  });

  return worker;
}
