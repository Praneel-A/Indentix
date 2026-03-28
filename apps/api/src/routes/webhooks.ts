import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { env } from "../env.js";
import { processKycDecision } from "../services/kyc.js";

const kycBody = z.object({
  applicantId: z.string().min(1),
  reviewStatus: z.enum(["approved", "rejected"]),
  countryCode: z.string().length(3).optional(),
  eddApproved: z.boolean().optional(),
});

export async function registerWebhookRoutes(app: FastifyInstance) {
  app.post("/webhooks/kyc", async (request, reply) => {
    if (env.WEBHOOK_SECRET) {
      const secret = request.headers["x-webhook-secret"];
      if (secret !== env.WEBHOOK_SECRET) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
    }

    const parsed = kycBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { applicantId, reviewStatus, countryCode, eddApproved } = parsed.data;

    const applicant = await prisma.applicant.findUnique({
      where: { externalId: applicantId },
    });
    if (!applicant) {
      return reply.status(404).send({ error: "Applicant not found" });
    }

    const event = await prisma.webhookEvent.create({
      data: {
        userId: applicant.userId,
        provider: "kyc",
        payload: parsed.data as object,
        processed: false,
      },
    });

    try {
      const result = await processKycDecision({
        applicantExternalId: applicantId,
        approved: reviewStatus === "approved",
        countryCode,
        eddApproved,
      });

      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { processed: true },
      });

      return { ok: true, ...result };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return reply.status(400).send({ error: message });
    }
  });
}
