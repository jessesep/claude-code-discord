/**
 * Create GitHub Issues for System Restoration and Refactor Cleanup
 * 
 * Creates well-labeled issues documenting:
 * 1. Completion of Agent/Claude renaming restoration
 * 2. Remaining Deno type fixes
 * 3. Swarm logic verification
 * 4. Discord topic sync implementation
 */

import { createMultipleGitHubIssues, type GitHubIssue } from "../util/github-issues.ts";

const issues: GitHubIssue[] = [
  {
    title: "🔧 System Restoration: Agent/Claude Refactor Cleanup Complete",
    body: `## 🎯 Summary

We have successfully repaired the cascading errors caused by the "Claude" to "Agent" refactor. The system is now provider-agnostic while maintaining backward compatibility for existing commands and modules.

## 📋 What's Been Completed

### Core Restoration
- **Backward Compatibility**: Added alias exports for \`sendToClaudeCode\`, \`enhancedClaudeQuery\`, and \`CLAUDE_MODELS\`.
- **Import Fixes**: Resolved over 30 syntax and reference errors across 50+ files.
- **Budget Mode**: Corrected model identifier to \`gemini-3-flash\` for budget-friendly testing.

### Reliability & Monitoring
- **Standalone Notifications**: Implemented \`scripts/notify-discord.ts\` for process-independent status reporting.
- **Boot Lifecycle**: Updated \`restart-bot.sh\` and \`reboot.sh\` to broadcast startup/shutdown events to Discord.
- **Tester Feedback**: E2E tests now announce activity and success/failure directly in dedicated channels.

## 📁 Key Restoration Files
- \`claude/client.ts\` (Added aliases)
- \`claude/enhanced-client.ts\` (Added aliases)
- \`scripts/notify-discord.ts\` (New standalone notifier)
- \`agent/handovers/session-restoration.md\` (Detailed technical log)

## ✅ Success Criteria
- Bot boots without SyntaxErrors.
- E2E tests pass using budget models.
- Discord receives lifecycle notifications.`,
    labels: ["refactor", "reliability", "completed"]
  },
  {
    title: "🐛 Fix Remaining Deno Type Errors in index.ts and discord/",
    body: `## 🎯 Goal

Resolve the remaining 10-15 Deno type errors (\`deno check index.ts\`) resulting from the naming transition.

## 📋 Tasks
- **EmbedData vs EmbedBuilder**: Convert active \`EmbedBuilder\` usages to plain \`EmbedData\` objects where required by interfaces.
- **ActionRow Structure**: Fix nesting of \`ActionRowBuilder\` in \`MessageContent\` payloads.
- **Interface Alignment**: Update \`OSCDependencies\` and other interface definitions to reflect the new \`agent\` naming.
- **Optional Params**: Ensure \`timestamp\` in \`ClaudeMessage\` is handled correctly (type mismatch: boolean vs string).

## 📊 Status
- Total errors: ~10
- Files affected: \`index.ts\`, \`discord/event-handlers.ts\`, \`osc/index.ts\``,
    labels: ["bug", "typescript", "deno"]
  },
  {
    title: "🕵️ Verify \"Testing Swarm\" Logic and Isolated Channel Contexts",
    body: `## 🎯 Goal

Ensure the multi-agent swarm logic correctly isolates agent sessions to specific Discord channels and handles the "Context Window" initialization.

## 📋 Requirements
- **Channel Routing**: Verify \`message-handler.ts\` routes messages to the correct \`targetAgent\` based on channel ID.
- **Autonomy**: Ensure agents in a swarm can operate independently without cross-talk.
- **Persistence**: Verify channel topics (\`[CONTEXT WINDOW]\`) are correctly set during spawn.
- **Killability**: Test the ability to terminate individual agents or entire swarms.

## 🔗 Related logic
- \`util/swarm-manager.ts\`
- \`agent/handlers.ts\``,
    labels: ["feature", "swarm", "verification"]
  },
  {
    title: "🔄 Implement Discord Channel Topic Synchronization",
    body: `## 🎯 Goal

Maintain the Discord channel topic as a living "Context Window" that updates when agent tasks or project paths change.

## 📋 Features
- **Auto-Sync**: Automatically update topic when \`setAgentSession\` is called with a new task.
- **Metadata Visibility**: Include branch, repository, and local path in the topic for easy reference.
- **Cleanup**: Remove or reset topics when sessions are cleared.`,
    labels: ["enhancement", "ux", "discord"]
  }
];

async function main() {
  console.log("Creating restoration and cleanup issues...\n");
  const result = await createMultipleGitHubIssues(issues);
  console.log(\`\\n✅ Created \${result.success} issues\`);
  Deno.exit(result.failed > 0 ? 1 : 0);
}

if (import.meta.main) {
  main();
}
`,file_path: