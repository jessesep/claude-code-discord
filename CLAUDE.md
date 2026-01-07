# one agent - Development Guidelines

## 🧭 Mission

**one agent** is a dynamic routing layer that connects Discord to any AI provider (Cursor, Claude, Ollama, Gemini, etc.). The core philosophy:

- **Provider independence**: Users work through a unified interface
- **Role consistency**: Behavioral roles (Builder, Tester, etc.) work across all providers
- **Dynamic routing**: Route to the best provider for each task

## 🧠 Agent Memory

This project uses persistent agent memory.
- **Primary Standard**: Check `.agent-context.md` first.

## 📁 Key Files

| Path | Purpose |
|------|---------|
| `agent/manager.ts` | Manager agent system prompt |
| `agent/types.ts` | Agent configurations, roles, session types |
| `agent/providers/` | Provider implementations |
| `discord/` | Discord bot handlers |
| `settings/` | Configuration management |

## 🏗️ Architecture

```
Discord → one agent Router → Provider (Cursor/Claude/Ollama/Gemini)
                ↓
           Manager Agent → Roles → Execution
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for details.
