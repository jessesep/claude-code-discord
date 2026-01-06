#!/usr/bin/env -S deno run --allow-all
import { executeGitCommand } from "./git/handler.ts";

const workDir = Deno.cwd();

console.log("🎉 CELEBRATION TIME! 🎉");
console.log("========================\n");

try {
  // Stage all changes
  console.log("📦 Staging all changes...");
  await executeGitCommand(workDir, "git add -A");
  console.log("   ✅ Changes staged\n");

  // Show status
  console.log("📊 Changes to commit:");
  const status = await executeGitCommand(workDir, "git status --short");
  console.log(status);
  console.log();

  // Create commit
  console.log("💾 Creating celebratory commit...");
  const commitMessage = `🎉 Major milestone: Enhanced agent system, conversation sync, and dashboard!

✨ Features:
- 🤖 Advanced agent orchestration with Antigravity integration
- 💬 Conversation sync between Discord and Cursor
- 📊 Beautiful dashboard for bot monitoring
- 🔄 Real-time webhook integration
- 🎯 Improved command handling and error recovery
- 📝 Comprehensive conversation history tracking

🚀 This is a significant step forward in building a powerful
   autonomous coding agent system that bridges Discord with
   professional development workflows!

🎊 Time to celebrate! 🎊`;

  const commitResult = await executeGitCommand(workDir, `git commit -m "${commitMessage.replace(/"/g, '\\"')}"`);
  console.log(commitResult);
  console.log();

  // Get branch
  const branchOutput = await executeGitCommand(workDir, "git branch --show-current");
  const branch = branchOutput.trim() || "main";
  console.log(`📍 Pushing to branch: ${branch}\n`);

  // Push to GitHub
  console.log("🚀 Pushing to GitHub...");
  const pushResult = await executeGitCommand(workDir, `git push origin ${branch}`);
  console.log(pushResult);
  console.log();

  console.log("✅ SUCCESS! 🎉");
  console.log("========================");
  console.log("Your code is now on GitHub!");
  console.log("\n💡 Next step: Consider making this repo private for security");
  console.log("   Visit: https://github.com/jessesep/claude-code-discord/settings");
  console.log("\n🎊 CELEBRATION COMPLETE! 🎊\n");
} catch (error) {
  console.error("❌ Error:", error);
  Deno.exit(1);
}
