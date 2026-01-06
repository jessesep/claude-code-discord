
# Subagent Swarm Helper

This directory contains the Swarm Orchestrator, which allows you to run multi-agent workflows directly from the terminal.

## Prerequisites
1.  **Authentication**: You must be authenticated to use the Antigravity (Gemini) agents.
    *   **Option A (Recommended)**: Install `gcloud` CLI and run:
        ```bash
        gcloud auth login
        gcloud auth application-default login
        ```
    *   **Option B**: Set your API Key in `.env`:
        ```
        GEMINI_API_KEY=your_key_here
        ```

## Usage
Run the orchestrator with a task description:

```bash
deno run --allow-run --allow-read --allow-env --allow-net swarm/orc.ts "Your task here"
```

## How it Works
1.  **Architect Agent**: Analyzes your task and creates a plan.
2.  **Coder Agent**: Takes the plan and implements the code.
3.  **Output**: The final code is printed to the terminal.
