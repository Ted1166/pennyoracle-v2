# [App Name]

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

[Brief description of what the app does and its primary use case]

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```

## Deployments
- PennyOracle on Arc Testnet: 0x47c8246e21cb1a22e05825e3218b9540e6c3fa25 (USDC 0x3600000000000000000000000000000000000000, oracle 0xEe49EF7B335DdEc8dc7322fF06c57411DC2BD2df, refundTimeout 300s). Owner is the platform deployer wallet.

## Backend
- backend/ is a separate Node project (run with tsx, SQLite via better-sqlite3). Config comes only from backend/.env (see backend/.env.example). Never commit .env files or keys.
- Tests: cd backend && bun run test (integration tests need anvil and contracts/out built).
- Frontend reaches it through the Vite proxy: VITE_BACKEND_URL=/api.
