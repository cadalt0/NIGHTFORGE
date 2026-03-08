# `nightforge ps`

`ps` is the shorthand alias for `proof-server`.

## Start proof server

```bash
npx nightforge ps
```

Sample output:

```text
╔══════════════════════════════════════════════════════════════╗
║ Midnight Proof Server                                        ║
╚══════════════════════════════════════════════════════════════╝

ℹ Checking Docker...
✓ Proof server running on http://127.0.0.1:6300
```

## Stop proof server

```bash
npx nightforge ps --stop
```

## Set version/port

```bash
npx nightforge ps --version 7.0.0 --port 6300
```
