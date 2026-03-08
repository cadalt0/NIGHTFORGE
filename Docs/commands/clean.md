# `nightforge clean`

Remove generated artifacts and temporary build outputs.

## Syntax

```bash
npx nightforge clean [options]
```

## Options

- `-a, --all`: clean everything including `node_modules`

## Example

```bash
npx nightforge clean
```

Sample output:

```text
╔══════════════════════════════════════════════════════════════╗
║ Clean Build Artifacts                                        ║
╚══════════════════════════════════════════════════════════════╝

ℹ Cleaning: managed
ℹ Cleaning: .cache
ℹ Cleaning: dist
✓ Cleaned 3 directory/directories
```

## When to use

- Before a fresh compile
- After changing compiler settings
- To reset generated output state

