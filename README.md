<div align="center">

# one agent discord

**A dynamic router that connects Discord to any AI provider**

*One interface. Any model. Every workflow.*

<kbd>

| Capability | Description | Status |
| --- | --- | :---: |
| **Universal Provider Routing** | Connect to Cursor, Claude, Ollama, Gemini, OpenAI, or any provider through a single interface | ✅ |
| **Use AI Anywhere** | Host locally (VM / Docker / cloud) and send commands via Discord | ✅ |
| **Dynamic Model Selection** | Switch providers and models on-the-fly per request | ✅ |
| **Role-Based Agents** | Specialized roles (Builder, Tester, Architect, Reviewer) work with any provider | ✅ |
| **Multi-Agent Orchestration** | Manager agent coordinates specialized workers concurrently | ✅ |
| **Branch-Aware Organization** | Maps Git branches to Discord channels/categories | ✅ |
| **Immediate, Shareable Feedback** | Execute `/agent`, `/git`, or `/shell` and get outputs directly in-channel | ✅ |
| **Role-Based Access Control** | Restrict commands to specific Discord roles | ✅ |
| **Local Hosting & Security** | Keep keys and code on your infrastructure | ✅ |
| **Audit Trail** | Channel history records who ran what and when | ✅ |

</kbd>

</div>

---

## The One Agent Philosophy

**one agent discord** is not another AI chatbot—it's a *routing layer* that decouples your workflow from any single AI provider.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Discord Interface                         │
│                    (one unified experience)                      │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      one agent (Router)                          │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Cursor  │  │  Claude  │  │  Ollama  │  │  Gemini  │  ...   │
│  │ Provider │  │ Provider │  │ Provider │  │ Provider │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

**Why this matters:**
- **No vendor lock-in**: Switch providers without changing your workflow
- **Cost optimization**: Route simple queries to free local models, complex tasks to premium APIs
- **Resilience**: If one provider is down, route to another
- **Best tool for the job**: Use Cursor for file editing, Claude for reasoning, Ollama for privacy

---

## Quick Start

**Prerequisites:**
- [Deno](https://deno.com/) runtime
- Discord bot token and application ID
- At least one AI provider configured

### 1. Install Deno

```bash
# Linux/macOS
curl -fsSL https://deno.land/install.sh | sh

# Windows (PowerShell)
irm https://deno.land/install.ps1 | iex
```

### 2. Clone & Configure

```bash
git clone https://github.com/zebbern/claude-code-discord.git
cd claude-code-discord
```

Set your Discord credentials:

```bash
# Linux/macOS
export DISCORD_TOKEN="your-discord-bot-token"
export APPLICATION_ID="your-discord-app-id"

# Windows PowerShell
$env:DISCORD_TOKEN = "your-discord-bot-token"
$env:APPLICATION_ID = "your-discord-app-id"
```

**Using direnv (recommended):**
```bash
cp .envrc.example .envrc
# Edit .envrc with your tokens
direnv allow
```

### 3. Configure a Provider

Choose at least one provider:

| Provider | Setup | Best For |
|----------|-------|----------|
| **Ollama** | `ollama serve` (local, free) | Privacy, offline, experimentation |
| **Cursor** | `cursor agent --version` | File editing, autonomous coding |
| **Claude CLI** | `claude login` | Reasoning, code review |
| **Gemini/Antigravity** | `GOOGLE_API_KEY` or `ANTHROPIC_API_KEY` | Fast responses, orchestration |

### 4. Run

```bash
# Basic start
deno run --allow-all index.ts

# With notifications when agent completes
deno run --allow-all index.ts --category myproject --user-id YOUR_DISCORD_USER_ID
```

---

## Discord Bot Setup

If you don't have a Discord bot yet:

1. **Create Application**: Go to [Discord Developer Portal](https://discord.com/developers/applications) → New Application
2. **Copy Application ID**: General Information → Application ID
3. **Create Bot**: Bot section → Add Bot → Copy Token
4. **Invite Bot**: OAuth2 → URL Generator
   - Scopes: `bot`, `applications.commands`
   - Permissions: Send Messages, Use Slash Commands, Read Message History, Embed Links

---

## Command Overview

**48 commands** organized by function:

### Core Agent Commands
| Command | Description |
|---------|-------------|
| `/agent` | Chat with AI agent (routes to configured provider) |
| `/continue` | Continue previous conversation |
| `/cancel-agent` | Cancel running agent |
| `/agents-status` | View all active agents |

### Provider & Model Selection
| Command | Description |
|---------|-------------|
| `/agent-models` | List available models per provider |
| `/settings` | Configure providers, models, and defaults |
| `/quick-model` | Quick switch between models |

### Development Tools
| Command | Description |
|---------|-------------|
| `/agent-explain` | Explain code or concepts |
| `/agent-debug` | Debug issues |
| `/agent-review` | Code review |
| `/agent-refactor` | Refactor code |
| `/agent-generate` | Generate code |

### Git Operations
| Command | Description |
|---------|-------------|
| `/git` | Run git commands |
| `/worktree` | Manage git worktrees |
| `/worktree-list` | List active worktrees |

### Shell & System
| Command | Description |
|---------|-------------|
| `/shell` | Execute shell commands |
| `/system-info` | System information |
| `/processes` | List processes |

See [docs/DISCORD_COMMANDS.md](docs/DISCORD_COMMANDS.md) for the complete command reference.

---

## Architecture

**one agent discord** uses a hierarchical architecture:

```
User Request
     │
     ▼
┌─────────────────┐
│  Manager Agent  │  ← Orchestrator (routes requests, spawns workers)
│  (Gemini Flash) │
└────────┬────────┘
         │
    ┌────┴────┬────────────┬────────────┐
    ▼         ▼            ▼            ▼
┌───────┐ ┌───────┐  ┌──────────┐  ┌─────────┐
│ Coder │ │Tester │  │ Architect│  │Reviewer │  ← Specialized Roles
└───┬───┘ └───┬───┘  └────┬─────┘  └────┬────┘
    │         │           │             │
    └─────────┴─────┬─────┴─────────────┘
                    ▼
           ┌────────────────┐
           │   Providers    │  ← Any AI backend
           │ Cursor│Claude  │
           │ Ollama│Gemini  │
           └────────────────┘
```

**Key concepts:**
- **Manager**: Triages requests, decomposes tasks, delegates to specialists
- **Roles**: Behavioral presets that work across any provider
- **Providers**: Pluggable AI backends (add your own!)
- **Sessions**: Track conversation history per user/channel

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed system design.

---

## Provider Configuration

### Ollama (Local, Free)
```bash
# Install and start
ollama serve

# Pull a model
ollama pull llama3.2
```

### Cursor (File Editing)
```bash
# Install CLI
curl https://cursor.com/install -fsSL | bash

# Verify
cursor agent --version
```

### Claude CLI
```bash
# Authenticate
claude login
```

### Gemini / Anthropic API
```bash
export GOOGLE_API_KEY="your-key"
# or
export ANTHROPIC_API_KEY="your-key"
```

---

## Project Structure

```
claude-code-discord/
├── agent/           # Agent system (manager, providers, orchestration)
│   ├── manager.ts   # Manager agent orchestration
│   ├── providers/   # Provider implementations (Cursor, Ollama, etc.)
│   └── types.ts     # Agent configurations and roles
├── discord/         # Discord bot handlers
├── docs/            # Documentation
├── settings/        # Configuration management
└── util/            # Shared utilities
```

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Key areas:**
- Adding new providers
- Improving role definitions
- Enhancing Discord UX
- Documentation improvements

---

## Related Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - System design and component details
- [docs/AGENT-ROLE-SYSTEM.md](docs/AGENT-ROLE-SYSTEM.md) - Role system guide
- [docs/DISCORD_COMMANDS.md](docs/DISCORD_COMMANDS.md) - Complete command reference
- [docs/CURSOR_GUIDE.md](docs/CURSOR_GUIDE.md) - Cursor integration details

---

<div align="center">

**one agent discord** — *Route to any AI. Work from anywhere.*

</div>
