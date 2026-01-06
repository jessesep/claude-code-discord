# Agent-Context Infrastructure Implementation Plan

## Overview
This plan establishes a "Hierarchical Context Tree" (Agent-Context) across the repository. Each major directory (compartment) contains a `.agent-context.md` file that provides a "compressed" source of truth for agents. This reduces token usage and improves onboarding accuracy for subagents.

## Planned Issues

### Issue 1: Interface & Engine Contexts
**Description**: Create `.agent-context.md` files for the `discord/`, `claude/`, and `git/` directories.
**Requirements**:
- Summarize the mission of each directory.
- Map key files and their responsibilities.
- List dependencies and code examples.
- Use the standard template from `.agent-context.md` (root).

### Issue 2: Infrastructure & Shared Utils Contexts
**Description**: Create `.agent-context.md` files for `server/`, `dashboard/`, `settings/`, and `util/`.
**Requirements**:
- Focus on how these modules are consumed by the main agent/discord layers.
- Detail persistence mechanisms in `settings/`.
- Document key utility patterns in `util/`.

### Issue 3: Automation & Validation Tooling
**Description**: Develop a Deno script (`scripts/validate-context.ts`) to ensure context files are up-to-date.
**Requirements**:
- Check if all subdirectories have an `.agent-context.md`.
- (Advanced) Scan for exported functions/classes and check if they are mentioned in the local context file.
- Report "outdated" contexts if files have been modified significantly more recently than the context file.

### Issue 4: Manager Integration
**Description**: Update the system prompts to mandate checking these files.
**Requirements**:
- Modify `agent/manager.ts` and `agent/index.ts` to include an instruction for agents to `view_file` the local `.agent-context.md` upon entry.

---

## Subagent Prompts

### Prompt A: For Issue 1 (Interface & Engine)
"You are a Senior Architect Subagent. Your task is to populate the Context Tree for the core engine and interface compartments: `discord/`, `claude/`, and `git/`. Read the files in each directory to understand their specific roles, dependencies, and best practices. Create a `.agent-context.md` in each of these folders following the format established in the root `.agent-context.md`. Ensure these files are 'compressed' (dense with information) and highly useful for an agent seeing the folder for the first time."

### Prompt B: For Issue 3 (Automation Tooling)
"You are a Tools Developer Subagent. Your task is to create a validation script in Deno (`scripts/validate-context.ts`) that verifies the health of our Hierarchical Context Tree. The script should:
1. Walk the directory tree and ensure every folder (excluding `.git`, `node_modules`, `data`, etc.) has an `.agent-context.md` file.
2. Verify that paths mentioned in these files actually exist.
3. [Optional] Compare the last modification time of `.ts` files in a folder with the `.agent-context.md` and warn if the context might be stale.
Output the results in a clean table format."

### Prompt C: For Issue 4 (Protocol Update)
"You are a System Designer Subagent. Your task is to integrate the Agent-Context system into our agent protocols. Update the `MANAGER_SYSTEM_PROMPT` in `agent/manager.ts` and any other relevant system prompts (like subagent templates) to include a 'Mandatory Initialization' step. This step must instruct the agent to always read the `.agent-context.md` in the root and their target work directory before performing any file operations. This is a must-happen behavior."
