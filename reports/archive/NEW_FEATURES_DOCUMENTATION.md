# 🚀 Claude Code Discord Bot - New Features Documentation

Welcome to the latest update for the **Claude Code Discord Bot**! We've implemented several powerful features to enhance your development workflow, improve multi-agent collaboration, and provide better visibility into your projects.

---

## 🎭 Multi-Agent Orchestration

### 1. Concurrent Agent Spawning
You can now run **multiple agents simultaneously** in the same Discord channel. This allows for parallel task execution where different specialized agents work on different parts of a project at the same time.

*   **Per-Channel Tracking**: Agents are tracked using a unique combination of `userId` and `channelId`.
*   **Manager Coordination**: The `ag-manager` can spawn multiple sub-agents without interrupting existing sessions.
*   **New Command**: Use `/agents-status` to see all currently active agents in your channel.

### 2. Independent Role System
Roles are now decoupled from specific models. You can choose a role (e.g., Coder, Architect, Reviewer) and then select the model (Claude 3.5 Sonnet, Gemini 3 Flash, etc.) you want that role to use.

---

## 📂 Project & Workspace Management

### 3. Dynamic Category Naming
The bot now automatically organizes Discord categories based on the repository being worked on.
*   **Format**: `CategoryName (RepositoryName)` or just `RepositoryName`.
*   **Benefit**: Instantly identify which repository a set of channels belongs to, preventing confusion when managing multiple projects.

### 4. Interactive Repository Selection
When starting a session with `/run`, you can now select your workspace/repository from a dynamic list. This ensures the agent is always working in the correct directory.

---

## 🛠️ Enhanced User Interface

### 5. Advanced `/run` Workflow
We've completely overhauled the `/run` command to be more interactive and user-friendly:
*   **Provider Selection**: Choose between Anthropic (Claude), Google (Gemini/Antigravity), or Local (Ollama).
*   **Model Selection**: Pick the specific model version for your task.
*   **Role Assignment**: Select the expertise level for your agent.
*   **Discord Select Menus**: All selections use native Discord dropdowns for a seamless experience.

### 6. New Utility Commands
*   `/agents-status`: Comprehensive overview of active agent sessions.
*   `/category-info`: Details about the current category's repository and branch.
*   `/repo-info`: Deep dive into the repository configuration.
*   `/status`: Quick health check of the bot and its connections.

---

## 🧠 Model & Provider Integrations

### 7. Gemini 3 Flash Support
**Gemini 3 Flash** is now the default model for the Manager agent, providing:
*   **Faster Response Times**: Significant reduction in latency for orchestration tasks.
*   **Cost Efficiency**: Lower token costs for long-running management sessions.
*   **High Performance**: Excellent reasoning capabilities for task decomposition.

### 8. Enhanced GitHub Integration
GitHub issue creation has been improved with:
*   **Better Formatting**: Cleaner issue descriptions and labels.
*   **Deno Native Execution**: Uses `Deno.Command` for more reliable interactions with the GitHub CLI.
*   **Fallback Mechanisms**: Automatic fallback to alternative methods if the primary CLI is unavailable.

---

## 🔧 Technical Improvements

*   **Structured Context Loading**: Automatic injection of `.agent-context.md` into all agent prompts.
*   **Unified Settings System**: A centralized way to manage bot configurations.
*   **Cross-Platform Fixes**: Improved path handling and command execution across Darwin (macOS) and Linux.
*   **Security Hardening**: Critical fixes for process spawning and token management.

---

## 🧪 Verification Status

To ensure these features work perfectly in your environment:
1.  **Service Restart**: The bot has been restarted to apply all configuration changes.
2.  **Automated Testing**: Verification tests (`tests/verify-features.ts`) have been executed.
3.  **Manual Check**: Utility commands have been verified for output correctness.

**Happy Coding with Claude & Gemini!** 🚀
