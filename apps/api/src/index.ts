import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { env } from "./env.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerMeRoutes } from "./routes/me.js";
import { registerOnboardingRoutes } from "./routes/onboarding.js";
import { registerWebhookRoutes } from "./routes/webhooks.js";
import { registerDevRoutes } from "./routes/dev.js";
import { registerFaceRoutes } from "./routes/face.js";
import { registerLookupRoutes } from "./routes/lookup.js";
import { registerRevokeRoutes } from "./routes/revoke.js";
import { startChainWorker } from "./lib/queue.js";

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()),
    credentials: true,
  });

  await app.register(jwt, {
    secret: env.JWT_SECRET,
  });

  app.decorate(
    "authenticate",
    async function (request, reply) {
      try {
        await request.jwtVerify();
      } catch {
        return reply.status(401).send({ error: "Unauthorized" });
      }
    },
  );

  app.get("/health", async () => ({
    ok: true,
    chainId: env.CHAIN_ID,
    attestationHub: env.ATTESTATION_HUB_ADDRESS,
  }));

  await registerAuthRoutes(app);
  await registerMeRoutes(app);
  await registerOnboardingRoutes(app);
  await registerWebhookRoutes(app);
  await registerDevRoutes(app);
  await registerFaceRoutes(app);
  await registerLookupRoutes(app);
  await registerRevokeRoutes(app);

  startChainWorker();

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info(`API listening on :${env.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
