import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export async function registerRevokeRoutes(app: FastifyInstance) {
  app.post(
    "/identity/revoke",
    { preHandler: [app.authenticate] },
    async (request) => {
      const jwt = request.user as { sub: string };

      const user = await prisma.user.findUnique({
        where: { id: jwt.sub },
        select: { id: true, faceCommitmentHash: true },
      });

      if (!user) {
        return { error: "User not found" };
      }

      await prisma.user.update({
        where: { id: jwt.sub },
        data: {
          faceEmbedding: undefined,
          faceCommitmentHash: null,
          faceEnrolledAt: null,
          didHash: "REVOKED",
        },
      });

      if (user.faceCommitmentHash) {
        await prisma.kycSession.create({
          data: {
            userId: jwt.sub,
            provider: "system",
            status: "REVOKED",
          },
        });
      }

      return { ok: true, message: "Identity revoked. Face data cleared. Re-enroll to restore." };
    },
  );
}
