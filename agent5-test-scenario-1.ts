// Agent 5 Integration Test - Scenario 1
// Complete Workflow: Create file → Modify file → Verify

import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const testDir = "/Users/jessesep/repos/claude-code-discord";
const testFile1 = join(testDir, "agent5-test-file-1.txt");
const testFile2 = join(testDir, "agent5-test-math.ts");

console.log("=== Test Scenario 1: Complete Workflow ===\n");

// Step 1: Create a simple text file
console.log("Step 1: Creating test file...");
try {
  writeFileSync(testFile1, "Initial content from Agent 5 test", "utf8");
  if (existsSync(testFile1)) {
    console.log("✓ File created successfully");
  } else {
    console.log("✗ File creation failed");
  }
} catch (e) {
  console.log("✗ Error creating file:", e.message);
}

// Step 2: Read and verify
console.log("\nStep 2: Verifying initial content...");
try {
  const content = readFileSync(testFile1, "utf8");
  if (content === "Initial content from Agent 5 test") {
    console.log("✓ Content verified correctly");
    console.log(`  Content: "${content}"`);
  } else {
    console.log("✗ Content mismatch");
  }
} catch (e) {
  console.log("✗ Error reading file:", e.message);
}

// Step 3: Modify the file
console.log("\nStep 3: Modifying file content...");
try {
  const oldContent = readFileSync(testFile1, "utf8");
  const newContent = oldContent + "\nAdditional line from modification";
  writeFileSync(testFile1, newContent, "utf8");
  console.log("✓ File modified successfully");
} catch (e) {
  console.log("✗ Error modifying file:", e.message);
}

// Step 4: Verify modification
console.log("\nStep 4: Verifying modification...");
try {
  const content = readFileSync(testFile1, "utf8");
  if (content.includes("Additional line from modification")) {
    console.log("✓ Modification verified");
    console.log(`  New content:\n${content}`);
  } else {
    console.log("✗ Modification not found");
  }
} catch (e) {
  console.log("✗ Error verifying modification:", e.message);
}

// Step 5: Create TypeScript file with function
console.log("\nStep 5: Creating TypeScript file with function...");
const tsCode = `
export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}
`;

try {
  writeFileSync(testFile2, tsCode, "utf8");
  if (existsSync(testFile2)) {
    console.log("✓ TypeScript file created successfully");
  } else {
    console.log("✗ TypeScript file creation failed");
  }
} catch (e) {
  console.log("✗ Error creating TypeScript file:", e.message);
}

// Step 6: Verify TypeScript file
console.log("\nStep 6: Verifying TypeScript file...");
try {
  const content = readFileSync(testFile2, "utf8");
  const hasAdd = content.includes("function add");
  const hasMultiply = content.includes("function multiply");
  const hasExports = content.includes("export function");
  
  if (hasAdd && hasMultiply && hasExports) {
    console.log("✓ TypeScript file content verified");
  } else {
    console.log("✗ TypeScript file missing expected functions");
  }
} catch (e) {
  console.log("✗ Error verifying TypeScript file:", e.message);
}

console.log("\n=== Test Scenario 1 Complete ===");
