# `nightforge wallet`

Manage Midnight wallets with secure storage and multi-wallet support.

## Overview

Wallets are stored in `~/.nightforge/wallets/` as individual JSON files. Each wallet has a unique name with address suffix (e.g., `my-wallet-a1b2c`). You can create multiple wallets and switch between them.

## Commands

- `wallet` - Interactive wallet manager
- `wallet create` - Create a new wallet
- `wallet restore` - Restore wallet from seed
- `wallet list` - List all stored wallets
- `wallet use <name>` - Set active wallet
- `wallet balance` - Check wallet balance
- `wallet dust` - Convert tNight to DUST tokens
- `wallet remove` - Remove a wallet

## Interactive Mode

```bash
npx nightforge wallet
```

Opens an interactive menu to manage wallets. Shows all available actions based on your wallet collection.

## Create Wallet

```bash
npx nightforge wallet create [options]
```

Creates a new wallet with auto-generated name or custom name.

**Options:**
- `-n, --network <network>` - Network to use (default: `preprod`)
- `--name <name>` - Custom base name (final name includes address suffix)

**Examples:**

```bash
# Auto-generated name
npx nightforge wallet create

# Custom name
npx nightforge wallet create --name my-main
```

**Output:**
```text
✓ Wallet created successfully!

════════════════════════════════════════════════════════════════
  Name:    my-main-a1b2c
  Address: mn_addr_preprod1...
  Network: preprod
════════════════════════════════════════════════════════════════

⚠️  SAVE THIS SEED (keep it secret!):

┌────────────────────────────────────────────────────────────┐
│  594c07d4f5c1d09ff8f0697a8b97746df4a06bbd1216f0ffb1275...  │
└────────────────────────────────────────────────────────────┘

✓ Active wallet: my-main-a1b2c
✓ Wallet saved to: ~/.nightforge/wallets/my-main-a1b2c.json
```

## Restore Wallet

```bash
npx nightforge wallet restore [options]
```

Restores a wallet from 64-character hex seed.

**Options:**
- `-n, --network <network>` - Network to use (default: `preprod`)
- `--name <name>` - Custom base name

**Example:**

```bash
npx nightforge wallet restore --name recovered
```

You will be prompted to enter your seed phrase.

## List Wallets

```bash
npx nightforge wallet list
```

Shows all stored wallets with active wallet indicator.

**Output:**
```text
Stored wallets:

  - my-main-a1b2c (active)
  - backup-wallet-d3e4f
  - test-wallet-g5h6i
```

## Switch Active Wallet

```bash
npx nightforge wallet use <name>
```

Sets the specified wallet as active. The active wallet is used by default in deploy and other commands.

**Example:**

```bash
npx nightforge wallet use backup-wallet-d3e4f
```

## Check Balance

```bash
npx nightforge wallet balance [options]
```

Displays wallet balance and DUST tokens.

**Options:**
- `-n, --network <network>` - Network to check (default: `preprod`)
- `--name <name>` - Wallet name (defaults to active wallet)

**Example:**

```bash
# Check active wallet
npx nightforge wallet balance

# Check specific wallet
npx nightforge wallet balance --name my-main-a1b2c
```

**Output:**
```text
════════════════════════════════════════════════════════════════
  Name:    my-main-a1b2c
  Address: mn_addr_preprod1...
  Network: preprod
  Balance: 12.345678 tNight
  DUST:    0.000000000000000
════════════════════════════════════════════════════════════════
```

## Convert to DUST

```bash
npx nightforge wallet dust [options]
```

Registers tNight for DUST generation (required for contract deployment).

**Options:**
- `-n, --network <network>` - Network to use (default: `preprod`)
- `--name <name>` - Wallet name (defaults to active wallet)

**Example:**

```bash
npx nightforge wallet dust
```

**Output:**
```text
✓ Balance found: 12.345678 tNight
ℹ Registering for DUST generation...
✓ DUST tokens ready!
```

## Remove Wallet

```bash
npx nightforge wallet remove [options]
```

Removes a stored wallet file. If active wallet is removed, automatically switches to another available wallet.

**Options:**
- `--name <name>` - Wallet name (defaults to active wallet)

**Example:**

```bash
npx nightforge wallet remove --name old-wallet-x1y2z
```

## Wallet Storage

- **Location:** `~/.nightforge/wallets/`
- **Format:** One JSON file per wallet
- **Naming:** `<custom-name>-<last5-of-address>.json`
- **Active wallet:** Tracked in `~/.nightforge/config.json`
- **Permissions:** Files created with `600` (owner read/write only)

## Using Wallets with Deploy

Deploy command automatically uses the active wallet:

```bash
# Uses active wallet
npx nightforge deploy

# Use specific wallet
npx nightforge deploy --wallet my-main-a1b2c

# Override with private key
npx nightforge deploy --private-key <seed>
```

## Security Notes

- Wallets are stored outside project directory (`~/.nightforge/`)
- Never commit wallet files to version control
- Keep seeds secure and private
- Use different wallets for different environments
- File permissions restrict access to owner only

## Troubleshooting

**"No active wallet found"**
- Create a wallet: `npx nightforge wallet create`
- Or set active: `npx nightforge wallet use <name>`

**"Wallet already exists"**
- Each wallet name must be unique
- Use a different name or remove the existing wallet first

**Fund your wallet:**
- Visit: https://faucet.preprod.midnight.network/
- Use your wallet address from `wallet list` or `wallet balance`

