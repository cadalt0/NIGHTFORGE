# `nightforge sync`

Run and manage walletsync (walletsync-first state service used by deploy and balance flows).

## Syntax

```bash
npx nightforge sync [options]
```

## Options

- `--init`: create walletsync files (`midnightwalletsync.config.json`, `.env.example`, and `.env` when missing)
- `--status`: show walletsync status/config paths
- `--balance [alias]`: read walletsync snapshot balance (default alias `n1`)
- `-p, --port <port>`: run sync server on custom port

## Examples

Initialize walletsync files:

```bash
npx nightforge sync --init
```

Start sync service:

```bash
npx nightforge sync
```

Start on custom port:

```bash
npx nightforge sync --port 9797
```

Check status:

```bash
npx nightforge sync --status
```

Read balance from snapshot:

```bash
npx nightforge sync --balance
npx nightforge sync --balance n2
```

## Notes

- `nightforge sync` persists selected port into `midnightwalletsync.config.json`.
- If `--port` is omitted, default `8787` is persisted.
- Ctrl+C stops sync cleanly and is treated as normal user stop.
- Deploy and wallet balance commands can consume this synced state for faster checks.
