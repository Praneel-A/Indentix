import type { Address } from "viem";
import { getAddress } from "viem";
import { prisma } from "../lib/prisma.js";
import { enqueueChainJob } from "../lib/queue.js";
import { assessCdd, kycLevelFromState } from "../lib/risk.js";

const TIER_LABEL = ["LOW", "MEDIUM", "HIGH"] as const;

export async function processKycDecision(input: {
  applicantExternalId: string;
  approved: boolean;
  countryCode?: string;
  eddApproved?: boolean;
}) {
  const applicant = await prisma.applicant.findUnique({
    where: { externalId: input.applicantExternalId },
    include: { user: true },
  });
  if (!applicant) {
    throw new Error("Applicant not found");
  }

  await prisma.applicant.update({
    where: { id: applicant.id },
    data: {
      status: input.approved ? "APPROVED" : "REJECTED",
      reviewedAt: new Date(),
    },
  });

  await prisma.kycSession.create({
    data: {
      userId: applicant.userId,
      provider: "mock",
      status: input.approved ? "VERIFIED" : "REJECTED",
    },
  });

  if (!input.approved) {
    return { queued: false as const };
  }

  const cdd = assessCdd(input.countryCode);
  const eddApproved = Boolean(input.eddApproved);
  const kycLevel = kycLevelFromState({
    kycApproved: true,
    eddRequired: cdd.eddRequired,
    eddApproved: cdd.eddRequired ? eddApproved : true,
  });

  let riskTier = cdd.riskTier;
  if (cdd.eddRequired && !eddApproved) {
    riskTier = 1;
  }

  await prisma.riskAssessment.upsert({
    where: { userId: applicant.userId },
    create: {
      userId: applicant.userId,
      tier: TIER_LABEL[riskTier],
      eddRequired: cdd.eddRequired,
      eddStatus: cdd.eddRequired
        ? eddApproved
          ? "APPROVED"
          : "PENDING"
        : null,
      countryCode: input.countryCode ?? null,
    },
    update: {
      tier: TIER_LABEL[riskTier],
      eddRequired: cdd.eddRequired,
      eddStatus: cdd.eddRequired
        ? eddApproved
          ? "APPROVED"
          : "PENDING"
        : null,
      countryCode: input.countryCode ?? null,
    },
  });

  const walletAddress = getAddress(applicant.user.walletAddress) as Address;

  const jobRow = await prisma.onChainJob.create({
    data: {
      userId: applicant.userId,
      kind: "SET_ATTESTATION",
      status: "pending",
      payload: {
        kycLevel,
        riskTier,
        applicantId: input.applicantExternalId,
      },
    },
  });

  await enqueueChainJob({
    jobId: jobRow.id,
    userId: applicant.userId,
    walletAddress,
    applicantId: input.applicantExternalId,
    kycLevel,
    riskTier,
  });

  return { queued: true as const, onChainJobId: jobRow.id };
}
