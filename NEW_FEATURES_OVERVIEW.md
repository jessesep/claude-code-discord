# 🚀 Claude Code Discord Bot - Latest Features Overview

Welcome to the definitive guide to the newest features and enhancements in the **Claude Code Discord Bot**. This update brings a massive leap in orchestration capabilities, UI/UX improvements, and technical performance.

---

## 🎭 Multi-Agent Orchestration

The core engine has been upgraded to support complex, multi-agent workflows.

### 1. Concurrent Agent Spawning
You are no longer limited to one agent at a time. The bot can now run **multiple agents simultaneously** in the same Discord channel.
*   **Per-Channel Tracking**: Agents are isolated and tracked using a `userId:channelId` mapping.
*   **Sub-Agent Support**: The `ag-manager` can spawn specialized sub-agents (Coder, Architect, etc.) to handle parallel tasks without interrupting your main session.
*   **Command**: Use `/agents-status` to see exactly who is active and what they are working on.

### 2. Independent Role System
Expertise is now decoupled from the underlying model.
*   **Choose Your Role**: Select from **Coder**, **Architect**, **Reviewer**, or **Debugger**.
*   **Choose Your Model**: Pair any role with your preferred provider/model (Claude 3.5 Sonnet, Gemini 3 Flash, or Ollama).

---

## 📂 Project & Workspace Intelligence

The bot is now "repo-aware" and helps you stay organized across multiple projects.

### 3. Dynamic Category Naming
Discord categories are automatically branded with the repository name.
*   **Auto-Formatting**: Categories are renamed to `CategoryName (RepoName)` or just `RepoName`.
*   **Project Clarity**: Instantly distinguish between different microservices or projects in your Discord sidebar.

### 4. Interactive Repository Selection
Starting a session is now a breeze with dynamic dropdowns.
*   **Workspace Discovery**: The bot scans your workspace and presents a searchable list of repositories.
*   **Interactive Flow**: The `/run` command guides you through Provider → Model → Role → Repo selection using native Discord components.

---

## 🛠️ Enhanced User Experience

We've polished the interface to make interacting with AI feel more natural and responsive.

### 5. Advanced Utility Suite
New commands for better visibility:
*   `/agents-status`: A beautiful embed showing all active agents, their models, and risk levels.
*   `/category-info`: Details about the current repository, branch, and category mapping.
*   `/repo-info`: Deep dive into project structure and agent context.
*   `/status`: Global health check of bot services and API connections.

### 6. Intelligent Mention System
Agents now know when they need your attention.
*   **Smart Pings**: The bot will `@mention` you if it needs confirmation or input.
*   **Action Recognition**: Automatically detects phrases like "please confirm" or "need your input" to trigger notifications.

---

## 🧠 Model & Provider Integrations

### 7. Gemini 3 Flash: The New Default
We've integrated **Gemini 3 Flash** as the default model for orchestration tasks.
*   **Ultra-Low Latency**: Lightning-fast task decomposition and agent routing.
*   **Token Efficiency**: Massive context window at a fraction of the cost.

### 8. Hardened GitHub Integration
Issue management is now more robust.
*   **Deno-Native Spawning**: Uses native Deno process management for reliable CLI interaction.
*   **Rich Formatting**: GitHub issues are now created with cleaner markdown and automatic labeling.

---

## 🔧 Under the Hood Improvements

*   **Structured Context Loading**: Automatically injects `.agent-context.md` into prompts for better continuity.
*   **Unified Settings**: A centralized configuration system for all bot behaviors.
*   **Cross-Platform Parity**: Seamless performance across macOS (Darwin) and Linux.
*   **Ollama Provider Fix**: Corrected model listing logic for better local LLM integration.
*   **Deno Configuration Optimization**: Streamlined `deno.json` for better compatibility with strict Deno environments.

---

## ✅ Verification Status

| Feature | Status | Method |
| :--- | :--- | :--- |
| Multi-Agent Tracking | 🟢 Active | Unit Test |
| Category Naming | 🟢 Active | Service Restart |
| Repository Selection | 🟢 Active | CLI Mock |
| Gemini Integration | 🟢 Active | API Check |
| Ollama Support | 🟢 Fixed | Startup Test |

**Happy Coding!** 🚀
