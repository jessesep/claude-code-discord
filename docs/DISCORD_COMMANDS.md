# Discord Commands Reference

This guide provides a comprehensive list of all slash commands available in **one agent**.

---

## 🤖 Agent Commands

The `/agent` command is the primary way to interact with AI agents. **one agent** routes your requests to the configured provider (Cursor, Claude, Ollama, Gemini, etc.).

### `/agent action:chat`

Chat with an AI agent. This is the most common command.

- **Parameters**:
  - `message` (Required): The message or task you want the agent to handle
  - `agent_name` (Optional): Specific agent role to use (Builder, Tester, etc.)
  - `include_git_context` (Optional): Include current git status and diff

- **Examples**:
  ```
  /agent action:chat message:Explain how the authentication flow works
  /agent action:chat message:Fix the bug in the login component agent_name:Debugger Specialist
  ```

- **Provider Routing**: Mention a provider in your message to route to it:
  ```
  /agent action:chat message:use ollama to explain this code
  /agent action:chat message:use cursor to refactor the auth module
  ```

---

### `/agent action:list`

List all available AI agents and their capabilities.

- **Parameters**: None
- **Output**: Shows all configured agents with their roles, providers, and risk levels

---

### `/agent action:aliases`

List all available agent mention aliases.

- **Parameters**: None
- **Output**: Shows a list of short aliases (e.g., `@coder`, `@arch`) and which agents they target.

---

### `/agent action:start`

Start a persistent session with a specific agent role.

- **Parameters**:
  - `agent_name` (Required): The agent role to use
- **Example**: 
  ```
  /agent action:start agent_name:Software Architect
  ```

---

### `/agent action:status`

Check your currently active agent session.

- **Parameters**: None
- **Output**: Current agent, provider, model, and session info

---

### `/agent action:end`

End the current agent session and clear history.

- **Parameters**: None

---

## 🎯 Direct Agent Mentions (@agent-name)

You can invoke specific agents directly in any message by using the `@alias` syntax. This bypasses the Manager agent's decision-making process and sends your request directly to the named agent.

- **Syntax**: `@alias [your message]`
- **Benefits**: Reduced latency, direct control, and specialized responses.
- **Example**: `@coder add a new login route to the auth controller`

### Popular Aliases:
- `@coder` or `@code` → Implementation specialist
- `@builder` or `@build` → Autonomous coding specialist
- `@architect` or `@arch` → System design expert
- `@test` or `@tester` → QA and testing specialist
- `@review` or `@reviewer` → Code review specialist
- `@security` or `@sec` → Security analyst
- `@manager` → Direct call to the Manager orchestrator

Use `/agent action:aliases` to see the full list of available shortcuts.

---

## 🔄 Session Management

### `/continue`

Continue the previous conversation with context.

### `/cancel-agent`

Cancel any running agent task.

### `/agents-status`

View all active agents running across channels.

---

## ⚙️ Settings & Configuration

### `/settings`

Unified settings management for providers, models, and defaults.

- **Subcommands**:
  - `provider` - Configure AI providers
  - `model` - Set default models
  - `output` - Configure output formatting

### `/agent-models`

List available models for each configured provider.

### `/quick-model`

Quickly switch between models without going through settings.

---

## 🔧 Development Tools

### `/agent-explain`

Get explanations of code or concepts.

- **Parameters**:
  - `code` or `file`: Code to explain
  - `context` (Optional): Additional context

### `/agent-debug`

Debug issues with AI assistance.

- **Parameters**:
  - `issue`: Description of the problem
  - `include_logs` (Optional): Include recent logs

### `/agent-review`

Request a code review.

- **Parameters**:
  - `file` or `diff`: Code to review
  - `focus` (Optional): Specific areas to focus on

### `/agent-refactor`

Refactor code with AI guidance.

- **Parameters**:
  - `target`: File or code to refactor
  - `goal`: Refactoring objective

### `/agent-generate`

Generate code from specifications.

- **Parameters**:
  - `description`: What to generate
  - `language` (Optional): Target language

### `/agent-optimize`

Optimize code for performance.

### `/agent-learn`

Get learning resources for a topic.

---

## 📁 Git Operations

### `/git`

Execute git commands.

- **Parameters**:
  - `command`: Git command to run
- **Examples**:
  ```
  /git command:status
  /git command:diff HEAD~1
  /git command:log --oneline -10
  ```

### `/worktree`

Create a new git worktree.

- **Parameters**:
  - `branch`: Branch name
  - `path` (Optional): Worktree path

### `/worktree-list`

List all active worktrees.

### `/worktree-remove`

Remove a worktree.

- **Parameters**:
  - `path`: Worktree path to remove

### `/worktree-bots`

Manage bots running in worktrees.

### `/worktree-kill`

Kill a bot running in a worktree.

---

## 🖥️ Shell Management

### `/shell`

Execute shell commands.

- **Parameters**:
  - `command`: Command to execute
- **Examples**:
  ```
  /shell command:ls -la
  /shell command:npm run build
  ```

### `/shell-input`

Send input to a running shell process.

### `/shell-list`

List active shell processes.

### `/shell-kill`

Kill a shell process.

---

## 📊 System Monitoring

### `/system-info`

Display system information (OS, CPU, memory).

### `/processes`

List running processes.

### `/system-resources`

Show CPU, memory, and disk usage.

### `/network-info`

Display network configuration.

### `/disk-usage`

Show disk space usage.

### `/env-vars`

List environment variables (filtered for security).

### `/system-logs`

View recent system logs.

### `/port-scan`

Scan for open ports.

### `/service-status`

Check service status.

### `/uptime`

Show system uptime.

---

## 🛠️ Utility Commands

### `/status`

Check bot and provider status.

### `/pwd`

Print current working directory.

### `/shutdown`

Gracefully shutdown the bot (admin only).

### `/help`

Display help information.

### `/category-info`

Show category and repository information for current channel.

### `/repo-info`

Display repository details.

---

## 👔 Agent Roles

When using `/agent`, you can specify different roles:

| Role | Description | Best For |
|------|-------------|----------|
| **Manager** | Orchestrator that coordinates other agents | Complex multi-step tasks |
| **Builder** 🔨 | Implementation-focused agent | Writing code, features |
| **Tester** 🧪 | Quality assurance specialist | Writing tests, QA |
| **Investigator** 🔍 | Analysis and debugging | Debugging, security |
| **Architect** 🏗️ | System design expert | Planning, refactoring |
| **Reviewer** 👁️ | Code review specialist | PRs, best practices |

---

## 🎛️ Thinking Mode Options

Control how deeply the agent reasons:

| Mode | Description | Use Case |
|------|-------------|----------|
| `none` | Standard responses | Quick queries |
| `think` | Step-by-step reasoning | Complex problems |
| `think-hard` | Deep analysis | Architecture decisions |
| `ultrathink` | Maximum depth | Critical issues |

---

## ⚡ Operation Modes

Control how the agent operates:

| Mode | Description | Risk Level |
|------|-------------|------------|
| `normal` | Standard with confirmations | Low |
| `plan` | Planning only, no execution | None |
| `auto-accept` | Auto-apply changes | Medium |
| `danger` | Unrestricted mode | High |

---

## 🔌 Provider Routing

**one agent** routes requests to the appropriate provider:

| Provider | Trigger | Best For |
|----------|---------|----------|
| **Cursor** | `use cursor`, file editing tasks | Autonomous coding |
| **Claude** | `use claude`, reasoning tasks | Analysis, review |
| **Ollama** | `use ollama`, privacy needed | Local, offline |
| **Gemini** | Default for quick queries | Fast responses |

---

## 📋 Task Management

### `/todos action:list`

List current todos.

### `/todos action:add`

Add a new todo.

- **Parameters**:
  - `task`: Task description
  - `priority` (Optional): low, medium, high, critical

### `/todos action:complete`

Mark a todo as complete.

### `/todos action:generate`

Generate todos from code analysis.

---

## 🔗 MCP (Model Context Protocol)

### `/mcp action:list`

List configured MCP servers.

### `/mcp action:add`

Add an MCP server.

- **Parameters**:
  - `type`: local, http, websocket, ssh
  - `url`: Server URL or path

### `/mcp action:remove`

Remove an MCP server.

### `/mcp action:test`

Test MCP server connection.

---

## 🔐 Administrative Commands

These commands are restricted to administrators.

### `/restart`

Restart the bot or system.

- **Parameters**:
  - `target`: `Bot` (Discord bot only) or `Full System`

---

## 💡 Tips for Best Results

1. **Context is Key**: Use `include_git_context: true` for code-related tasks
2. **Right Role, Right Job**: Use Builder for coding, Reviewer for PRs
3. **Provider Mentions**: Say "use cursor" or "use ollama" to route to specific providers
4. **Session Persistence**: Use `/agent action:start` for ongoing work
5. **Check Status**: Use `/agents-status` to see what's running

---

*See [ARCHITECTURE.md](../ARCHITECTURE.md) for system design details.*
