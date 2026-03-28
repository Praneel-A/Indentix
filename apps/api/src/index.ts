import Fastify from "fastify";
import cors from "@fastify/cors";
import { store, type AppUser } from "./store.js";
import {
  averageEmbeddings,
  embeddingToCommitment,
  euclideanDistance,
  MATCH_THRESHOLD,
  preciseEmbedding,
} from "./lib/face.js";

const PORT = Number(process.env.PORT) || 4000;

async function main() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true, credentials: true });

  app.get("/", async () => ({ name: "Indentix API", status: "running" }));
  app.get("/health", async () => ({ ok: true }));

  /* ── Auth: phone login with face gate ── */

  app.post("/auth/login", async (request) => {
    const { phone, name } = request.body as { phone?: string; name?: string };
    if (!phone) return { error: "phone required" };

    let user = await store.getByPhone(phone);

    if (!user) {
      user = await store.createUser(phone, name ?? phone);
      return { user: sanitize(user), requireFace: false };
    }

    if (user.faceHash) {
      return { user: null, requireFace: true, userId: user.id, userName: user.name };
    }

    return { user: sanitize(user), requireFace: false };
  });

  app.post("/auth/verify-face", async (request, reply) => {
    const { userId, embedding } = request.body as { userId?: string; embedding?: number[] };
    if (!userId || !embedding) return reply.status(400).send({ error: "userId and embedding required" });

    const user = await store.getById(userId);
    if (!user?.faceEmbedding) return reply.status(404).send({ error: "No face enrolled for this account" });

    const incoming = preciseEmbedding(embedding);
    const distance = euclideanDistance(user.faceEmbedding, incoming);
    const match = distance <= MATCH_THRESHOLD;

    if (!match) {
      return reply.status(403).send({
        error: "Face does not match. Access denied.",
        distance: Math.round(distance * 1000) / 1000,
        threshold: MATCH_THRESHOLD,
      });
    }

    return { user: sanitize(user), verified: true, distance: Math.round(distance * 1000) / 1000 };
  });

  /* ── Profile ── */

  app.get("/user/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const u = await store.getById(id);
    if (!u) return reply.status(404).send({ error: "User not found" });
    return { user: sanitize(u) };
  });

  app.get("/lookup/phone/:phone", async (request, reply) => {
    const { phone } = request.params as { phone: string };
    const u = await store.getByPhone(phone);
    if (!u) return reply.status(404).send({ error: "User not found" });
    return { user: sanitize(u) };
  });

  /* ── Face enrollment ── */

  app.post("/face/enroll", async (request, reply) => {
    const { userId, samples } = request.body as { userId?: string; samples?: number[][] };
    if (!userId || !samples?.length) return reply.status(400).send({ error: "userId and samples required" });
    const user = await store.getById(userId);
    if (!user) return reply.status(404).send({ error: "User not found" });

    const averaged = averageEmbeddings(samples);
    const hash = embeddingToCommitment(averaged);
    const precise = preciseEmbedding(averaged);

    const allUsers = await store.allUsers();
    for (const other of allUsers) {
      if (other.id === userId || !other.faceEmbedding) continue;
      const dist = euclideanDistance(precise, other.faceEmbedding);
      if (dist <= MATCH_THRESHOLD) {
        return reply.status(409).send({
          error: "Face matches an existing user",
          matchedUser: other.name,
          distance: Math.round(dist * 1000) / 1000,
        });
      }
    }

    const t = store.computeTrust({ ...user, faceHash: hash });
    await store.updateUser(userId, {
      faceEmbedding: precise,
      faceHash: hash,
      faceEnrolledAt: new Date().toISOString(),
      trustScore: t.score,
      trustLevel: t.level,
    });

    const updated = await store.getById(userId);
    return { ok: true, faceHash: hash, user: sanitize(updated), samplesUsed: samples.length };
  });

  /* ── Face verify ── */

  app.post("/face/verify", async (request, reply) => {
    const { userId, embedding } = request.body as { userId?: string; embedding?: number[] };
    if (!userId || !embedding) return reply.status(400).send({ error: "userId and embedding required" });
    const user = await store.getById(userId);
    if (!user?.faceEmbedding) return reply.status(404).send({ error: "No face enrolled" });

    const incoming = preciseEmbedding(embedding);
    const distance = euclideanDistance(user.faceEmbedding, incoming);
    const match = distance <= MATCH_THRESHOLD;

    if (!match) return reply.status(403).send({ match: false, distance: Math.round(distance * 1000) / 1000, threshold: MATCH_THRESHOLD, verdict: "FAIL" });
    return { match: true, distance: Math.round(distance * 1000) / 1000, threshold: MATCH_THRESHOLD, verdict: "PASS" };
  });

  /* ── Verify payment (mock) ── */

  app.post("/payment/verify", async (request) => {
    const { transactionId, senderPhone } = request.body as { transactionId?: string; senderPhone?: string };
    const sender = senderPhone ? await store.getByPhone(senderPhone) : null;

    if (sender) {
      const tx = sender.transactions.find((t) => t.id === transactionId);
      if (tx) return { verified: true, transaction: tx, sender: sanitize(sender) };
      const fakeTx = sender.transactions.find((t) => t.status === "fake");
      if (fakeTx) return { verified: false, warning: "FAKE PAYMENT — this user has flagged transactions", sender: sanitize(sender) };
    }

    return { verified: false, warning: "Transaction not found in network. Possible fake confirmation screenshot." };
  });

  /* ── Revoke + recover ── */

  app.post("/identity/revoke", async (request, reply) => {
    const { userId } = request.body as { userId?: string };
    if (!userId) return reply.status(400).send({ error: "userId required" });
    const user = await store.getById(userId);
    if (!user) return reply.status(404).send({ error: "User not found" });

    await store.updateUser(userId, { revoked: true, revokedAt: new Date().toISOString(), trustScore: 0, trustLevel: "UNVERIFIED" });
    const updated = await store.getById(userId);
    return { ok: true, message: "Identity revoked. Account locked.", user: sanitize(updated) };
  });

  app.post("/identity/recover", async (request, reply) => {
    const { userId } = request.body as { userId?: string };
    if (!userId) return reply.status(400).send({ error: "userId required" });
    const user = await store.getById(userId);
    if (!user) return reply.status(404).send({ error: "User not found" });

    const t = store.computeTrust({ ...user, revoked: false, faceEmbedding: null, faceHash: null });
    await store.updateUser(userId, {
      revoked: false, revokedAt: null,
      faceEmbedding: null, faceHash: null, faceEnrolledAt: null,
      trustScore: t.score, trustLevel: t.level,
    });
    const updated = await store.getById(userId);
    return { ok: true, message: "Account recovered. Re-enroll face to restore trust.", user: sanitize(updated) };
  });

  /* ── Gov ID upload ── */

  app.post("/govid/upload", async (request, reply) => {
    const { userId, image } = request.body as { userId?: string; image?: string };
    if (!userId || !image) return reply.status(400).send({ error: "userId and image required" });
    const user = await store.getById(userId);
    if (!user) return reply.status(404).send({ error: "User not found" });

    const t = store.computeTrust({ ...user, govIdImage: image.slice(0, 5000) });
    await store.updateUser(userId, {
      govIdImage: image.slice(0, 5000),
      govIdUploadedAt: new Date().toISOString(),
      trustScore: t.score, trustLevel: t.level,
    });
    const updated = await store.getById(userId);
    return { ok: true, user: sanitize(updated) };
  });

  /* ── Complete onboarding ── */

  app.post("/onboarding/complete", async (request, reply) => {
    const { userId } = request.body as { userId?: string };
    if (!userId) return reply.status(400).send({ error: "userId required" });
    const user = await store.getById(userId);
    if (!user) return reply.status(404).send({ error: "User not found" });

    const t = store.computeTrust({ ...user, onboarded: true, verified: true });
    await store.updateUser(userId, { onboarded: true, verified: true, trustScore: t.score, trustLevel: t.level });
    const updated = await store.getById(userId);
    return { ok: true, user: sanitize(updated) };
  });

  /* ── Public verify page data ── */

  app.get("/verify/:userId", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const user = await store.getById(userId);
    if (!user) return reply.status(404).send({ error: "User not found" });
    return {
      id: user.id, name: user.name,
      phone: user.phone.replace(/(\d{3})\d{4}(\d{3})/, "$1****$2"),
      verified: user.verified, faceEnrolled: Boolean(user.faceHash),
      govIdUploaded: Boolean(user.govIdImage),
      trustScore: user.trustScore, trustLevel: user.trustLevel,
      isAgent: user.isAgent, revoked: user.revoked, memberSince: user.createdAt,
    };
  });

  /* ── Demo helpers ── */

  app.get("/demo/users", async () => {
    const users = await store.allUsers();
    return { users: users.map(sanitize) };
  });

  app.post("/demo/seed", async () => {
    const count = await store.seedDemoUsers();
    return { ok: true, seeded: count };
  });

  app.post("/demo/verify-toggle", async (request) => {
    const { userId, verified } = request.body as { userId?: string; verified?: boolean };
    const user = userId ? await store.getById(userId) : null;
    if (!user) return { error: "not found" };
    const t = store.computeTrust({ ...user, verified: Boolean(verified) });
    await store.updateUser(userId!, { verified: Boolean(verified), trustScore: t.score, trustLevel: t.level });
    const updated = await store.getById(userId!);
    return { user: sanitize(updated) };
  });

  await app.listen({ port: PORT, host: "0.0.0.0" });
  app.log.info(`API on :${PORT}`);
}

function sanitize(u: AppUser | null) {
  if (!u) return null;
  return {
    id: u.id, phone: u.phone, name: u.name, verified: u.verified,
    faceHash: u.faceHash, faceEnrolledAt: u.faceEnrolledAt,
    govIdUploaded: Boolean(u.govIdImage), govIdUploadedAt: u.govIdUploadedAt,
    onboarded: u.onboarded, balance: u.balance,
    trustScore: u.trustScore, trustLevel: u.trustLevel,
    isAgent: u.isAgent, revoked: u.revoked, revokedAt: u.revokedAt,
    createdAt: u.createdAt,
    transactionCount: (u.transactions ?? []).length,
    transactions: (u.transactions ?? []).slice(-10).reverse(),
  };
}

main().catch((err) => { console.error(err); process.exit(1); });
