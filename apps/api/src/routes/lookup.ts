import type { FastifyInstance } from "fastify";
import { isAddress, getAddress } from "viem";
import { prisma } from "../lib/prisma.js";

function computeTrustScore(user: {
  faceCommitmentHash: string | null;
  applicant: { status: string } | null;
  riskAssessment: { tier: string; eddRequired: boolean; eddStatus: string | null } | null;
}): { score: number; level: string; breakdown: Record<string, number> } {
  let score = 0;
  const breakdown: Record<string, number> = {};

  if (user.faceCommitmentHash) {
    breakdown.faceEnrolled = 25;
    score += 25;
  }

  if (user.applicant?.status === "APPROVED") {
    breakdown.kycApproved = 35;
    score += 35;
  }

  if (user.riskAssessment) {
    const tier = user.riskAssessment.tier;
    if (tier === "LOW") { breakdown.riskTier = 25; score += 25; }
    else if (tier === "MEDIUM") { breakdown.riskTier = 15; score += 15; }
    else { breakdown.riskTier = 5; score += 5; }

    if (user.riskAssessment.eddRequired && user.riskAssessment.eddStatus === "APPROVED") {
      breakdown.eddCleared = 15;
      score += 15;
    }
  }

  const level =
    score >= 80 ? "TRUSTED" :
    score >= 50 ? "VERIFIED" :
    score >= 25 ? "BASIC" :
    "UNVERIFIED";

  return { score, level, breakdown };
}

export async function registerLookupRoutes(app: FastifyInstance) {
  app.get("/lookup/:wallet", async (request, reply) => {
    const { wallet } = request.params as { wallet: string };
    if (!isAddress(wallet)) {
      return reply.status(400).send({ error: "Invalid wallet address" });
    }
    const address = getAddress(wallet);

    const user = await prisma.user.findUnique({
      where: { walletAddress: address },
      select: {
        walletAddress: true,
        faceCommitmentHash: true,
        faceEnrolledAt: true,
        applicant: { select: { status: true, reviewedAt: true } },
        riskAssessment: {
          select: { tier: true, eddRequired: true, eddStatus: true },
        },
        createdAt: true,
      },
    });

    if (!user) {
      return reply.status(404).send({ error: "User not found", wallet: address });
    }

    const trust = computeTrustScore({
      faceCommitmentHash: user.faceCommitmentHash,
      applicant: user.applicant,
      riskAssessment: user.riskAssessment,
    });

    return {
      wallet: user.walletAddress,
      faceEnrolled: Boolean(user.faceCommitmentHash),
      faceCommitmentHash: user.faceCommitmentHash,
      kyc: user.applicant?.status ?? "NONE",
      riskTier: user.riskAssessment?.tier ?? null,
      eddStatus: user.riskAssessment?.eddStatus ?? null,
      trust,
      memberSince: user.createdAt,
    };
  });
}

export { computeTrustScore };
