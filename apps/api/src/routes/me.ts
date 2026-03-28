import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { computeTrustScore } from "./lookup.js";

export async function registerMeRoutes(app: FastifyInstance) {
  app.get(
    "/me",
    { preHandler: [app.authenticate] },
    async (request) => {
      const jwt = request.user as { sub: string; wallet: string };
      const user = await prisma.user.findUnique({
        where: { id: jwt.sub },
        include: {
          applicant: true,
          riskAssessment: true,
          kycSessions: {
            orderBy: { createdAt: "desc" },
            take: 3,
          },
          onChainJobs: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      });
      if (!user) {
        return { error: "User not found" };
      }
      const trust = computeTrustScore({
        faceCommitmentHash: user.faceCommitmentHash,
        applicant: user.applicant,
        riskAssessment: user.riskAssessment,
      });

      return {
        wallet: user.walletAddress,
        didHash: user.didHash,
        faceCommitmentHash: user.faceCommitmentHash,
        faceEnrolledAt: user.faceEnrolledAt,
        applicant: user.applicant,
        risk: user.riskAssessment,
        trust,
        kycSessions: user.kycSessions,
        recentJobs: user.onChainJobs,
      };
    },
  );
}
