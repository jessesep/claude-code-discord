// Agent 5 Integration Test - Complete Integration Test
// Combines all scenarios and checks for integration issues

import { execSync } from "child_process";
import { writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  errors: string[];
}

const testDir = "/Users/jessesep/repos/claude-code-discord";
const results: TestResult[] = [];

function runTest(name: string, testFn: () => Promise<{ passed: boolean; errors: string[] }>): void {
  const startTime = Date.now();
  testFn().then(result => {
    const duration = Date.now() - startTime;
    results.push({
      name,
      passed: result.passed,
      duration,
      errors: result.errors
    });
  });
}

console.log("╔════════════════════════════════════════════════════════════════╗");
console.log("║        Agent 5 - Complete Integration Test Suite              ║");
console.log("║      Testing end-to-end workflows and interactions            ║");
console.log("╚════════════════════════════════════════════════════════════════╝\n");

// Test 1: File System Integration
console.log("TEST 1: File System Integration");
async function testFileSystem() {
  const errors: string[] = [];
  try {
    const testFile = join(testDir, "test-fs-integration.txt");
    writeFileSync(testFile, "Initial content", "utf8");

    if (!existsSync(testFile)) {
      errors.push("File creation failed");
    }

    const content = readFileSync(testFile, "utf8");
    if (content !== "Initial content") {
      errors.push("File content mismatch");
    }

    writeFileSync(testFile, "Modified content", "utf8");
    const newContent = readFileSync(testFile, "utf8");
    if (newContent !== "Modified content") {
      errors.push("File modification failed");
    }

    rmSync(testFile);
    console.log("  ✓ File operations (create, read, modify, delete)");
  } catch (e) {
    errors.push(e.message);
  }

  return { passed: errors.length === 0, errors };
}

// Test 2: Git Integration
console.log("TEST 2: Git Integration");
async function testGitIntegration() {
  const errors: string[] = [];
  try {
    // Check git status
    const status = execSync("git status --porcelain", { cwd: testDir }).toString();
    if (!status) {
      errors.push("git status returned empty");
    }

    // Check git log
    const log = execSync("git log --oneline -1", { cwd: testDir }).toString().trim();
    if (!log) {
      errors.push("git log returned empty");
    }

    // Check git branch
    const branch = execSync("git branch --show-current", { cwd: testDir }).toString().trim();
    if (!branch) {
      errors.push("git branch check failed");
    }

    if (errors.length === 0) {
      console.log("  ✓ Git status, log, and branch operations");
    }
  } catch (e) {
    errors.push(e.message);
  }

  return { passed: errors.length === 0, errors };
}

// Test 3: Directory Structure
console.log("TEST 3: Directory Structure");
async function testDirectoryStructure() {
  const errors: string[] = [];
  try {
    const testDir2 = join(testDir, "test-dir-structure");
    if (existsSync(testDir2)) {
      rmSync(testDir2, { recursive: true });
    }

    mkdirSync(testDir2, { recursive: true });

    const subDir = join(testDir2, "nested", "deep");
    mkdirSync(subDir, { recursive: true });

    if (!existsSync(subDir)) {
      errors.push("Nested directory creation failed");
    }

    // Create files at different levels
    writeFileSync(join(testDir2, "file1.txt"), "Level 1", "utf8");
    writeFileSync(join(testDir2, "nested", "file2.txt"), "Level 2", "utf8");
    writeFileSync(join(subDir, "file3.txt"), "Level 3", "utf8");

    if (!existsSync(join(testDir2, "file1.txt"))) {
      errors.push("File creation at level 1 failed");
    }
    if (!existsSync(join(testDir2, "nested", "file2.txt"))) {
      errors.push("File creation at level 2 failed");
    }
    if (!existsSync(join(subDir, "file3.txt"))) {
      errors.push("File creation at level 3 failed");
    }

    rmSync(testDir2, { recursive: true });

    if (errors.length === 0) {
      console.log("  ✓ Nested directory and multi-level file operations");
    }
  } catch (e) {
    errors.push(e.message);
  }

  return { passed: errors.length === 0, errors };
}

// Test 4: Multiple File Types
console.log("TEST 4: Multiple File Types");
async function testMultipleFileTypes() {
  const errors: string[] = [];
  try {
    const testDir2 = join(testDir, "test-file-types");
    if (!existsSync(testDir2)) {
      mkdirSync(testDir2, { recursive: true });
    }

    // Create different file types
    const files = [
      { ext: "json", content: '{"key": "value"}', validate: (c: string) => JSON.parse(c) },
      { ext: "ts", content: "export function test() {}", validate: (c: string) => c.includes("export") },
      { ext: "js", content: "console.log('test');", validate: (c: string) => c.includes("console") },
      { ext: "css", content: "body { margin: 0; }", validate: (c: string) => c.includes("{") },
      { ext: "md", content: "# Title\n\nContent", validate: (c: string) => c.includes("#") }
    ];

    for (const file of files) {
      const filePath = join(testDir2, `test.${file.ext}`);
      writeFileSync(filePath, file.content, "utf8");

      const content = readFileSync(filePath, "utf8");
      try {
        file.validate(content);
      } catch (e) {
        errors.push(`Validation failed for .${file.ext} file: ${e.message}`);
      }
    }

    if (errors.length === 0) {
      console.log("  ✓ JSON, TypeScript, JavaScript, CSS, Markdown files");
    }

    rmSync(testDir2, { recursive: true });
  } catch (e) {
    errors.push(e.message);
  }

  return { passed: errors.length === 0, errors };
}

// Test 5: Large File Operations
console.log("TEST 5: Large File Operations");
async function testLargeFiles() {
  const errors: string[] = [];
  try {
    const testFile = join(testDir, "test-large-file.txt");

    // Create a large file (1 MB)
    const largeContent = "x".repeat(1024 * 1024);
    writeFileSync(testFile, largeContent, "utf8");

    if (!existsSync(testFile)) {
      errors.push("Large file creation failed");
    }

    const content = readFileSync(testFile, "utf8");
    if (content.length !== largeContent.length) {
      errors.push("Large file content size mismatch");
    }

    // Modify large file
    const appendedContent = largeContent + "APPENDED";
    writeFileSync(testFile, appendedContent, "utf8");

    const newContent = readFileSync(testFile, "utf8");
    if (newContent !== appendedContent) {
      errors.push("Large file modification failed");
    }

    rmSync(testFile);

    if (errors.length === 0) {
      console.log("  ✓ 1 MB file creation, reading, and modification");
    }
  } catch (e) {
    errors.push(e.message);
  }

  return { passed: errors.length === 0, errors };
}

// Test 6: JSON Operations
console.log("TEST 6: JSON Operations");
async function testJsonOperations() {
  const errors: string[] = [];
  try {
    const testFile = join(testDir, "test-json-operations.json");

    // Create complex JSON
    const data = {
      name: "Test Project",
      version: "1.0.0",
      config: {
        debug: true,
        timeout: 5000
      },
      items: [
        { id: 1, name: "Item 1" },
        { id: 2, name: "Item 2" }
      ]
    };

    writeFileSync(testFile, JSON.stringify(data, null, 2), "utf8");

    const content = readFileSync(testFile, "utf8");
    const parsed = JSON.parse(content);

    if (parsed.name !== "Test Project") {
      errors.push("JSON name property mismatch");
    }
    if (parsed.config.timeout !== 5000) {
      errors.push("JSON nested property mismatch");
    }
    if (parsed.items.length !== 2) {
      errors.push("JSON array length mismatch");
    }

    // Modify JSON
    parsed.version = "1.1.0";
    parsed.config.debug = false;
    writeFileSync(testFile, JSON.stringify(parsed, null, 2), "utf8");

    const newContent = readFileSync(testFile, "utf8");
    const newParsed = JSON.parse(newContent);

    if (newParsed.version !== "1.1.0") {
      errors.push("JSON modification failed");
    }

    rmSync(testFile);

    if (errors.length === 0) {
      console.log("  ✓ Complex JSON creation, parsing, and modification");
    }
  } catch (e) {
    errors.push(e.message);
  }

  return { passed: errors.length === 0, errors };
}

// Test 7: Concurrent-like Operations
console.log("TEST 7: Concurrent-like Operations");
async function testConcurrentOperations() {
  const errors: string[] = [];
  try {
    const testDir2 = join(testDir, "test-concurrent");
    if (!existsSync(testDir2)) {
      mkdirSync(testDir2, { recursive: true });
    }

    // Create 10 files in sequence (simulating concurrent creation)
    const files = [];
    for (let i = 0; i < 10; i++) {
      const filePath = join(testDir2, `file-${i}.txt`);
      writeFileSync(filePath, `Content of file ${i}`, "utf8");
      files.push(filePath);
    }

    // Verify all files exist
    for (const filePath of files) {
      if (!existsSync(filePath)) {
        errors.push(`File not found: ${filePath}`);
      }
    }

    // Modify all files in sequence
    for (let i = 0; i < files.length; i++) {
      const content = readFileSync(files[i], "utf8");
      writeFileSync(files[i], content + " - MODIFIED", "utf8");
    }

    // Verify all modifications
    for (let i = 0; i < files.length; i++) {
      const content = readFileSync(files[i], "utf8");
      if (!content.includes("MODIFIED")) {
        errors.push(`Modification not applied to file ${i}`);
      }
    }

    rmSync(testDir2, { recursive: true });

    if (errors.length === 0) {
      console.log("  ✓ Sequential multi-file creation and modification");
    }
  } catch (e) {
    errors.push(e.message);
  }

  return { passed: errors.length === 0, errors };
}

// Test 8: Special Characters and Encoding
console.log("TEST 8: Special Characters and Encoding");
async function testSpecialCharacters() {
  const errors: string[] = [];
  try {
    const testFile = join(testDir, "test-special-chars.txt");

    // Test various special characters
    const specialContent = `Special characters test:
    Unicode: こんにちは 你好 🎉🚀
    Symbols: @#$%^&*()
    Quotes: "double" and 'single'
    Backslash: \\ and forward /
    Newlines and
    Multiple
    Lines
    Tab\tseparated\tvalues`;

    writeFileSync(testFile, specialContent, "utf8");

    const content = readFileSync(testFile, "utf8");
    if (content !== specialContent) {
      errors.push("Special characters not preserved");
    }

    if (!content.includes("こんにちは")) {
      errors.push("Unicode characters not preserved");
    }

    if (!content.includes("🎉🚀")) {
      errors.push("Emoji not preserved");
    }

    rmSync(testFile);

    if (errors.length === 0) {
      console.log("  ✓ Special characters, Unicode, and emoji handling");
    }
  } catch (e) {
    errors.push(e.message);
  }

  return { passed: errors.length === 0, errors };
}

// Run all tests
async function runAllTests() {
  const tests = [
    ["File System Integration", testFileSystem],
    ["Git Integration", testGitIntegration],
    ["Directory Structure", testDirectoryStructure],
    ["Multiple File Types", testMultipleFileTypes],
    ["Large File Operations", testLargeFiles],
    ["JSON Operations", testJsonOperations],
    ["Concurrent-like Operations", testConcurrentOperations],
    ["Special Characters and Encoding", testSpecialCharacters]
  ];

  for (const [name, testFn] of tests) {
    const result = await testFn();
    results.push({
      name,
      passed: result.passed,
      duration: 0,
      errors: result.errors
    });
  }

  // Print results summary
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║                     TEST RESULTS SUMMARY                      ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  let passCount = 0;
  let failCount = 0;

  results.forEach(result => {
    const status = result.passed ? "✓ PASS" : "✗ FAIL";
    console.log(`${status}: ${result.name}`);
    if (result.errors.length > 0) {
      result.errors.forEach(err => {
        console.log(`       └─ ${err}`);
      });
      failCount++;
    } else {
      passCount++;
    }
  });

  console.log("\n" + "═".repeat(64));
  console.log(`Total: ${passCount + failCount} | Passed: ${passCount} | Failed: ${failCount}`);
  console.log(`Success Rate: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);
  console.log("═".repeat(64) + "\n");

  return { passCount, failCount };
}

runAllTests();
