# Nightforge 🔨

Nightforge is a development environment to compile, deploy, and operate Midnight contracts.

It gives Midnight developers a streamlined workflow with built-in project scaffolding, wallet lifecycle tools, proof-server orchestration, and deployment.

---


## 📦 Installation

### Local install

```bash
npm install nightforge
```

Run with:

```bash
npx nightforge --help
```

---

## 🚀 Quick Start

```bash
# 1) Create project
npx nightforge init my-midnight-app

# 2) Enter project
cd my-midnight-app

# 3) Compile contract
npx nightforge compile

# 4) Create wallet
npx nightforge wallet create 

# 5) Start proof server
npx nightforge proof-server start

# 6) Deploy
npx nightforge deploy --network preprod
```

---

## 🧠 Auto Mode (Recommended)

`deploy --auto` can orchestrate the full flow:

1. Auto-create wallet if missing
2. Wait for tNIGHT funding
3. Convert/register to DUST automatically
4. Wait for proof server status file readiness
5. Deploy contract

```bash
npx nightforge deploy --auto --network preprod
```

---

## 🗂️ Core Runtime Files

Nightforge uses local state files in your project root:

- `wallet.json` → persisted wallet seed/address/network
- `proof-server-status.json` → proof server running/ready URL state
- `deployment.json` → deployment metadata output



---

## 📚 Commands

```bash
npx nightforge init <project-name>          # Create project
npx nightforge compile                       # Compile contracts
npx nightforge wallet create                 # Create wallet
npx nightforge wallet restore                # Restore wallet
npx nightforge wallet balance                # Check balance
npx nightforge wallet dust                   # Convert to DUST
npx nightforge proof-server start            # Start proof server
npx nightforge ps                            # Shorthand for proof-server
npx nightforge deploy <contract>             # Deploy contract
npx nightforge deploy <contract> --auto      # Auto deploy (with wallet/DUST/server wait)
npx nightforge clean                         # Remove artifacts
```

Detailed guides:

- [Docs index](Docs/README.md)
- [Init guide](Docs/commands/init.md)
- [Compile guide](Docs/commands/compile.md)
- [Wallet guide](Docs/commands/wallet.md)
- [Proof-server guide](Docs/commands/proof-server.md)
- [PS alias guide](Docs/commands/ps.md)
- [Deploy guide](Docs/commands/deploy.md)
- [Clean guide](Docs/commands/clean.md)

---

## 🧪 Troubleshooting

### `Proof server is not running`

Start it first:

```bash
npx nightforge proof-server start
```

### `Contract not compiled`

Compile contracts first:

```bash
npx nightforge compile
```

### `No private key provided`

Create wallet or pass seed:

```bash
npx nightforge wallet create --network preprod
```

