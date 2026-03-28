import type { FastifyInstance } from "fastify";
import { getAddress, isAddress, verifyMessage } from "viem";
import { SiweMessage } from "siwe";
import { randomBytes } from "crypto";
import { prisma } from "../lib/prisma.js";
import { clearNonce, readNonce, saveNonce } from "../lib/nonceStore.js";
import { env } from "../env.js";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.get("/auth/nonce", async (request, reply) => {
    const q = request.query as { address?: string };
    if (!q.address || !isAddress(q.address)) {
      return reply.status(400).send({ error: "Invalid address" });
    }
    const address = getAddress(q.address);
    const nonce = randomBytes(16).toString("hex");
    await saveNonce(address, nonce);
    return { nonce };
  });

  app.post("/auth/verify", async (request, reply) => {
    const body = request.body as { message?: string; signature?: string };
    if (!body.message || !body.signature) {
      return reply.status(400).send({ error: "message and signature required" });
    }

    let siwe: SiweMessage;
    try {
      siwe = new SiweMessage(body.message);
    } catch {
      return reply.status(400).send({ error: "Invalid SIWE message" });
    }

    const address = getAddress(siwe.address);

    const stored = await readNonce(address);
    if (!stored || stored !== siwe.nonce) {
      return reply.status(401).send({ error: "Invalid or expired nonce" });
    }

    if (Number(siwe.chainId) !== env.CHAIN_ID) {
      return reply.status(400).send({ error: `Wrong chain (expected ${env.CHAIN_ID})` });
    }

    /** Use viem instead of siwe.verify — avoids EIP-55 vs lowercase address mismatches inside siwe. */
    let signatureValid = false;
    try {
      signatureValid = await verifyMessage({
        address,
        message: body.message,
        signature: body.signature as `0x${string}`,
      });
    } catch {
      signatureValid = false;
    }

    if (!signatureValid) {
      return reply.status(401).send({ error: "Invalid signature" });
    }

    await clearNonce(address);

    const user = await prisma.user.upsert({
      where: { walletAddress: address },
      create: { walletAddress: address },
      update: {},
    });

    const token = await reply.jwtSign({
      sub: user.id,
      wallet: user.walletAddress,
    });

    return { token, user: { id: user.id, wallet: user.walletAddress } };
  });
}
