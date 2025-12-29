# pNode Buyer Linkage Documentation

## Overview

This document explains how to link Devnet pNodes to their Mainnet buyer wallets.

## The Problem

- Nodes are registered on **Devnet** (Xandeum testnet)
- Purchases happen on **Mainnet** (Solana mainnet)
- No direct on-chain link between a node's pubkey and its buyer

## The Solution

The **buyer wallet is stored at offset 42** in the node's Registry PDA on Devnet.

### Registry PDA Structure (1040 bytes)

| Offset | Size | Content |
|--------|------|---------|
| 0-32 | 32 | Node pubkey |
| 32-42 | 10 | Flags/metadata |
| **42-74** | **32** | **Buyer wallet** |
| 74-1040 | 966 | Additional data |

### Program IDs

- **Devnet Program:** `6Bzz3KPvzQruqBg2vtsvkuitd6Qb4iCcr5DViifCwLsL`
- **Mainnet Program:** `CZ9bXL6D4uiLXGsSk5s8KAgTFEVp3gdpxPxTCrgm3VoL`

## Scripts

### 1. Extract Buyer Mappings

```bash
node extract-buyers-offset42.js
```

Outputs: `data/node-wallet-mappings.json` (286 entries)

### 2. Import to Database

```bash
npx tsx scripts/import-mappings.ts
```

Updates MongoDB with `managerWallet` field for each node.

## Key Files

| File | Purpose |
|------|---------|
| `extract-buyers-offset42.js` | Main extraction script |
| `data/node-wallet-mappings.json` | Cached mappings |
| `scripts/import-mappings.ts` | DB import script |

## Discovery Process

1. Analyzed `tmp/xandeum_repos/xandminerd/src/transactions.js`
2. Found Manager PDA derived from buyer wallet, not node
3. Parsed Registry PDA with known node-buyer pair
4. Binary searched for buyer offset → **offset 42**

## Integration

The extracted `managerWallet` is used in:
- `app/nodes/[id]/page.tsx` - Node details page
- `components/Header.tsx` - Manager count display
- `lib/context/NodesContext.tsx` - Manager count derivation
