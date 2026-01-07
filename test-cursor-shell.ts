#!/usr/bin/env -S deno run --allow-all

/**
 * Test script to run a shell command using cursor-coder
 */

import { runAgentTask } from "./agent/orchestrator.ts";

async function testCursorShell() {
  console.log("🧪 Testing cursor-coder shell command execution...\n");
  
  const testString = "hello_shell_1767805368154";
  const task = `Run a shell command to echo "${testString}" and tell me what the output was.`;
  
  console.log(`📝 Task: ${task}\n`);
  console.log("⏳ Executing with cursor-coder agent...\n");
  
  try {
    const result = await runAgentTask(
      'cursor-coder',
      task,
      (chunk) => {
        // Print streaming chunks in real-time
        process.stdout.write(chunk);
      },
      false, // not authorized (will use default sandbox)
      Deno.cwd() // current working directory
    );
    
    console.log("\n\n" + "=".repeat(80));
    console.log("✅ TASK COMPLETED");
    console.log("=".repeat(80));
    console.log("\n📊 Full Response:");
    console.log(result);
    console.log("\n" + "=".repeat(80));
    
    // Check if the test string appears in the output
    if (result.includes(testString)) {
      console.log(`\n✅ SUCCESS: Output contains "${testString}"`);
    } else {
      console.log(`\n⚠️  WARNING: Output does not contain "${testString}"`);
    }
    
  } catch (error) {
    console.error("\n❌ ERROR:", error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await testCursorShell();
}
