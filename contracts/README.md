# Indentix contracts (Polygon Amoy)

## Contracts

- `IdentityRegistry` — `linkWallet(bytes32 didHash)` once per wallet.
- `AttestationHub` — issuer sets `subjectId` attestations (KYC level, risk tier, provider hash); public read.

## Build

Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then:

```bash
cd contracts
forge build
```

## Deploy (example)

Set `PRIVATE_KEY` and `AMOY_RPC_URL` (e.g. Alchemy/Infura Polygon Amoy).

```bash
forge create src/IdentityRegistry.sol:IdentityRegistry --rpc-url $AMOY_RPC_URL --private-key $PRIVATE_KEY
forge create src/AttestationHub.sol:AttestationHub --rpc-url $AMOY_RPC_URL --private-key $PRIVATE_KEY --constructor-args $DEPLOYER $ISSUER
```

`AttestationHub` constructor: `(admin, issuer)`. Use the same hot wallet as issuer for prototypes, or set `ISSUER` to your backend relayer address.

Record addresses in `apps/api/.env` and `apps/web/.env`.
