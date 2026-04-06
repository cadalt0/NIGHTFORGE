# Changelog

All notable changes to NightForge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.7-dev.2] - 2026-04-05

### 🌟 Major Upgrade: Sync-State Onchain Engine

NightForge now runs on a **walletsync-first onchain workflow**.

- **All deploy onchain actions are managed by synced state** where applicable.
- Readiness, DUST checks, and deploy submission now flow through walletsync by default.
- This removes repeated direct wallet bootstrapping in the primary path and makes deployment behavior more deterministic.

### ⚡ Performance Impact

- In synced/ready scenarios, the typical user path now moves from roughly **2–3 minutes** to around **3–10 seconds** for readiness + submission flow.
- Auto mode also avoids unnecessary steps when balance/DUST are already present.

### 🚀 Major Feature Highlights

#### 1) Walletsync-first deploy (default)

- `deploy` now uses synced wallet state for:
  - balance readiness
  - DUST readiness
  - contract deploy submission
- Better hard-fail gating for unmapped/unavailable/syncing states.

#### 2) Auto deploy upgraded (`AutoDeployer`)
File: `src/deployer/auto.ts`

- Added pre-check for compiled contract before running auto mode.
- Added combined `tNight` + `DUST` balance logic.
- Skips fund/conversion steps when already ready.
- Uses spinner helpers across wait/convert/deploy steps.
- Uses wallet base dir for proof server status file.
- Uses guarded shutdown checks (`shutdown()` checks instead of unconditional close behavior).

#### 3) Sync runtime reliability and control

- Added `nightforge sync --port <port>` support.
- Sync updates and persists active port in `midnightwalletsync.config.json`:
  - with `--port`: stores custom port
  - without `--port`: stores default `8787`
- Ctrl+C shutdown is now cleaner:
  - child signal forwarding
  - reduced orphan processes/port leaks
  - no fake startup failure messaging on user stop
- Runtime recovery improved with retry-oriented behavior for transient failures.

#### 4) Proof server alignment

- Proof server status lookup now uses wallet base dir.
- Runtime prefers local proof server when available.
- Deploy/proving configuration is aligned with local status source-of-truth.
- Added explicit deploy remote override:
  - `nightforge deploy ...` uses local proof-server checks (default behavior)
  - `nightforge deploy ... --remote <url>` skips local proof-server checks and targets the provided proof server URL directly
  - Same remote override behavior is supported in auto mode

### ✅ Backward Compatibility

- **Old method still exists** and can be used with `--legacy`.
- This allows fallback for debugging and gradual migration.

### 🛠️ Minor Updates (last)

#### Deployer and CLI UX polish

- `src/deployer/index.ts`: improved deploy progress UX and status path updates.
- `src/cli/commands/init.ts`: uses `startSpinner()`.
- `src/cli/commands/proof-server.ts`: Docker check spinner + wallet-base status location.
- `src/cli/commands/wallet.ts`: wraps wallet operations with `withSpinner()` where applicable.
- Improved readable balance formatting and clearer readiness/error messaging.

#### Metadata/version updates

- `package.json`: `0.0.6` → `0.0.7-dev.2`.
- `README.md`: minor wording update (“proof server”).
- `package-lock.json`: lockfile refreshed.
- `.gitignore`: added `node_modules/`.
- v2 branch includes generated `dist/` artifacts relative to main.

## [0.0.6] - 2026-03-10

### 🎯 Major Features

#### Multi-Wallet Management System
Complete overhaul of wallet management to support multiple named wallets with secure storage and seamless switching capabilities.

- **Persistent Storage Migration**: Wallets now stored in `~/.nightforge/wallets/` instead of project-local `wallet.json`
  - Eliminates accidental commits of sensitive wallet data
  - Enables wallet reuse across multiple projects
  - Provides centralized wallet management for developers
  - Files created with `600` permissions (owner read/write only)

- **Multiple Wallet Support**: Create and manage unlimited wallets simultaneously
  - Each wallet stored as individual JSON file: `<name>-<last5chars>.json`
  - Active wallet tracking via `~/.nightforge/config.json`
  - Seamless switching between wallets for different environments
  - No naming conflicts with address-based suffix system

- **Intelligent Wallet Naming**:
  - Auto-generated human-readable names using `@cadalt/random-name-generator`
  - Custom names via `--name` flag on create/restore
  - Format: `<base-name>-<last5-address-chars>` (e.g., `rose-truck-a1b2c`)
  - Unique identifier prevents wallet overwrites
  - Easy-to-remember names for quick identification

### ✨ New Commands

- **`wallet list`**: Display all stored wallets with active indicator
  ```bash
  npx nightforge wallet list
  # Shows:
  #   - my-main-a1b2c (active)
  #   - backup-wallet-d3e4f
  #   - test-wallet-g5h6i
  ```

- **`wallet use <name>`**: Switch active wallet for subsequent commands
  ```bash
  npx nightforge wallet use backup-wallet-d3e4f
  ```

### 🔧 Enhanced Commands

#### `wallet create`
- **Added**: `--name <name>` option for custom wallet names
- **Added**: Auto-generated names when `--name` not provided
- **Added**: Duplicate name protection (never overwrites existing wallets)
- **Changed**: Now saves to `~/.nightforge/wallets/` instead of `./wallet.json`
- **Changed**: Automatically sets newly created wallet as active
- **Performance**: Reduced execution time from ~5.5s to ~1.1s (5x faster)
  - Implemented immediate process termination after wallet creation
  - Eliminated unnecessary network connection cleanup delays

#### `wallet restore`
- **Added**: `--name <name>` option for custom wallet names
- **Added**: Auto-generated names when `--name` not provided
- **Added**: Duplicate name protection
- **Changed**: Now saves to `~/.nightforge/wallets/`
- **Changed**: Automatically sets restored wallet as active
- **Performance**: Reduced execution time by ~4 seconds

#### `wallet balance`
- **Added**: `--name <name>` option to check specific wallet
- **Changed**: Defaults to active wallet when `--name` not specified
- **Enhanced**: Displays wallet name and network in output

#### `wallet dust`
- **Added**: `--name <name>` option to convert DUST for specific wallet
- **Changed**: Defaults to active wallet when `--name` not specified

#### `wallet remove`
- **Added**: `--name <name>` option to remove specific wallet
- **Changed**: Defaults to active wallet when `--name` not specified
- **Added**: Auto-switch to another wallet when active wallet is removed
- **Added**: Confirmation of remaining wallet count after removal

### 🚀 Deploy Integration

#### Enhanced Wallet Resolution
The `deploy` command now supports multiple wallet sources with intelligent fallback:

1. **`--private-key <seed>`**: Direct private key (highest priority)
2. **`MIDNIGHT_PRIVATE_KEY` environment variable**: Environment-based key
3. **`--wallet <name>`**: Explicitly named stored wallet
4. **Active wallet**: Default stored wallet (lowest priority)

```bash
# Use active wallet (default)
npx nightforge deploy

# Use specific stored wallet
npx nightforge deploy --wallet my-main-a1b2c

# Override with private key
npx nightforge deploy --private-key <64-char-hex-seed>
```

#### Network Validation
- **Added**: Automatic network mismatch warning
- Warns when stored wallet network differs from deployment network
- Prevents accidental cross-network deployments

### 🐛 Bug Fixes

#### Critical Ledger Loading Fix
- **Fixed**: "Cannot read properties of undefined (reading 'fromSeed')" runtime error
- **Root Cause**: Legacy `@midnight-ntwrk/ledger` package loaded first, missing required wallet API exports
- **Solution**: Reversed module loading priority in `WalletManager`
  - Now attempts `@midnight-ntwrk/ledger-v7` first (complete API)
  - Falls back to `@midnight-ntwrk/ledger` only if v7 unavailable
- **Impact**: Eliminates wallet creation failures in projects with both ledger packages

#### Package Installation Robustness
- **Fixed**: WASM corruption from interrupted package installations
- **Improved**: Error messaging for missing Midnight SDK dependencies
- **Added**: Validation for required ledger package availability

### ⚡ Performance Improvements

- **Wallet Creation Speed**: 80% reduction in execution time (5.5s → 1.1s)
  - Implemented immediate process termination after file operations
  - Eliminated unnecessary WebSocket/HTTP connection cleanup
  - Background wallet sync no longer blocks command completion

- **Wallet Restoration Speed**: ~4 second reduction in execution time
  - Applied same optimization strategy as wallet creation
  - File I/O completes before forced exit

### 📦 Dependencies

#### Added
- **`@cadalt/random-name-generator@^1.0.0`**: Human-readable wallet name generation
  - Lightweight package (~6KB)
  - Generates memorable names like "rose-truck", "blue-mountain"
  - Used for auto-naming wallets when `--name` not provided

### 📚 Documentation

#### New Documentation
- **`Docs/commands/wallet.md`**: Complete rewrite for multi-wallet system
  - Comprehensive command reference for all wallet operations
  - Usage examples with expected output
  - Multi-wallet workflow guides
  - Security best practices
  - Troubleshooting section

#### Updated Documentation
- **`README.md`**: Updated with multi-wallet capabilities (if applicable)
- All wallet-related examples updated to reflect new storage location

### 🔄 Migration Guide

#### For Existing Users

If you have a `wallet.json` in your project directory:

1. **Manual Migration**:
   ```bash
   # Restore your existing wallet with a name
   npx nightforge wallet restore --name my-old-wallet --network preprod
   # Enter your seed from the old wallet.json
   
   # Remove old wallet file
   rm wallet.json
   ```

2. **Verify Migration**:
   ```bash
   npx nightforge wallet list
   # Should show your migrated wallet as active
   ```

3. **Update Deploy Scripts**:
   ```bash
   # Old approach (still works)
   npx nightforge deploy --private-key $MIDNIGHT_PRIVATE_KEY
   
   # New approach (recommended)
   npx nightforge deploy --wallet my-old-wallet
   # or simply
   npx nightforge deploy  # uses active wallet
   ```

### 🛡️ Security Enhancements

- **File Permissions**: Wallet files created with `600` (owner-only access)
- **Storage Isolation**: Wallets stored in user home directory, outside project tree
- **Duplicate Protection**: Prevents accidental wallet overwrites
- **Network Awareness**: Warns on network mismatches during deployment

### 🏗️ Architecture Changes

#### New Components
- **`src/wallet/storage.ts`**: Centralized wallet persistence layer
  - `WalletStorage` class for all file operations
  - Active wallet tracking and management
  - Wallet name generation and validation
  - Home directory resolution and path management

#### Modified Components
- **`src/wallet/manager.ts`**: Enhanced ledger module loading
- **`src/cli/commands/wallet.ts`**: Complete rewrite for multi-wallet support
- **`src/deployer/index.ts`**: Integrated with `WalletStorage`
- **`src/deployer/auto.ts`**: Uses `WalletStorage` for auto-deployment
- **`src/cli/commands/deploy.ts`**: Added `--wallet` option
- **`src/types/index.ts`**: Added `wallet?: string` to `DeployOptions`

#### Type Definitions
- **`src/types/cadalt-random-name-generator.d.ts`**: TypeScript definitions for name generator

### 🧪 Testing

- **`test-wallet-flow.sh`**: Comprehensive test suite for wallet operations
  - Tests wallet creation with custom and auto-generated names
  - Validates wallet listing and active indicators
  - Tests wallet switching functionality
  - Verifies duplicate protection
  - Tests wallet removal and auto-switch behavior
  - All tests passing (10/10 operations validated)

### 🔮 Technical Details

#### Wallet Storage Schema
```
~/.nightforge/
├── config.json              # Active wallet tracking
└── wallets/
    ├── rose-truck-a1b2c.json
    ├── blue-mountain-d3e4f.json
    └── my-custom-g5h6i.json
```

#### Config Schema
```json
{
  "activeWallet": "rose-truck-a1b2c"
}
```

#### Wallet File Schema
```json
{
  "name": "rose-truck-a1b2c",
  "address": "mn_addr_preprod1...",
  "network": "preprod",
  "seed": "594c07d4f5c1d09ff8f0697a..."
}
```

### 💡 Usage Examples

#### Multi-Wallet Workflow
```bash
# Create wallets for different purposes
npx nightforge wallet create --name dev-wallet --network preprod
npx nightforge wallet create --name staging-wallet --network preprod
npx nightforge wallet create --name prod-wallet --network mainnet

# List all wallets
npx nightforge wallet list

# Switch to staging
npx nightforge wallet use staging-wallet-d3e4f

# Deploy with active wallet
npx nightforge deploy

# Deploy with specific wallet
npx nightforge deploy --wallet prod-wallet-g5h6i --network mainnet
```

#### CI/CD Integration
```bash
# Option 1: Use environment variable (unchanged)
export MIDNIGHT_PRIVATE_KEY="your-64-char-hex-seed"
npx nightforge deploy

# Option 2: Create named wallet in CI
npx nightforge wallet restore --name ci-wallet --network preprod
# (Enter seed from secrets)
npx nightforge deploy --wallet ci-wallet-a1b2c
```

---

## [0.0.5] - 2026-03-09

### 🎯 Features

#### Initial Wallet Management
- **`wallet create`**: Create new wallet with seed generation
  - Generates 64-character hex seed
  - Displays wallet address and network
  - Saves to `wallet.json` in project directory
  - Includes funding instructions for preprod faucet

- **`wallet restore`**: Restore wallet from existing seed
  - Interactive seed input prompt
  - Validates seed format (64-character hex)
  - Saves to `wallet.json` in project directory

- **`wallet balance`**: Check wallet balance
  - Displays tNight balance in human-readable format
  - Shows DUST token balance
  - Syncs with Midnight network for real-time data

- **`wallet dust`**: Convert tNight to DUST tokens
  - Required for contract deployment gas
  - Automatic DUST registration if not found
  - Shows conversion status and confirmation

- **`wallet remove`**: Remove wallet file
  - `--path` option to specify wallet file location
  - Default removes `./wallet.json`

#### Deploy Command Wallet Integration
- **Private Key Support**: Direct private key via `--private-key` flag
- **Environment Variable**: `MIDNIGHT_PRIVATE_KEY` support
- **Wallet File**: Automatic loading from `wallet.json`
- **Auto-Deploy**: Automatic wallet creation for rapid prototyping

### 🏗️ Core Architecture

#### Wallet Manager (`src/wallet/manager.ts`)
- `WalletManager.create()`: Initializes wallet context with network configuration
- `WalletManager.deriveKeys()`: HD wallet key derivation from seed
- `WalletManager.generateSeed()`: Cryptographically secure seed generation
- Integration with Midnight SDK ledger packages

#### CLI Commands (`src/cli/commands/wallet.ts`)
- Interactive wallet command selection
- Network selection (preprod/devnet/mainnet)
- Formatted output with box drawing characters
- Error handling for common wallet operations

#### Deployment Integration
- `src/deployer/index.ts`: Wallet resolution and contract deployment
- `src/deployer/auto.ts`: Automatic wallet creation for development
- `src/cli/commands/deploy.ts`: CLI command definitions

### 📦 Dependencies

#### Midnight SDK Integration
- `@midnight-ntwrk/ledger@^4.0.0`: Wallet and transaction management
- `@midnight-ntwrk/compact-runtime@^0.7.3`: Contract runtime
- `@midnight-ntwrk/wallet-api@^7.1.3`: Wallet API abstractions
- `@midnight-ntwrk/midnight-js-types@^0.4.13`: Type definitions

#### Development Tools
- `typescript@5.0.4`: TypeScript compiler
- `@types/node@^20.0.0`: Node.js type definitions
- `commander@^12.0.0`: CLI framework
- `inquirer@^12.4.0`: Interactive prompts

### 🛠️ Technical Implementation

#### Wallet Storage (v0.0.5)
```
project-directory/
└── wallet.json   # Single wallet per project
```

#### Wallet File Format (v0.0.5)
```json
{
  "seed": "64-character-hex-string",
  "network": "preprod",
  "address": "mn_addr_preprod1..."
}
```

#### Network Support
- **Preprod**: Development and testing network (default)
- **Devnet**: Internal development network
- **Mainnet**: Production network (future)

### 📚 Documentation (v0.0.5)

- **`Docs/commands/wallet.md`**: Wallet command reference
- **`Docs/commands/deploy.md`**: Deployment command reference
- **`README.md`**: Project overview and quick start

### 🔒 Security (v0.0.5)

- Local wallet storage in project directory
- Seed displayed once during creation
- Recommendation to keep `wallet.json` private
- `.gitignore` patterns (user must configure)

### 💡 Usage Examples (v0.0.5)

#### Basic Wallet Creation
```bash
# Create wallet
npx nightforge wallet create

# Check balance
npx nightforge wallet balance

# Convert to DUST
npx nightforge wallet dust
```

#### Deployment with Wallet
```bash
# Deploy using wallet.json
npx nightforge deploy

# Deploy with explicit private key
npx nightforge deploy --private-key <seed>

# Deploy with environment variable
export MIDNIGHT_PRIVATE_KEY="your-seed"
npx nightforge deploy
```

### 🎯 Design Goals (v0.0.5)

- **Simplicity**: Single wallet per project workflow
- **Security**: Local file storage with manual backup
- **Integration**: Seamless deployment command integration
- **Flexibility**: Multiple authentication methods (file/flag/env)

### ⚠️ Known Limitations (v0.0.5)

- Single wallet per project (no multi-wallet support)
- Manual migration required when moving projects
- Wallet stored in project directory (version control risk)
- No wallet listing or management commands
- No wallet naming or identification system

---

## Version Comparison Summary

| Feature | v0.0.5 | v0.0.6 |
|---------|--------|--------|
| **Storage Location** | `./wallet.json` | `~/.nightforge/wallets/` |
| **Multiple Wallets** | ❌ No | ✅ Yes (unlimited) |
| **Wallet Naming** | ❌ No | ✅ Yes (auto + custom) |
| **Active Wallet** | ❌ No | ✅ Yes |
| **List Command** | ❌ No | ✅ Yes |
| **Switch Command** | ❌ No | ✅ Yes (`use`) |
| **Deploy Integration** | ✅ Basic | ✅ Advanced (--wallet flag) |
| **Wallet Creation Speed** | ~5.5 seconds | ~1.1 seconds |
| **Duplicate Protection** | ❌ No | ✅ Yes |
| **Network Validation** | ❌ No | ✅ Yes (mismatch warnings) |
| **File Permissions** | Default | ✅ 600 (owner-only) |

---

**Full Changelog**: https://github.com/yourusername/nightforge/compare/v0.0.5...v0.0.6
