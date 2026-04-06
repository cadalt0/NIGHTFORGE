# `nightforge init`

Initialize a new Midnight project scaffold.

## Syntax

```bash
npx nightforge init [project-name] [options]
```

## Options

- `-t, --template <name>`: template name (`default`, `token`, `nft`)
- `--no-install`: skip automatic `npm install`

## Examples

### Create with explicit project name

```bash
npx nightforge init token-app
cd token-app
```

### Interactive mode (no name passed)

```text
npx nightforge init

╔══════════════════════════════════════════════════════════════╗
║ Initialize Midnight Project                                  ║
╚══════════════════════════════════════════════════════════════╝

─── Project Setup ──────────────────────────────────────────

✨ Let's create your Midnight app.
Pick a project name (letters, numbers, - and _).

? 🚀 Project name: my-midnight-app
✔ Project scaffold ready: my-midnight-app
✔ Dependencies installed

─── Project Created! ───────────────────────────────────────
```

## Generated files

- `midnight.config.js` (auto-created)
- `contracts/example.compact`
- `scripts/`
- `package.json`
- `.gitignore`

When auto-install is enabled (default), Nightforge also runs walletsync initialization:

- `midnightwalletsync.config.json`
- `.env.example`
- `.env` (if missing)

Generated project scripts also include:

- `sync:init`
- `sync`
- `sync:status`

