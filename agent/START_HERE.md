# Getting Started with Your AI Coding Bot

Welcome! This guide will help you set up, run, and interact with your Discord-based AI coding assistant.

## Prerequisites

- **Deno**: A modern runtime for JavaScript and TypeScript.
- **Discord Bot Token**: You need a bot token from the Discord Developer Portal.
- **API Keys**: Ensure you have keys for:
  - **Gemini** (for the Manager agent)
  - **Anthropic** (for Claude agents)
  - **OpenAI** (optional, if using OpenAI models)

## Setup

1.  **Environment Variables**:
    Create a `.env` file in the `agent/` directory (or ensure the one in root is loaded) with the following:

    ```env
    DISCORD_TOKEN=your_discord_token_here
    ANTHROPIC_API_KEY=your_anthropic_key_here
    GEMINI_API_KEY=your_gemini_key_here
    OWNER_ID=your_discord_user_id
    ```

2.  **Permissions**:
    The bot requires permissions to read messages, send messages, and use slash commands.

## How to Run

To start the bot, run the start script from the **root** of the repository:

```bash
cd ..
./start-bot.sh
```

Or run manually with Deno from the root:

```bash
deno run --allow-net --allow-read --allow-write --allow-env --allow-run --allow-sys index.ts
```

## Using the Bot

The bot uses **Slash Commands** on Discord.

### Core Commands

-   `/agent start agent_name:[name]`
    -   Starts a new session with a specific agent.
    -   **Examples**:
        -   `/agent start agent_name:ag-manager` (Recommended: Starts the Manager)
        -   `/agent start agent_name:ag-coder` (Direct coding)

-   `/agent chat message:[your message]`
    -   Send a message to the active agent in the current channel.
    -   You can also just mention the bot or reply to its messages if configured.

-   `/agent list`
    -   See all available agents and their capabilities.

-   `/agent status`
    -   Check the current session status.

-   `/agent end`
    -   End the current session (clears memory for that channel).

## The Manager Agent (`ag-manager`)

The **Gemini Manager** is a special agent designed to help you.
-   Start it with `/agent start agent_name:ag-manager`.
-   Ask it to "Scaffold a web app" or "Fix this bug".
-   It will **spawn sub-agents** (like Coder, Architect) to do the heavy lifting.
-   It keeps you updated on progress.

## Troubleshooting

-   **Bot not responding?** Check the console logs or `bot_demo.log`.
-   **Slash commands missing?** You might need to re-register them or wait for Discord to propagate changes.
-   **Permission Denied?** Ensure `OWNER_ID` matches your Discord ID for high-risk agents.

## Logs

Logs are written to `bot_demo.log` in the parent directory.
