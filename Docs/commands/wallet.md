# `nightforge wallet`

Manage wallet lifecycle for deployment and balance checks.

## Commands

- `wallet create`
- `wallet restore`
- `wallet balance`
- `wallet dust`
- `wallet remove`

## Create

```bash
npx nightforge wallet create
```

Creates a wallet and stores it in `wallet.json`.

Sample output:

```text
╔══════════════════════════════════════════════════════════════╗
║ Create New Wallet                                            ║
╚══════════════════════════════════════════════════════════════╝

✓ Wallet created successfully!
✓ Wallet saved to: /path/to/wallet.json
```

## Restore

```bash
npx nightforge wallet restore
```

Restores a wallet from seed/private key input.

You will be prompted for the 64-char hex seed.

## Check balance

```bash
npx nightforge wallet balance
```

Shows tNIGHT balance (formatted to human-readable units).

Sample output:

```text
╔══════════════════════════════════════════════════════════════╗
║ Wallet Balance                                               ║
╚══════════════════════════════════════════════════════════════╝

ℹ Loading wallet...
ℹ Syncing with network...
	Balance: 12.345678 tNight
	DUST:    0.000000000000000
```

## Convert/register DUST

```bash
npx nightforge wallet dust
```

Runs the DUST conversion/registration flow used by deploy.

Sample output:

```text
╔══════════════════════════════════════════════════════════════╗
║ Convert to DUST                                              ║
╚══════════════════════════════════════════════════════════════╝

ℹ Checking balance...
✓ Balance found: 12.345678 tNight
ℹ DUST not found. Registering automatically...
✓ DUST tokens ready!
```

## Remove local wallet file

```bash
npx nightforge wallet remove --path ./wallet.json
```

## Tips

- Keep `wallet.json` private.
- Default network is already set to `preprod` for all wallet commands.
