import type { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma.js";

export async function registerOnboardingRoutes(app: FastifyInstance) {
  app.post(
    "/onboarding/start",
    { preHandler: [app.authenticate] },
    async (request) => {
      const jwt = request.user as { sub: string };
      const externalId = randomUUID();

      const existing = await prisma.applicant.findUnique({
        where: { userId: jwt.sub },
      });
      if (existing) {
        return {
          applicantId: existing.externalId,
          message: "Applicant already created",
        };
      }

      await prisma.applicant.create({
        data: {
          userId: jwt.sub,
          externalId,
          status: "PENDING",
        },
      });

      await prisma.kycSession.create({
        data: {
          userId: jwt.sub,
          provider: "mock",
          status: "PENDING",
        },
      });

      return {
        applicantId: externalId,
        message:
          "Use POST /webhooks/kyc with this applicantId, or POST /dev/mock-kyc (dev only).",
      };
    },
  );
}
