# Nightforge Command Troubleshooting

This guide covers common issues and fixes for each Nightforge command.

---

## Quick environment checks (run first)

Before troubleshooting a specific command, confirm:

1. You are inside a Nightforge project (folder with `midnight.config.js` or `midnight.config.ts`)
2. Dependencies are installed: `npm install`
3. Nightforge CLI resolves: `npx nightforge --help`
4. Compact compiler is available in your environment
5. Network/proof-server settings in your config are correct

If `npx nightforge` is not found:

- Re-run `npm install` in the project
- Ensure `nightforge` is in dependencies/devDependencies
- Use `npx nightforge <command>` (not just `nightforge`)

---

## `nightforge init`

### Symptom: project is created but install fails

**Likely causes**

- npm registry/network issue
- lockfile conflict
- unsupported Node/npm version

**Fix**

- Run `npm install` manually in the generated project
- Remove lockfile and reinstall if needed
- Verify Node LTS and npm are current

### Symptom: template looks incomplete

**Likely causes**

- initialization was interrupted
- permission issue during file creation

**Fix**

- delete the partial project folder
- run `npx nightforge init <name>` again
- ensure write permission on parent folder

---

## `nightforge compile`

### Symptom: `No .compact files found`

**Likely causes**

- contract path in config is wrong
- contracts are not under configured contracts directory

**Fix**

- check `paths.contracts` in config
- move `.compact` files into configured contracts folder
- rerun compile

### Symptom: prompted to select file when multiple `.compact` files exist

**Expected behavior**

- if no file is passed and multiple contract files exist, CLI prompts for selection

**Fix / best practice**

- pass explicit entry file to avoid prompt:
  - `npx nightforge compile example.compact`

### Symptom: module import errors (`import M` not found)

**Likely causes**

- wrong module/file name
- imported module file is not discoverable from the entry file location
- imported module file has invalid top-level module structure

**Fix**

- verify module names and paths
- ensure imported module files are reachable per Compact import rules
- compile the intended entry file explicitly

### Symptom: compile succeeds but deploy cannot find artifact

**Likely causes**

- artifact name differs from assumed name
- a different file was selected during compile prompt

**Fix**

- check generated folder under `contracts/managed/<artifactName>`
- deploy with matching artifact name
- or recompile with explicit entry file name

---

## `nightforge wallet`

### Symptom: wallet create succeeds but later commands cannot use wallet

**Likely causes**

- wallet file not in project root
- wrong project root detected
- malformed wallet file

**Fix**

- ensure wallet file exists in current project root
- run commands from the same project directory
- recreate wallet file if corrupted

### Symptom: balance always zero

**Likely causes**

- faucet not funded yet
- wrong network selected
- wallet not fully synced

**Fix**

- fund address from faucet for selected network
- verify network in command/config
- wait for sync and retry

### Symptom: DUST conversion does not complete

**Likely causes**

- no tNight balance
- network/provider temporary issue

**Fix**

- confirm non-zero balance first
- retry after short wait
- verify network endpoints in config

---

## `nightforge proof-server` / `nightforge ps`

### Symptom: proof server status is not `ready`

**Likely causes**

- server still warming up
- startup failed due to local runtime issue
- stale status file

**Fix**

- wait and check again
- restart proof server command
- remove stale `proof-server-status.json` and start again

### Symptom: deploy says proof server not running even though it was started

**Likely causes**

- status file missing in current project root
- state not `ready`
- URL mismatch/old process

**Fix**

- run proof-server command from the same project
- confirm `proof-server-status.json` has `running: true` and `state: "ready"`
- restart proof server and retry deploy

### Symptom: `ps` behaves differently from `proof-server`

**Expected behavior**

- `ps` is shorthand alias and should match `proof-server`

**Fix**

- use same subcommand/options with both forms
- if mismatch is observed, update CLI package version

---

## `nightforge deploy`

### Symptom: deployment fails with proof-server error

**Likely causes**

- proof server not running/ready
- stale or missing proof-server status file

**Fix**

- start proof server and wait for ready state
- retry deploy only after ready confirmation

### Symptom: deployment fails with `Contract "..." not compiled`

**Likely causes**

- selected artifact not compiled
- wrong contract/artifact name passed

**Fix**

- run compile first
- verify `contracts/managed/<name>/contract/index.js` exists
- pass exact artifact name to deploy

### Symptom: deployment prompts for artifact selection

**Expected behavior**

- if no contract is passed and multiple artifacts exist, deploy asks which to deploy

**Fix / best practice**

- choose by number/name at prompt
- or pass artifact name directly:
  - `npx nightforge deploy example`

### Symptom: no private key found

**Lookup order used by deploy**

1. `--private-key`
2. `MIDNIGHT_PRIVATE_KEY`
3. `wallet.json`

**Fix**

- provide one of the above sources
- ensure `wallet.json` is in current project root and valid

### Symptom: deployment starts but stalls on wallet/balance

**Likely causes**

- wallet not funded
- sync delay

**Fix**

- fund wallet via faucet
- wait for sync
- retry deploy

---

## `nightforge deploy --auto`

### Symptom: auto mode loops waiting for funds

**Likely causes**

- wrong address funded
- wrong network selected

**Fix**

- copy exact address printed by command
- fund on correct network faucet
- confirm network option

### Symptom: auto mode reaches deploy and fails immediately

**Likely causes**

- contract artifact missing
- compile not run for intended entry file

**Fix**

- compile explicitly first
- rerun auto deploy with explicit contract name

---

## `nightforge clean`

### Symptom: command says cleaned, but files still appear in editor

**Likely causes**

- file explorer not refreshed
- viewing source files (not generated artifacts)
- looking in different project folder

**Fix**

- refresh file explorer
- confirm generated folder removed: `contracts/managed`
- verify current working directory is the intended project

### Symptom: clean does not remove expected folders

**What clean removes**

- configured managed output dir (default `contracts/managed`)
- `.cache`
- `dist`
- `node_modules` only with `--all`

**Fix**

- use `npx nightforge clean --all` if you also need `node_modules` removed
- confirm outputDir setting in config if custom path is used

---

## Common path/root issues

Many command failures happen because commands are run from a different folder than expected.

### How Nightforge chooses project root

- searches upward for `midnight.config.ts` or `midnight.config.js`
- that detected root is used for wallet, proof-server status, config paths, and artifacts

### Fix

- run commands from inside the intended project folder
- keep one config file at the project root
- avoid nested project configs unless intentional

---

## Recommended stable workflow

1. `npx nightforge clean`
2. `npx nightforge compile <entry.compact>`
3. `npx nightforge proof-server start` (or use `deploy --auto`)
4. `npx nightforge deploy <artifactName>`

For multi-file contracts with modules:

- compile the entry file only
- let Compact resolve imports automatically
- deploy the resulting artifact name under `contracts/managed`
