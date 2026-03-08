# Compact Language Modules & Deployment

## Clarification: Compact Module System

Based on official Midnight documentation, **Compact DOES support a module/import system**, similar to EVM but with different semantics.

### Module Definition

Create separate `.compact` files with module definitions:

**`AdminModule.compact`:**
```compact
module AdminModule {
  export circuit isAdmin(admin: Field): Boolean {
    return admin == 1;
  }
}
```

**`TokenModule.compact`:**
```compact
module TokenModule {
  export struct Token {
    supply: Field,
    decimals: Uint<8>
  }
  
  export circuit mint(amount: Field): Token {
    return Token { supply: amount, decimals: 18 };
  }
}
```

### Importing Modules

In your main contract file:

```compact
import AdminModule;
import TokenModule;

export circuit initialize(admin: Field): Token {
  const isValid = isAdmin(admin);
  assert(isValid, "Invalid admin");
  return mint(1000000);
}
```

### Compiler Behavior

The Nightforge compiler:

1. **Recursively discovers** all `.compact` files in `contracts/` and subdirectories
2. **Compiles each file** as part of the contract build
3. **Generates one contract artifact** that includes all modules and their exports

### Deployment Semantics

- **One deployment address per contract**: When you deploy, ALL modules are compiled together into ONE contract at ONE address
- **Single contract instance**: All modules share the same ledger and state
- **Multiple calls**: You call different exported circuits from the single deployed contract

### Example Deployment

```bash
# Compile all modules together
npx nightforge compile

# Deploy as single contract
npx nightforge deploy mycontract

# Call different exported circuits from TypeScript
const admin = await contract.circuits.isAdmin(1);
const token = await contract.circuits.mint(1000000);
```

### Structure

```
contracts/
├── Main.compact           (imports modules)
├── modules/
│   ├── AdminModule.compact
│   ├── TokenModule.compact
│   └── TransferModule.compact
└── interfaces/
    └── Types.ts          (TypeScript types for witnesses)
```

### Key Differences from EVM

| Aspect | EVM | Compact |
|--------|-----|---------|
| **Module Imports** | Yes (contract-to-contract) | Yes (file-to-file within contract) |
| **Separate Deployment Addresses** | Yes, each contract deployed separately | No, all modules compile to one contract |
| **Shared State** | No, separate ledger per contract | Yes, all modules share ledger |
| **Cross-Module Calls** | External calls (gas cost) | Internal calls (zero cost) |

### File Inclusion Alternative

For even simpler code organization, Compact also supports file inclusion:

```compact
include "helpers/validation";  // Includes file verbatim
```

This embeds the entire file content, useful for shared utilities without module namespacing.
