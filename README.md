# Indentix — Trusted Mobile Payments for Tanzania

> Stop fraud before money moves. Face verification, trust scores, and instant identity for mobile payments.

## The Problem

Tanzania's mobile money ecosystem (M-Pesa, Tigo Pesa) loses billions to:
1. **Fake payment screenshots** — scammers show fabricated confirmations
2. **Fake agents** — impersonators posing as licensed M-Pesa agents
3. **SIM swap / phone theft** — stolen identities used for fraud

## The Solution

Indentix adds a **trust layer** on top of existing mobile payment systems:

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│  Face ID    │────▶│  Trust Score │────▶│  Safe Payment  │
│  (webcam)   │     │  (0-100)     │     │  (verified)    │
└─────────────┘     └──────────────┘     └────────────────┘
        │                   │                      │
   5 samples           4 signals              QR verify
   averaged         face + KYC +            agent + user
   dedup check     agent + history         identity check
```

## Features

| Feature | What it does |
|---------|-------------|
| **Face ID** | Webcam enrollment (5 samples, averaged), duplicate detection, 1:1 verification |
| **Trust Score** | 0–100 ring from 4 signals: face, verification status, agent license, history |
| **Send Money** | Look up recipient trust BEFORE paying, verify payment confirmations |
| **Scan QR** | Verify any agent or user — instantly see if they're trusted or flagged |
| **Emergency Lock** | One-tap identity revocation + guided recovery |
| **Demo Mode** | Pre-loaded users: trusted vendor, verified buyer, scammer, fake agent, real agent |

## Quick Start (1 command)

```bash
npm install && npm run dev:api & npm run dev:web
```

Then open **http://localhost:5173**.

No Docker. No blockchain. No environment variables. Just `npm install` and go.

## Demo Script (2 minutes)

1. **Open app** → click **Demo mode** → see 5 pre-loaded Tanzanian users
2. **Login as Mama Anna** (trusted vendor, score 92)
3. **Send Money** → enter scammer phone `+255700000000` → see RED warning
4. **Send Money** → enter Juma's phone `+255787654321` → see GREEN trust, send safely
5. **Scan QR** → tap "Fake Agent" → see UNVERIFIED AGENT warning
6. **Scan QR** → tap "Real Agent" → see TRUSTED Licensed Agent
7. **Enroll Face** → capture with webcam → trust score jumps
8. **Emergency** → lock identity → account revoked → recover → re-enroll

## Architecture

```
apps/
  api/          Fastify server (in-memory store, no database)
    src/
      index.ts    All endpoints in one file
      store.ts    In-memory user store with demo data
      lib/face.ts Face comparison (Euclidean distance)
  web/          Vite + React + shadcn/ui + Tailwind
    src/
      App.tsx     Mobile-first UI with 6 screens
      components/
        FaceScanner.tsx   CLEAR-style face enrollment/verification
        ui/               shadcn components (Button, Card, Badge, etc.)
```

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/login` | Login by phone number |
| GET | `/user/:id` | Get user profile |
| GET | `/lookup/phone/:phone` | Look up user by phone |
| POST | `/face/enroll` | Enroll face (5 samples) |
| POST | `/face/verify` | Verify face 1:1 |
| POST | `/payment/verify` | Check if payment is real |
| POST | `/identity/revoke` | Lock identity |
| POST | `/identity/recover` | Recover identity |
| GET | `/demo/users` | List all demo users |

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS 4, shadcn/ui, Lucide icons, face-api.js, qrcode.react
- **Backend**: Fastify (Node.js), in-memory store, zero external dependencies
- **Face ML**: @vladmandic/face-api (SSD MobileNet + 68-landmark + 128-d descriptor)

## Team

**Team Vajran** · Built for Tanzania fintech hackathon
