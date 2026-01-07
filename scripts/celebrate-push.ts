#!/usr/bin/env -S deno run --allow-all --allow-run
/**
 * 🎉 Celebration Push Script 🎉
 * Commits and pushes all changes with a celebratory message!
 */

console.log("🎉 CELEBRATION TIME! 🎉");
console.log("========================\n");

// Get current branch
const branchCmd = new Deno.Command("git", { args: ["branch", "--show-current"] });
const branchOutput = await branchCmd.output();
const branch = new TextDecoder().decode(branchOutput.stdout).trim();
console.log(`📍 Current branch: ${branch}\n`);

// Stage all changes
console.log("📦 Staging all changes...");
const addCmd = new Deno.Command("git", { args: ["add", "-A"] });
await addCmd.output();

// Show status
console.log("\n📊 Changes to commit:");
const statusCmd = new Deno.Command("git", { args: ["status", "--short"] });
const statusOutput = await statusCmd.output();
console.log(new TextDecoder().decode(statusOutput.stdout));

// Create celebratory commit
console.log("\n💾 Creating celebratory commit...");
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

const commitCmd = new Deno.Command("git", {
  args: ["commit", "-m", commitMessage]
});
const commitOutput = await commitCmd.output();
if (!commitOutput.success) {
  const error = new TextDecoder().decode(commitOutput.stderr);
  if (error.includes("nothing to commit")) {
    console.log("ℹ️  No changes to commit (everything is already committed)");
  } else {
    console.error("❌ Commit failed:", error);
    Deno.exit(1);
  }
} else {
  console.log("✅ Commit created!");
}

// Push to GitHub
console.log("\n🚀 Pushing to GitHub...");
const pushCmd = new Deno.Command("git", { args: ["push", "origin", branch] });
const pushOutput = await pushCmd.output();
if (!pushOutput.success) {
  const error = new TextDecoder().decode(pushOutput.stderr);
  console.error("❌ Push failed:", error);
  Deno.exit(1);
}

console.log("\n✅ SUCCESS! 🎉");
console.log("========================");
console.log("Your code is now on GitHub!");
console.log("\n💡 Next step: Consider making this repo private for security");
console.log("   Visit: https://github.com/jessesep/claude-code-discord/settings");
console.log("\n🎊 CELEBRATION COMPLETE! 🎊\n");
