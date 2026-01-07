# Discord Bot Commands

This guide provides a comprehensive list of all slash commands available in the Claude Code Discord bot.

## 🤖 AI Agent Commands

The `/agent` command is the primary way to interact with specialized AI agents.

### `/agent action:chat`
Chat with an AI agent. This is the most common command.

- **Parameters**:
  - `message` (Required): The message or task you want the agent to handle.
  - `agent_name` (Optional): The specific agent to use. If not provided, it uses your active agent or the default "General Development Assistant".
  - `include_git_context` (Optional): Boolean. If true, includes the current git status and diff in the conversation context.

- **Example**:
  - `/agent action:chat message:Explain how the authentication flow works`
  - `/agent action:chat message:Fix the bug in the login component agent_name:Debugger Specialist`

---

### `/agent action:list`
List all available AI agents and their capabilities.

- **Parameters**: None
- **Example**: `/agent action:list`

---

### `/agent action:start`
Start a persistent session with a specific agent in the current channel.

- **Parameters**:
  - `agent_name` (Required): The agent to start a session with.
- **Example**: `/agent action:start agent_name:Software Architect`

---

### `/agent action:status`
Check your currently active agent session in the current channel.

- **Parameters**: None
- **Example**: `/agent action:status`

---

### `/agent action:end`
End the current agent session and clear history.

- **Parameters**: None
- **Example**: `/agent action:end`

---

## ⚙️ Administrative Commands

These commands are restricted to administrators.

### `/restart`
Restarts the bot or the entire system.

- **Parameters**:
  - `target` (Required): 
    - `Bot`: Restarts only the Discord bot process.
    - `Full System`: Restarts both the bot and the underlying server.

- **Example**: `/restart target:Bot`

---

## 💡 Tips for Best Results

1. **Context is Key**: Use `include_git_context: true` when you want the agent to see your recent code changes.
2. **Specialized Agents**: Use the right agent for the task (e.g., `Code Reviewer` for reviews, `Debugger Specialist` for fixes).
3. **Provider Mentions**: You can mention providers like "ollama", "cursor", or "gemini" in your message to temporarily switch the underlying engine for that request.
   - *Example*: `/agent action:chat message:use ollama to explain this code`
