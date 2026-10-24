# PennyOracle

A pay-per-question oracle with escrow for Arc. Asking a question costs 0.01 USDC. The payment is held in escrow until the oracle posts an answer hash, at which point it becomes revenue for the operator. If no answer arrives before the timeout, the asker can reclaim the payment. The web app lets you connect a wallet, ask a question, follow the public feed and your own history, check each answer against its onchain hash, and claim refunds.

Built with [Arc Studio](https://studio.arc.io)

## Tech stack

- Solidity (Foundry, OpenZeppelin)
- Vite, React, TypeScript, Tailwind CSS
- wagmi, viem, RainbowKit
- Oracle backend: Node, TypeScript, Express, viem, better-sqlite3

## Development

Prerequisites: bun and Foundry.

Install dependencies:

```
bun install
```

Environment variables (copy `.env.example` to `.env`):

- `VITE_CHAIN_ID`: chain to use. 5042002 for Arc Testnet, 5042 for Arc mainnet.
- `VITE_RPC_URL`: JSON-RPC endpoint for that chain.
- `VITE_CONTRACT_ADDRESS`: deployed PennyOracle address.
- `VITE_USDC_ADDRESS`: USDC token address (ERC-20, 6 decimals).
- `VITE_BACKEND_URL`: base URL of the HTTP backend serving `GET /feed` and `GET /history/:address`.
- `VITE_WALLETCONNECT_PROJECT_ID`: WalletConnect project id. Optional; without it only browser and Coinbase wallets are offered.

Run the app:

```
bun run dev
```

Check lint and types:

```
bun run check
```

Oracle backend (in `backend/`): it watches the contract for new questions, writes each answer with the Anthropic API, posts the answer hash onchain, and serves the feed to the app.

```
cd backend
bun install
cp .env.example .env
bun run start
bun run test
```

Backend environment variables (set in `backend/.env`, never commit it):

- `ARC_RPC_URL`: JSON-RPC endpoint of the chain.
- `CHAIN_ID`: chain id, checked against the RPC at startup.
- `CONTRACT_ADDRESS`: deployed PennyOracle address.
- `ORACLE_PRIVATE_KEY`: private key of the wallet set as the contract oracle.
- `ANTHROPIC_API_KEY`: Anthropic API key.
- `ANTHROPIC_MODEL`: Anthropic model name to use.
- `PORT`: HTTP port. Defaults to 3001.
- `DB_PATH`: SQLite file path. Defaults to `./data/oracle.db`.

To use it from the preview, set `VITE_BACKEND_URL=/api` (the dev server proxies `/api` to port 3001).

Install the contract dependencies. OpenZeppelin comes from `bun install` (see `remappings.txt`); Foundry's test library is installed with forge:

```
forge install foundry-rs/forge-std
```

If you prefer to take OpenZeppelin from forge as well, install it and point the `@openzeppelin/contracts/` entry in `remappings.txt` at `lib/openzeppelin-contracts/contracts/`:

```
forge install OpenZeppelin/openzeppelin-contracts
```

Build and test the contracts:

```
forge build
forge test
```

The contract lives in `contracts/PennyOracle.sol` and the tests in `contracts/test/`.

## Team

- Ted Adams
- Felix Awere
