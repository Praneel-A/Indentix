import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAddress, isAddress } from "viem";
import { prisma } from "../lib/prisma.js";
import { processKycDecision } from "../services/kyc.js";

const kycBody = z.object({
  applicantId: z.string(),
  reviewStatus: z.enum(["approved", "rejected"]),
  countryCode: z.string().length(3).optional(),
  eddApproved: z.boolean().optional(),
});

const loginBody = z.object({
  address: z.string().optional(),
});

export async function registerDevRoutes(app: FastifyInstance) {
  const allow =
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_DEV_MOCK === "true";

  /** Dev-only: create a JWT for any wallet address without SIWE. */
  app.post("/dev/login", async (request, reply) => {
    if (!allow) {
      return reply.status(404).send({ error: "Not found" });
    }
    const body = loginBody.safeParse(request.body);
    const raw = body.success ? body.data.address : undefined;
    const wallet = raw && isAddress(raw)
      ? getAddress(raw)
      : "0x000000000000000000000000000000000000dEaD";

    const user = await prisma.user.upsert({
      where: { walletAddress: wallet },
      create: { walletAddress: wallet },
      update: {},
    });

    const token = await reply.jwtSign({
      sub: user.id,
      wallet: user.walletAddress,
    });

    return { token, user: { id: user.id, wallet: user.walletAddress } };
  });

  app.post(
    "/dev/mock-kyc",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      if (!allow) {
        return reply.status(404).send({ error: "Not found" });
      }

      const parsed = kycBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const jwt = request.user as { sub: string };
      const applicant = await prisma.applicant.findFirst({
        where: { externalId: parsed.data.applicantId, userId: jwt.sub },
      });
      if (!applicant) {
        return reply
          .status(404)
          .send({ error: "Applicant not found for user" });
      }

      try {
        const result = await processKycDecision({
          applicantExternalId: parsed.data.applicantId,
          approved: parsed.data.reviewStatus === "approved",
          countryCode: parsed.data.countryCode,
          eddApproved: parsed.data.eddApproved,
        });
        return { ok: true, ...result };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return reply.status(400).send({ error: message });
      }
    },
  );
}
