#!/usr/bin/env -S deno run --allow-all --allow-run
/**
 * 🎉 Celebration Push - Commits and pushes all changes!
 */

const workDir = Deno.cwd();

async function runGitCommand(args: string[]): Promise<{ success: boolean; output: string; error?: string }> {
  const cmd = new Deno.Command("git", {
    args,
    cwd: workDir,
    stdout: "piped",
    stderr: "piped"
  });
  
  const output = await cmd.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);
  
  return {
    success: output.success,
    output: stdout.trim(),
    error: stderr.trim() || undefined
  };
}

console.log("🎉 CELEBRATION TIME! 🎉");
console.log("========================\n");

// Get current branch
console.log("📍 Checking current branch...");
const branchResult = await runGitCommand(["branch", "--show-current"]);
const branch = branchResult.output || "main";
console.log(`   Branch: ${branch}\n`);

// Stage all changes
console.log("📦 Staging all changes...");
const addResult = await runGitCommand(["add", "-A"]);
if (!addResult.success) {
  console.error("❌ Failed to stage changes:", addResult.error);
  Deno.exit(1);
}
console.log("   ✅ Changes staged\n");

// Show status
console.log("📊 Changes to commit:");
const statusResult = await runGitCommand(["status", "--short"]);
if (statusResult.output) {
  console.log(statusResult.output);
} else {
  console.log("   (no changes to commit)");
}
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

const commitResult = await runGitCommand(["commit", "-m", commitMessage]);
if (!commitResult.success) {
  if (commitResult.error?.includes("nothing to commit")) {
    console.log("   ℹ️  No changes to commit (everything is already committed)");
  } else {
    console.error("   ❌ Commit failed:", commitResult.error);
    Deno.exit(1);
  }
} else {
  console.log("   ✅ Commit created!");
}
console.log();

// Push to GitHub
console.log("🚀 Pushing to GitHub...");
const pushResult = await runGitCommand(["push", "origin", branch]);
if (!pushResult.success) {
  console.error("   ❌ Push failed:", pushResult.error);
  Deno.exit(1);
}
console.log("   ✅ Pushed successfully!");
console.log();

console.log("✅ SUCCESS! 🎉");
console.log("========================");
console.log("Your code is now on GitHub!");
console.log("\n💡 Next step: Consider making this repo private for security");
console.log("   Visit: https://github.com/jessesep/claude-code-discord/settings");
console.log("\n🎊 CELEBRATION COMPLETE! 🎊\n");
