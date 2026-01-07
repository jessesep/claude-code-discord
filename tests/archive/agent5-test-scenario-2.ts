// Agent 5 Integration Test - Scenario 2
// Test git integration: Create files and check git status

import { execSync } from "child_process";
import { writeFileSync, existsSync } from "fs";
import { join } from "path";

const testDir = "/Users/jessesep/repos/claude-code-discord";
const testGitFile = join(testDir, "agent5-git-test.md");

console.log("=== Test Scenario 2: Git Integration ===\n");

// Initial git status
console.log("Step 1: Check initial git status...");
try {
  const gitStatus = execSync("git status --porcelain", { cwd: testDir }).toString();
  console.log("✓ Git status retrieved:");
  const lines = gitStatus.split('\n');
  lines.slice(0, 5).forEach(line => {
    if (line) console.log(`  ${line}`);
  });
} catch (e) {
  console.log("✗ Error getting git status:", e.message);
}

// Create a new file
console.log("\nStep 2: Creating new file for git tracking...");
try {
  const content = "# Agent 5 Git Test\n\nThis file tests git integration.";
  writeFileSync(testGitFile, content, "utf8");
  console.log("✓ File created successfully");
} catch (e) {
  console.log("✗ Error creating file:", e.message);
}

// Check git status after file creation
console.log("\nStep 3: Check git status after file creation...");
try {
  const gitStatus = execSync("git status --porcelain", { cwd: testDir }).toString();
  const hasTestFile = gitStatus.includes("agent5-git-test.md");

  if (hasTestFile) {
    console.log("✓ New file detected in git status");
    const lines = gitStatus.split('\n');
    const line = lines.find(l => l.includes("agent5-git-test.md"));
    if (line) console.log(`  ${line}`);
  } else {
    console.log("✗ File not found in git status");
  }
} catch (e) {
  console.log("✗ Error getting git status:", e.message);
}

// Check git log
console.log("\nStep 4: Check git commit history...");
try {
  const gitLog = execSync("git log --oneline -5", { cwd: testDir }).toString();
  console.log("✓ Recent commits:");
  const lines = gitLog.split('\n');
  lines.slice(0, 5).forEach(line => {
    if (line) console.log(`  ${line}`);
  });
} catch (e) {
  console.log("✗ Error getting git log:", e.message);
}

// Check git branch
console.log("\nStep 5: Check current git branch...");
try {
  const branch = execSync("git branch --show-current", { cwd: testDir }).toString().trim();
  console.log(`✓ Current branch: ${branch}`);
} catch (e) {
  console.log("✗ Error getting current branch:", e.message);
}

// Check for uncommitted changes
console.log("\nStep 6: Count uncommitted changes...");
try {
  const gitStatus = execSync("git status --porcelain", { cwd: testDir }).toString();
  const changes = gitStatus.split('\n').filter(l => l.trim());
  console.log(`✓ Total uncommitted changes: ${changes.length}`);
} catch (e) {
  console.log("✗ Error counting changes:", e.message);
}

console.log("\n=== Test Scenario 2 Complete ===");
