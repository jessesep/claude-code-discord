# one agent Documentation

This directory contains comprehensive documentation for **one agent** — a dynamic router that connects Discord to any AI provider.

---

## Core Concept

**one agent** is not a specific AI model—it's a routing layer that decouples your workflow from any single provider:

```
Discord → one agent Router → Any Provider (Cursor, Claude, Ollama, Gemini, ...)
```

**Benefits:**
- Switch providers without changing your workflow
- Use the best tool for each task
- Consistent experience across all AI backends

---

## Documentation Index

### Getting Started

| Document | Description |
|----------|-------------|
| [../README.md](../README.md) | Project overview, quick start, installation |
| [../ARCHITECTURE.md](../ARCHITECTURE.md) | System design, component hierarchy |
| [DISCORD_COMMANDS.md](./DISCORD_COMMANDS.md) | Complete slash command reference |

### Role System

| Document | Description |
|----------|-------------|
| [AGENT-ROLE-SYSTEM.md](./AGENT-ROLE-SYSTEM.md) | Complete guide to the role system (Builder, Tester, Architect, etc.) |

### Provider Documentation

| Document | Description |
|----------|-------------|
| [CURSOR-DISCORD-USAGE.md](./CURSOR-DISCORD-USAGE.md) | How to use Cursor provider via Discord |
| [CURSOR_GUIDE.md](./CURSOR_GUIDE.md) | Technical reference for Cursor CLI integration |

### Archive

| Document | Description |
|----------|-------------|
| [archive/CHANNEL-PROJECT-ROUTING.md](./archive/CHANNEL-PROJECT-ROUTING.md) | Legacy channel routing documentation |
| [archive/CHANNEL-ROUTING-IMPLEMENTATION.md](./archive/CHANNEL-ROUTING-IMPLEMENTATION.md) | Legacy implementation details |

---

## Quick Reference

### Agent Roles

| Role | Emoji | Focus |
|------|-------|-------|
| Builder | 🔨 | Implementation |
| Tester | 🧪 | Validation |
| Investigator | 🔍 | Analysis |
| Architect | 🏗️ | Design |
| Reviewer | 👁️ | Feedback |

### Providers

| Provider | Type | Best For |
|----------|------|----------|
| Cursor | CLI | File editing, autonomous coding |
| Claude | CLI/API | Reasoning, code review |
| Ollama | Local | Privacy, offline, free |
| Gemini | API | Fast responses, orchestration |

### Key Commands

```
/agent action:chat message:...    # Chat with agent
/agent action:list                # List available agents
/agent action:start               # Start persistent session
/agents-status                    # View all active agents
/settings                         # Configure providers
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│              Discord Interface                   │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│               one agent Router                   │
│                                                  │
│  Manager → Roles → Providers                    │
└─────────────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
    [Cursor]      [Claude]      [Ollama]    ...
```

---

## Contributing to Documentation

When updating documentation:

1. **Terminology**: Use "one agent" as the product name, emphasizing it's a router/layer
2. **Provider Focus**: Explain that providers are pluggable backends
3. **Role Focus**: Roles are behavioral presets that work across providers
4. **Consistency**: Keep formatting consistent across documents

---

*Part of the one agent ecosystem — Route to any AI. Work from anywhere.*
