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
| `osc/` | OSC bridge for TouchOSC integration |
| `util/instance-lock.ts` | Prevents duplicate bot instances |

## 🏗️ Architecture

```
Discord → one agent Router → Provider (Cursor/Claude/Ollama/Gemini)
                ↓
           Manager Agent → Roles → Execution
```

## 🛠 Build & Test Commands

- **Start Bot**: `deno task start` (uses `start-bot.sh`)
- **Run E2E Tests**: `deno task test:e2e` (uses `scripts/run-e2e-tests.ts`)
- **Run Unit Tests**: `deno test --allow-all`
- **Create Issues**: `deno run --allow-all scripts/create-latest-progress-issues.ts`

## 🆕 Recent Features

- **Progress Indicators**: Real-time elapsed time in Discord embeds.
- **Model Fallback Chain**: Automatic retry with same-gen or newer models on 429/503.
- **Agent Isolation**: Hard channel binding and unique instance IDs per session.
- **Testing Mode**: `TESTING_MODE=true` to bypass restrictions and auto-approve.
- **Usage Analytics**: Real-time dashboard at `http://localhost:8000`.

## 🏆 Golden Standards

1. **Branding**: This project is **one agent discord** (lowercase).
2. **Never Downgrade**: Fallbacks must be same-generation or newer.
3. **Isolation**: Every spawned agent must have a unique ID and hard channel binding.
4. **Interactive UX**: Prefer Discord embeds and buttons.
5. **Event-Driven Tests**: E2E tests use activity-based watchdog timers.
