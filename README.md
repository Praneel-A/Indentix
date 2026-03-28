# Indentix prototype

Portable trust layer prototype: **Polygon Amoy** smart contracts, **SIWE** auth, **KYC/CDD/EDD** orchestration with a **BullMQ** relayer, and a **Vite + wagmi** web app.

## Repo layout

| Path | Purpose |
|------|---------|
| `contracts/` | `IdentityRegistry`, `AttestationHub` (Foundry) |
| `apps/api/` | Fastify API, Prisma, Redis, webhooks, chain worker |
| `apps/web/` | Wallet, SIWE, onboarding, mock KYC, read attestation |

## Prerequisites

- Node 20+
- Docker (for Postgres + Redis)
- [Foundry](https://book.getfoundry.sh/) (optional, for `forge build`)

## Quick start

### 1. Infra

```bash
docker compose up -d
```

### 2. Database

```bash
cp apps/api/.env.example apps/api/.env
# Edit RELAYER_PRIVATE_KEY and ATTESTATION_HUB_ADDRESS after deploy
cd apps/api && npx prisma db push
```

### 3. Contracts (Polygon Amoy)

Deploy `AttestationHub` with constructor `(admin, issuer)`. For demos, use the same address as admin and set `issuer` to your **backend relayer** address (derived from `RELAYER_PRIVATE_KEY`).

```bash
cd contracts && forge build
# See contracts/README.md for forge create examples
```

Put the deployed `AttestationHub` address in `apps/api/.env` and `apps/web/.env`.

### 4. API

```bash
cd apps/api && npm run dev
```

### 5. Web

```bash
cp apps/web/.env.example apps/web/.env
# Set VITE_ATTESTATION_HUB_ADDRESS
cd apps/web && npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Connect MetaMask on **Polygon Amoy** (chain id `80002`), sign in with SIWE, start onboarding, then **Mock approve** (or call `POST /webhooks/kyc` with `X-Webhook-Secret` if set).

## Flow

1. User connects wallet and signs **SIWE** (`/auth/nonce`, `/auth/verify`).
2. **Start KYC session** creates an `Applicant` with an external id (mock provider).
3. Webhook or **`/dev/mock-kyc`** (non-production or `ALLOW_DEV_MOCK=true`) runs **CDD** (`assessCdd`) and optional **EDD** (high-risk countries).
4. Relayer enqueues **`setAttestation`** on `AttestationHub` for `subjectId = keccak256("indentix:amoy:" + wallet)`.

## Scripts (root)

- `npm run dev:api` — API
- `npm run dev:web` — Web
- `npm run db:up` / `npm run db:down` — Docker Postgres/Redis

## Compliance note

This is a **prototype**. Production deployments need legal review for KYC/biometrics, issuer agreements, and data retention.
