# `nightforge proof-server`

Manage the local Midnight proof server.

## Syntax

```bash
npx nightforge proof-server [options]
```

## Options

- `-s, --stop`: stop proof server process
- `-v, --version <version>`: Docker image tag (default `7.0.0`)
- `-p, --port <port>`: local port (default `6300`)

## Start server

```bash
npx nightforge proof-server
# shorthand
npx nightforge ps
```

### Sample output

```text
╔══════════════════════════════════════════════════════════════╗
║ Midnight Proof Server                                        ║
╚══════════════════════════════════════════════════════════════╝

ℹ Checking Docker...
ℹ Starting proof server on port 6300...
✓ Proof server running on http://127.0.0.1:6300
ℹ Press Ctrl+C to stop
```

## Stop server

```bash
npx nightforge proof-server --stop
# shorthand
npx nightforge ps --stop
```

## Runtime state file

When running, Nightforge writes `proof-server-status.json` with running/ready status.

## Typical flow

```bash
npx nightforge proof-server
npx nightforge deploy --network preprod
```

## Troubleshooting

- Ensure Docker is installed and running.
- If port conflict occurs, stop old container/process and start again.
