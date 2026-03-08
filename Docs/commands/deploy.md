# `nightforge deploy`

Deploy compiled contracts to the selected network.

## Syntax

```bash
npx nightforge deploy [contract] [options]
```

## Options

- `-n, --network <network>`: target network (default `preprod`)
- `-p, --private-key <key>`: deployment seed
- `-s, --script <path>`: custom deploy script
- `--auto`: wallet/funding/DUST/proof-server orchestration mode

## Standard deploy

```bash
npx nightforge deploy <contract-name> --network preprod
```

Example:

```bash
npx nightforge deploy example --network preprod
```

Deploy without passing a contract name:

```bash
npx nightforge deploy
```

Selection behavior when no contract name is passed:

1. If exactly one compiled artifact exists in `contracts/managed`, deploy uses it.
2. If multiple compiled artifacts exist, deploy prompts for selection.

Example prompt:

```text
Multiple compiled artifacts found:
	1. MessageModule
	2. example

Select contract to deploy (number or name): 2
```

Sample output:

```text
╔══════════════════════════════════════════════════════════════╗
║ Nightforge - Contract Deployment                             ║
╚══════════════════════════════════════════════════════════════╝

ℹ Using local proof server: http://127.0.0.1:6300
─── Step 1: Loading Contract ───────────────────────────────
✓ Loaded contract: example

─── Step 2: Wallet Setup ───────────────────────────────────
✓ Wallet: m1abc...xyz
ℹ Balance: 12 tNight

─── Step 3: DUST Token Setup ───────────────────────────────
─── Step 4: Deploying Contract ─────────────────────────────
✓ Contract deployed successfully!
✓ Saved deployment info to deployment.json
```

## Auto deploy (recommended)

```bash
npx nightforge deploy <contract-name> --auto --network preprod
```

Quick default auto example:

```bash
npx nightforge deploy --auto
```

Auto mode handles:

1. Wallet auto-create/load
2. Funding wait
3. DUST registration/conversion
4. Proof-server readiness wait
5. Deployment

Sample output:

```text
═══════════════════════════════════════════════════════════════
	🚀 Nightforge - Auto Deployment Mode
═══════════════════════════════════════════════════════════════

✓ Wallet loaded: m1abc...xyz
💰 Waiting for tNight funds...
✓ Funds detected! Balance: 12.345678 tNight
🔄 Converting tNight to DUST...
✓ DUST tokens ready!
🔧 Waiting for proof server...
✓ Proof server ready! http://127.0.0.1:6300
═══════════════════════════════════════════════════════════════
	📦 Starting Contract Deployment
═══════════════════════════════════════════════════════════════
✓ Contract deployed successfully!
✓ Saved deployment info to deployment.json
```


## Seed options

```bash
npx nightforge deploy example --network preprod --private-key <seed>
```

Resolution order:

1. `--private-key`
2. `MIDNIGHT_PRIVATE_KEY`
3. `wallet.json`

## Requirements

- Contract must be compiled first
- Proof server must be running/ready
- If multiple compiled artifacts exist and no contract name is passed, select one at prompt
