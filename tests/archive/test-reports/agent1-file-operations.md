# Agent 1: File Operations Testing

**Test Agent:** File Operations Tester
**Primary Cursor Agent:** cursor-coder
**Test File Prefix:** test-agent1-*
**Status:** Ready for Execution

## Test Setup

### Pre-requisites
1. Discord bot is running
2. Cursor CLI is installed and accessible
3. User has access to Discord channel #main
4. Workspace: `/Users/jessesep/repos/claude-code-discord`

### Initial State
```bash
# Clean up any existing test files
rm -f test-agent1-*
```

## Test Scenarios

### Test 1.1: Create Simple Text File

**Objective:** Verify Cursor agent can create a basic text file

**Steps:**
1. Start Cursor agent session:
   ```
   /agent action:start agent_name:cursor-coder
   ```

2. Send creation request:
   ```
   Create a file called test-agent1-hello.txt with the content "Hello from Cursor Agent 1! Testing file creation."
   ```

**Expected Results:**
- ✓ Session starts successfully
- ✓ Agent acknowledges the request
- ✓ File `test-agent1-hello.txt` is created
- ✓ File contains exact content specified
- ✓ Agent reports completion

**Verification:**
```bash
cat test-agent1-hello.txt
# Should output: Hello from Cursor Agent 1! Testing file creation.
```

**Pass/Fail:** ___________
**Notes:** ___________________________________________

---

### Test 1.2: Create TypeScript File with Function

**Objective:** Verify agent can create valid TypeScript code

**Steps:**
1. Continue in same session (or start new if needed)

2. Send request:
   ```
   Create test-agent1-math.ts with a TypeScript function called add that takes two numbers and returns their sum. Include proper type annotations.
   ```

**Expected Results:**
- ✓ File `test-agent1-math.ts` created
- ✓ Contains valid TypeScript syntax
- ✓ Function has proper type annotations
- ✓ Function logic is correct

**Verification:**
```bash
cat test-agent1-math.ts
deno check test-agent1-math.ts  # Verify TypeScript is valid
```

**Pass/Fail:** ___________
**Notes:** ___________________________________________

---

### Test 1.3: Modify Existing File

**Objective:** Verify agent can modify existing files while preserving content

**Steps:**
1. Continue in same session

2. Send modification request:
   ```
   Add a multiply function to test-agent1-math.ts that takes two numbers and returns their product. Keep the existing add function.
   ```

**Expected Results:**
- ✓ Original `add` function still exists
- ✓ New `multiply` function added
- ✓ Both functions have proper types
- ✓ File syntax still valid
- ✓ Agent doesn't remove existing code

**Verification:**
```bash
cat test-agent1-math.ts
grep -q "function add" test-agent1-math.ts && echo "✓ Add function preserved"
grep -q "function multiply" test-agent1-math.ts && echo "✓ Multiply function added"
```

**Pass/Fail:** ___________
**Notes:** ___________________________________________

---

### Test 1.4: Read and Analyze File

**Objective:** Verify agent can read and understand file contents

**Steps:**
1. Continue in same session

2. Send analysis request:
   ```
   Read test-agent1-math.ts and tell me what functions it contains and what each one does.
   ```

**Expected Results:**
- ✓ Agent reads the file
- ✓ Correctly identifies `add` function
- ✓ Correctly identifies `multiply` function
- ✓ Describes what each function does
- ✓ Mentions parameter types

**Verification:**
Manual review of agent response

**Pass/Fail:** ___________
**Notes:** ___________________________________________

---

### Test 1.5: Create Multiple Related Files

**Objective:** Verify agent can create multiple files in one request

**Steps:**
1. Continue in same session

2. Send multi-file request:
   ```
   Create two files:
   1. test-agent1-config.json with sample configuration: {"name": "test-agent", "version": "1.0", "enabled": true}
   2. test-agent1-readme.md explaining what the config file is for
   ```

**Expected Results:**
- ✓ Both files created
- ✓ JSON file has valid JSON syntax
- ✓ JSON contains specified keys and values
- ✓ README file explains the config
- ✓ Files are related/coherent

**Verification:**
```bash
cat test-agent1-config.json
cat test-agent1-readme.md
deno eval "JSON.parse(Deno.readTextFileSync('test-agent1-config.json'))" # Validate JSON
```

**Pass/Fail:** ___________
**Notes:** ___________________________________________

---

### Test 1.6: Create File in Subdirectory

**Objective:** Verify agent can create files in specific paths

**Steps:**
1. Continue in same session

2. Send request:
   ```
   Create a directory called test-agent1-subdir and create test-agent1-subdir/nested.txt inside it with content "Nested file test"
   ```

**Expected Results:**
- ✓ Directory `test-agent1-subdir/` created
- ✓ File created in subdirectory
- ✓ File contains correct content
- ✓ Path handling is correct

**Verification:**
```bash
ls -la test-agent1-subdir/
cat test-agent1-subdir/nested.txt
```

**Pass/Fail:** ___________
**Notes:** ___________________________________________

---

### Test 1.7: Create Different File Types

**Objective:** Verify agent handles multiple file types correctly

**Steps:**
1. Continue in same session

2. Send request:
   ```
   Create three files:
   - test-agent1-data.json with array of 3 sample users
   - test-agent1-styles.css with a simple button style
   - test-agent1-script.js with a hello world console.log
   ```

**Expected Results:**
- ✓ All three files created
- ✓ JSON is valid
- ✓ CSS is valid
- ✓ JS is valid
- ✓ Each file has appropriate content for its type

**Verification:**
```bash
ls -la test-agent1-*
cat test-agent1-data.json
cat test-agent1-styles.css
cat test-agent1-script.js
```

**Pass/Fail:** ___________
**Notes:** ___________________________________________

---

### Test 1.8: Error Handling - Invalid File Operation

**Objective:** Verify agent handles errors gracefully

**Steps:**
1. Continue in same session

2. Send invalid request:
   ```
   Modify test-agent1-nonexistent-file.txt by adding a line
   ```

**Expected Results:**
- ✓ Agent recognizes file doesn't exist
- ✓ Clear error message provided
- ✓ No crash or unexpected behavior
- ✓ Agent suggests creating the file or checking the name

**Verification:**
Manual review of error response

**Pass/Fail:** ___________
**Notes:** ___________________________________________

---

## Test Summary

### Execution Metadata
- **Start Time:** ___________
- **End Time:** ___________
- **Duration:** ___________
- **Total Tests:** 8
- **Tests Passed:** ___________
- **Tests Failed:** ___________
- **Tests Skipped:** ___________

### Files Created (for cleanup)
```bash
# List all test files created
ls -la test-agent1-*
```

### Cleanup Command
```bash
# Run after all tests
rm -rf test-agent1-*
```

### Issues Found

1. **Issue #:** ___________
   - **Severity:** Critical / High / Medium / Low
   - **Description:** ___________
   - **Reproduction Steps:** ___________
   - **Expected:** ___________
   - **Actual:** ___________

### Observations & Improvements

1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

### Recommendations

1. ___________________________________________
2. ___________________________________________
3. ___________________________________________
