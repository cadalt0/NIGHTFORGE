# `nightforge compile`

Compile Compact contracts into managed artifacts.

## Syntax

```bash
npx nightforge compile [contract] [options]
```

`contract` can be a file name such as `example.compact`.

## Options

- `-f, --force`: force recompilation
- `-q, --quiet`: suppress output

## Examples

```bash
# Compile by selecting from prompt (when multiple .compact files exist)
npx nightforge compile

# Compile explicit entry file
npx nightforge compile example.compact
```

## File selection behavior

When you run `npx nightforge compile`:

1. If there is only one `.compact` file, it compiles that file directly.
2. If there are multiple `.compact` files, Nightforge asks you to choose the file.

When you pass a file name, Nightforge compiles that file as the entry point.
Any imported modules/submodules are resolved by the Compact compiler automatically.

### Sample output

```text
npx nightforge compile

╔══════════════════════════════════════════════════════════════╗
║ Nightforge - Compiler                                        ║
╚══════════════════════════════════════════════════════════════╝

ℹ Found 3 contract file(s)
ℹ 
Contract files found:
ℹ   1. example.compact
ℹ   2. modules/AdminModule.compact
ℹ   3. modules/TokenModule.compact

Enter the main contract file number (or file name): 1

─── Compiling main contract: example.compact ─────────────────
ℹ (All imported modules will be included automatically)

Compiling 2 circuits:
  circuit "getMessage" (k=6, rows=26)
  circuit "storeMessage" (k=7, rows=114)
Overall progress [====================] 2/2
✓ Compiled: example
─── Compilation Complete! ─────────────────────────────────────
```

### Interactive selection (multiple files)

```text
Contract files found:
  1. app/Main.compact
  2. modules/AdminModule.compact
  3. modules/TokenModule.compact

Enter the main contract file number (or file name): 1
```

## Output location

Compiled output is written under:

- `contracts/managed/<ContractName>/...`

