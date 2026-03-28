import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  averageEmbeddings,
  euclideanDistance,
  embeddingToCommitment,
  FACE_MATCH_THRESHOLD,
  preciseEmbedding,
} from "../lib/face.js";

const enrollBody = z.object({
  samples: z.array(z.array(z.number()).length(128)).min(1).max(10),
});

const verifyBody = z.object({
  embedding: z.array(z.number()).length(128),
});

async function checkDuplicate(
  embedding: number[],
  excludeUserId: string,
): Promise<
  | { duplicate: false; closestDistance: number }
  | { duplicate: true; kind: "hash" | "distance"; hash: string; distance: number }
> {
  const hash = embeddingToCommitment(embedding);
  const precise = preciseEmbedding(embedding);

  const hashMatch = await prisma.user.findFirst({
    where: { faceCommitmentHash: hash, id: { not: excludeUserId } },
    select: { id: true, faceEmbedding: true },
  });

  if (hashMatch) {
    let dist = 0;
    if (hashMatch.faceEmbedding && Array.isArray(hashMatch.faceEmbedding)) {
      dist = euclideanDistance(precise, (hashMatch.faceEmbedding as number[]).map(Number));
    }
    return { duplicate: true, kind: "hash", hash, distance: round3(dist) };
  }

  const others = (
    await prisma.user.findMany({
      where: { id: { not: excludeUserId } },
      select: { id: true, faceEmbedding: true },
    })
  ).filter((u) => u.faceEmbedding != null);

  let closestDist = Infinity;
  for (const u of others) {
    const emb = u.faceEmbedding as unknown;
    if (!Array.isArray(emb) || emb.length !== 128) continue;
    const dist = euclideanDistance(precise, emb.map(Number));
    if (dist < closestDist) closestDist = dist;
    if (dist <= FACE_MATCH_THRESHOLD) {
      return { duplicate: true, kind: "distance", hash, distance: round3(dist) };
    }
  }

  return { duplicate: false, closestDistance: closestDist === Infinity ? -1 : round3(closestDist) };
}

function round3(n: number) { return Math.round(n * 1000) / 1000; }

export async function registerFaceRoutes(app: FastifyInstance) {
  /** Enroll: capture 1–10 samples, average, check duplicates, store. */
  app.post(
    "/face/enroll",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const jwt = request.user as { sub: string };
      const parsed = enrollBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const averaged = averageEmbeddings(parsed.data.samples);
      const commitment = embeddingToCommitment(averaged);

      const dup = await checkDuplicate(averaged, jwt.sub);
      if (dup.duplicate) {
        return reply.status(409).send({
          error: dup.kind === "hash"
            ? "Exact face hash already registered to another account"
            : "Face matches an existing account",
          kind: dup.kind,
          hash: dup.hash,
          distance: dup.distance,
          threshold: FACE_MATCH_THRESHOLD,
        });
      }

      await prisma.user.update({
        where: { id: jwt.sub },
        data: {
          faceEmbedding: preciseEmbedding(averaged),
          faceCommitmentHash: commitment,
          faceEnrolledAt: new Date(),
        },
      });

      return {
        ok: true,
        faceCommitmentHash: commitment,
        samplesUsed: parsed.data.samples.length,
        closestExistingUser: dup.closestDistance,
      };
    },
  );

  /**
   * Verify: compare incoming face against enrolled identity.
   * PASS → 200 { match: true }
   * FAIL → 403 { match: false } — hard rejection, not just a soft "no match"
   */
  app.post(
    "/face/verify",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const jwt = request.user as { sub: string };
      const parsed = verifyBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const user = await prisma.user.findUnique({
        where: { id: jwt.sub },
        select: { faceEmbedding: true, faceCommitmentHash: true },
      });

      if (
        !user?.faceEmbedding ||
        !Array.isArray(user.faceEmbedding) ||
        (user.faceEmbedding as number[]).length !== 128
      ) {
        return reply.status(404).send({ error: "No face enrolled for this account" });
      }

      const incoming = preciseEmbedding(parsed.data.embedding);
      const incomingHash = embeddingToCommitment(parsed.data.embedding);
      const stored = (user.faceEmbedding as number[]).map(Number);
      const distance = euclideanDistance(stored, incoming);
      const match = distance <= FACE_MATCH_THRESHOLD;

      const payload = {
        match,
        distance: round3(distance),
        threshold: FACE_MATCH_THRESHOLD,
        verdict: match ? "PASS" : "FAIL",
        faceHash: incomingHash,
        storedHash: user.faceCommitmentHash,
        hashMatch: incomingHash.toLowerCase() === user.faceCommitmentHash?.toLowerCase(),
      };

      if (!match) {
        return reply.status(403).send(payload);
      }

      return payload;
    },
  );
}
