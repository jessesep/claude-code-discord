# one agent - Guidelines

## 🧭 The One Agent Philosophy

**one agent** is a dynamic routing layer that connects Discord to any AI provider.

### Core Principles

1. **Provider Independence**: Decouple workflow from any single AI vendor
2. **Role Consistency**: Same roles (Builder, Tester, etc.) work across all providers
3. **Dynamic Routing**: Route to the best provider for each task type
4. **Unified Experience**: One interface, any model, every workflow

### Architecture

```
User Request → one agent Router → Provider (Cursor/Claude/Ollama/Gemini)
                    │
                    ├── Parse intent
                    ├── Select role
                    └── Route to provider
```

## 🧠 Agent Memory

This project uses persistent agent memory.
- **Primary Standard**: Check `.agent-context.md` first.

## 📚 Documentation

- [README.md](./README.md) - Project overview and quick start
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [docs/AGENT-ROLE-SYSTEM.md](./docs/AGENT-ROLE-SYSTEM.md) - Role system guide
- [docs/DISCORD_COMMANDS.md](./docs/DISCORD_COMMANDS.md) - Command reference
