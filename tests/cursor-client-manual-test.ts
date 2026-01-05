/**
 * Manual test for Cursor CLI client
 *
 * Prerequisites:
 * - Cursor must be installed: curl https://cursor.com/install -fsSL | bash
 * - Run with: deno run --allow-run tests/cursor-client-manual-test.ts
 */

import { sendToCursorCLI } from "../claude/cursor-client.ts";

console.log("🧪 Testing Cursor CLI Integration\n");
console.log("=".repeat(50));

// Test 1: Basic non-streaming JSON output
console.log("\n📝 Test 1: Basic JSON Output (No Streaming)");
console.log("-".repeat(50));

const controller1 = new AbortController();

try {
  const result1 = await sendToCursorCLI(
    "List all TypeScript files in the current directory",
    controller1,
    {
      model: "sonnet-4",
      streamJson: false,
    }
  );

  console.log("✅ Test 1 Passed");
  console.log(`Response length: ${result1.response.length} characters`);
  console.log(`Duration: ${result1.duration}ms`);
  console.log(`Model: ${result1.modelUsed}`);
  console.log(`Chat ID: ${result1.chatId || "N/A"}`);
  console.log(`Response preview: ${result1.response.substring(0, 200)}...`);
} catch (error) {
  console.error("❌ Test 1 Failed:", error);
}

// Test 2: Streaming JSON output
console.log("\n📝 Test 2: Streaming JSON Output");
console.log("-".repeat(50));

const controller2 = new AbortController();
let chunkCount = 0;

try {
  const result2 = await sendToCursorCLI(
    "Explain what the cursor-client.ts file does in 2 sentences",
    controller2,
    {
      model: "sonnet-4",
      streamJson: true,
    },
    (chunk) => {
      chunkCount++;
      process.stdout.write(chunk);
    }
  );

  console.log("\n\n✅ Test 2 Passed");
  console.log(`Chunks received: ${chunkCount}`);
  console.log(`Duration: ${result2.duration}ms`);
  console.log(`Chat ID: ${result2.chatId || "N/A"}`);
} catch (error) {
  console.error("\n❌ Test 2 Failed:", error);
}

// Test 3: With workspace parameter
console.log("\n📝 Test 3: With Workspace Parameter");
console.log("-".repeat(50));

const controller3 = new AbortController();

try {
  const result3 = await sendToCursorCLI(
    "How many files are in this project?",
    controller3,
    {
      model: "sonnet-4",
      workspace: Deno.cwd(),
      streamJson: false,
    }
  );

  console.log("✅ Test 3 Passed");
  console.log(`Response: ${result3.response.substring(0, 200)}...`);
} catch (error) {
  console.error("❌ Test 3 Failed:", error);
}

// Test 4: Error handling (invalid model)
console.log("\n📝 Test 4: Error Handling");
console.log("-".repeat(50));

const controller4 = new AbortController();

try {
  await sendToCursorCLI(
    "Test error handling",
    controller4,
    {
      model: "invalid-model-xyz",
    }
  );

  console.log("❌ Test 4 Failed: Should have thrown an error");
} catch (error) {
  console.log("✅ Test 4 Passed: Error caught correctly");
  console.log(`Error message: ${error.message.substring(0, 100)}...`);
}

// Test 5: Cancellation
console.log("\n📝 Test 5: Request Cancellation");
console.log("-".repeat(50));

const controller5 = new AbortController();

setTimeout(() => {
  console.log("⏱️  Aborting request after 1 second...");
  controller5.abort();
}, 1000);

try {
  const result5 = await sendToCursorCLI(
    "Write a very long essay about TypeScript (this will be cancelled)",
    controller5,
    {
      model: "sonnet-4",
      streamJson: true,
    }
  );

  if (result5.response.includes("cancelled")) {
    console.log("✅ Test 5 Passed: Request was cancelled successfully");
  } else {
    console.log("⚠️  Test 5: Request completed before cancellation");
  }
} catch (error) {
  console.error("❌ Test 5 Failed:", error);
}

console.log("\n" + "=".repeat(50));
console.log("🎉 All tests completed!\n");
