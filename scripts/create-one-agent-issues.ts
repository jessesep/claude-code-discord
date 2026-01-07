/**
 * Create GitHub Issues for "One Agent" Renaming
 * 
 * Creates issues for removing provider-specific branding (Claude) 
 * and moving to "one agent" / "one bot" architecture naming.
 */

import { createMultipleGitHubIssues, type GitHubIssue } from "../util/github-issues.ts";

const issues: GitHubIssue[] = [
  {
    title: "🎨 Rename Discord UI and Category Labels to 'one agent' / 'one bot'",
    body: `## 🎯 Goal
Remove provider-specific "Claude" branding from the Discord interface and replace it with "one agent" or "one bot" branding.

## 📋 Tasks
- [ ] Rename "Claude Agents" category in \`discord/main.ts\`
- [ ] Update embed titles and labels in \`agent/handlers.ts\` (e.g., "Claude Limit Reached" -> "one agent: Provider Limit Reached")
- [ ] Update any default bot names or activity statuses that mention "Claude"

## 🎯 Benefits
- Provider independence
- Consistent branding across different models
- Aligns with the "one architecture" vision`,
    labels: ["enhancement", "frontend", "cleanup"]
  },
  {
    title: "📚 Update Documentation and READMEs to 'one agent' / 'one bot'",
    body: `## 🎯 Goal
Update all documentation files to reflect the move away from "Claude" specific branding to the "one agent" architecture.

## 📋 Tasks
- [ ] Update \`README.md\` and \`ARCHITECTURE.md\`
- [ ] Update all files in \`docs/\` (especially \`CURSOR_GUIDE.md\`, \`DISCORD_COMMANDS.md\`)
- [ ] Update handover notes in \`agent/handovers/\`
- [ ] Update report templates in \`reports/\`

## 🎯 Benefits
- Clearer documentation for new users
- Accurate representation of the system's capabilities`,
    labels: ["documentation", "cleanup"]
  },
  {
    title: "💻 Refactor Internal Code and Comments to Remove 'Claude' Mentions",
    body: `## 🎯 Goal
Clean up the codebase by renaming variables, functions, and comments that specifically reference "Claude" when they should be generic "one agent" or "one bot" references.

## 📋 Tasks
- [ ] Rename functions like \`sendClaudeMessages\` to \`sendAgentMessages\` in \`agent/handlers.ts\`
- [ ] Update comments in \`agent/\`, \`discord/\`, and \`claude/\` (which might need a directory rename later)
- [ ] Update log messages in \`util/log-manager.ts\` or other logging utilities
- [ ] Update script names and comments (e.g., \`reboot.sh\`, \`restart-bot.sh\`)

## 🎯 Benefits
- Maintainable and accurate code
- Reduces confusion when using other providers`,
    labels: ["refactor", "cleanup", "agent"]
  },
  {
    title: "🧪 Update Test Suites and Mocks for 'one agent' Branding",
    body: `## 🎯 Goal
Ensure all tests reflect the new branding and verify that the "one agent" naming is consistently applied.

## 📋 Tasks
- [ ] Update E2E tests in \`tests/\` (e.g., \`e2e-tester-bot.ts\`)
- [ ] Update mock bot names and expected response strings
- [ ] Update test category names in setup scripts

## 🎯 Benefits
- Reliable automated testing of the new branding`,
    labels: ["testing", "cleanup"]
  }
];

async function main() {
  console.log("Creating GitHub issues for 'One Agent' rebranding...\n");

  const result = await createMultipleGitHubIssues(issues);

  console.log(`\n✅ Created ${result.success} issues`);
  console.log(`❌ Failed to create ${result.failed} issues\n`);

  if (result.results.length > 0) {
    console.log("Issue Creation Results:");
    console.log("━".repeat(60));
    for (const res of result.results) {
      if (res.success) {
        console.log(`✅ #${res.issueNumber}: ${res.issue.title}`);
      } else {
        console.log(`❌ Failed: ${res.issue.title}`);
        console.log(`   Error: ${res.error}`);
      }
    }
    console.log("━".repeat(60));
  }

  Deno.exit(result.failed > 0 ? 1 : 0);
}

if (import.meta.main) {
  main();
}
