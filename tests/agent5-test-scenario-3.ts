// Agent 5 Integration Test - Scenario 3
// Test multiple file operations in one conversation

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const testDir = "/Users/jessesep/repos/claude-code-discord";
const subDir = join(testDir, "agent5-test-multi");

console.log("=== Test Scenario 3: Multiple File Operations ===\n");

// Create subdirectory
console.log("Step 1: Create subdirectory...");
try {
  if (!existsSync(subDir)) {
    mkdirSync(subDir, { recursive: true });
  }
  console.log("✓ Subdirectory created");
} catch (e) {
  console.log("✗ Error creating subdirectory:", e.message);
}

// Create multiple files
console.log("\nStep 2: Create multiple files in one operation...");
const files = [
  { name: "config.json", content: '{"name": "agent5-test", "version": "1.0.0", "enabled": true}' },
  { name: "README.md", content: "# Agent 5 Multi-File Test\n\nThis demonstrates multiple file operations." },
  { name: "styles.css", content: "body { margin: 0; padding: 0; font-family: Arial; }" },
  { name: "script.js", content: "console.log('Agent 5 test script');\nalert('Multi-file operation successful');" }
];

let createdCount = 0;
try {
  files.forEach(file => {
    const filePath = join(subDir, file.name);
    writeFileSync(filePath, file.content, "utf8");
    createdCount++;
  });
  console.log(`✓ Created ${createdCount} files successfully`);
} catch (e) {
  console.log("✗ Error creating files:", e.message);
}

// Verify all files exist
console.log("\nStep 3: Verify all files exist...");
try {
  let allExist = true;
  files.forEach(file => {
    const filePath = join(subDir, file.name);
    if (!existsSync(filePath)) {
      console.log(`  ✗ Missing: ${file.name}`);
      allExist = false;
    }
  });
  if (allExist) {
    console.log("✓ All files verified to exist");
  }
} catch (e) {
  console.log("✗ Error verifying files:", e.message);
}

// Verify file contents
console.log("\nStep 4: Verify file contents...");
try {
  let contentMatches = 0;
  files.forEach(file => {
    const filePath = join(subDir, file.name);
    const content = readFileSync(filePath, "utf8");
    if (content === file.content) {
      contentMatches++;
    } else {
      console.log(`  ✗ Content mismatch: ${file.name}`);
    }
  });
  console.log(`✓ ${contentMatches}/${files.length} files have correct content`);
} catch (e) {
  console.log("✗ Error verifying content:", e.message);
}

// Validate JSON file
console.log("\nStep 5: Validate JSON file...");
try {
  const jsonPath = join(subDir, "config.json");
  const content = readFileSync(jsonPath, "utf8");
  const parsed = JSON.parse(content);
  if (parsed.name === "agent5-test" && parsed.version === "1.0.0") {
    console.log("✓ JSON file is valid and correctly parsed");
    console.log(`  Config: name=${parsed.name}, version=${parsed.version}`);
  }
} catch (e) {
  console.log("✗ Error with JSON file:", e.message);
}

// Test file modifications
console.log("\nStep 6: Modify multiple files...");
try {
  // Append to README
  const readmePath = join(subDir, "README.md");
  const readmeContent = readFileSync(readmePath, "utf8");
  writeFileSync(readmePath, readmeContent + "\n\n## Modified\nThis file was modified.");

  // Update JSON
  const jsonPath = join(subDir, "config.json");
  const config = JSON.parse(readFileSync(jsonPath, "utf8"));
  config.modified = true;
  config.timestamp = new Date().toISOString();
  writeFileSync(jsonPath, JSON.stringify(config, null, 2));

  console.log("✓ Successfully modified 2 files");
} catch (e) {
  console.log("✗ Error modifying files:", e.message);
}

// Verify modifications
console.log("\nStep 7: Verify modifications...");
try {
  const readmePath = join(subDir, "README.md");
  const jsonPath = join(subDir, "config.json");

  const readmeHasModification = readFileSync(readmePath, "utf8").includes("Modified");
  const config = JSON.parse(readFileSync(jsonPath, "utf8"));
  const jsonHasModification = config.modified === true;

  if (readmeHasModification && jsonHasModification) {
    console.log("✓ All modifications verified");
  } else {
    console.log("✗ Some modifications not found");
  }
} catch (e) {
  console.log("✗ Error verifying modifications:", e.message);
}

// List directory contents
console.log("\nStep 8: List all created files...");
try {
  console.log("✓ Files in agent5-test-multi/:");
  files.forEach(file => {
    const filePath = join(subDir, file.name);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, "utf8");
      const size = content.length;
      console.log(`  - ${file.name} (${size} bytes)`);
    }
  });
} catch (e) {
  console.log("✗ Error listing files:", e.message);
}

console.log("\n=== Test Scenario 3 Complete ===");
