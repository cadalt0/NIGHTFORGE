# Contributing to Nightforge

Thank you for your interest in contributing to Nightforge! This document will help you get started.

## 🎯 Vision

Nightforge aims to be a **professional, modular, and extensible developer toolkit for Midnight**, reducing boilerplate and accelerating end-to-end contract development workflows.

## 🔝 Top Priority (Current)

Current contribution priority is focused on:

1. **Local network support for development**
  - Add reliable local support for both testing and deployment.
  - Improve developer workflow so contracts can be compiled, tested, and deployed locally before targeting shared/preprod environments.

## 🏗️ Project Structure

The codebase is organized into independent, testable modules:

```
src/
├── cli/              # Command-line interface
│   ├── index.ts      # Main CLI entry point
│   └── commands/     # Individual command implementations
├── wallet/           # Wallet creation, restoration, management
├── deployer/         # Contract deployment orchestration
├── compiler/         # Contract compilation wrapper
├── providers/        # Midnight.js provider setup
├── config/           # Configuration loading & validation
├── utils/            # Shared utilities (logger, filesystem)
└── types/            # TypeScript types & Zod schemas
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20.x or higher
- Docker (for proof server)
- Git

### Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/cadalt0/NIGHTFORGE
cd nightforge

# Install dependencies
npm install

# Build the project
npm run build

# Link for local testing
npm link

# Test the CLI
nightforge --version
nightforge --help
```

