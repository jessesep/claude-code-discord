# Agent 5: Integration Testing

**Test Agent:** Integration Tester
**Agents Used:** All Cursor agents (cursor-coder, cursor-refactor, cursor-debugger, cursor-fast)
**Test File Prefix:** test-agent5-*
**Status:** Ready for Execution

## Test Setup

### Pre-requisites
1. Discord bot is running
2. Git is available (for git integration tests)
3. Cursor CLI accessible
4. Clean workspace

### Initial State
```bash
rm -f test-agent5-*
```

## Test Scenarios

### Test 5.1: Full Workflow - Feature Development

**Objective:** Verify complete feature development workflow using cursor-coder

**Steps:**
1. Start cursor-coder:
   ```
   /agent action:start agent_name:cursor-coder
   ```

2. Request feature scaffold:
   ```
   Create a simple Express.js REST API with:
   - File: test-agent5-api.ts
   - A /hello GET endpoint that returns JSON with message "Hello World"
   - A /user/:id GET endpoint that returns user info
   - Proper TypeScript types
   - Error handling middleware
   ```

3. Request tests:
   ```
   Create test-agent5-api.test.ts with tests for both endpoints
   ```

4. Request documentation:
   ```
   Create test-agent5-api-readme.md documenting the API endpoints
   ```

**Expected Results:**
- ✓ API file created with proper structure
- ✓ Both endpoints implemented
- ✓ TypeScript types defined
- ✓ Error handling included
- ✓ Test file created with test cases
- ✓ Documentation created
- ✓ All files are coherent and related
- ✓ Code quality is good

**Verification:**
```bash
cat test-agent5-api.ts
cat test-agent5-api.test.ts
cat test-agent5-api-readme.md
deno check test-agent5-api.ts
```

**Pass/Fail:** ___________

---

### Test 5.2: Full Workflow - Bug Fix

**Objective:** Verify bug identification and fixing using cursor-debugger

**Steps:**
1. Create buggy code file:
   ```bash
   cat > test-agent5-buggy.ts << 'EOF'
   export function calculateTotal(items: number[]): number {
     let total = 0;
     for (let i = 0; i <= items.length; i++) {  // Bug: should be < not <=
       total += items[i];
     }
     return total;
   }
   EOF
   ```

2. Switch to cursor-debugger:
   ```
   /agent action:switch agent_name:cursor-debugger
   ```

3. Request bug analysis:
   ```
   Analyze test-agent5-buggy.ts and find any bugs in the calculateTotal function. Explain what's wrong and fix it.
   ```

4. Request test to verify fix:
   ```
   Create test-agent5-buggy.test.ts to verify the fix works correctly
   ```

**Expected Results:**
- ✓ Agent identifies the <= vs < bug
- ✓ Explains the off-by-one error
- ✓ Fixes the bug correctly
- ✓ Creates test to verify fix
- ✓ Test passes after fix

**Verification:**
```bash
cat test-agent5-buggy.ts | grep "i < items.length"  # Should use < not <=
cat test-agent5-buggy.test.ts
```

**Pass/Fail:** ___________

---

### Test 5.3: Full Workflow - Refactoring

**Objective:** Verify code improvement using cursor-refactor

**Steps:**
1. Create messy code:
   ```bash
   cat > test-agent5-messy.ts << 'EOF'
   function x(a,b,c){let d=a+b;let e=d*c;return e;}
   function y(a){if(a>0){return true}else{return false}}
   function z(arr){let result=[];for(let i=0;i<arr.length;i++){result.push(arr[i]*2)}return result}
   EOF
   ```

2. Switch to cursor-refactor:
   ```
   /agent action:switch agent_name:cursor-refactor
   ```

3. Request refactoring:
   ```
   Refactor test-agent5-messy.ts to improve:
   - Variable names (make them descriptive)
   - Function names (make them clear)
   - Code formatting (proper spacing, line breaks)
   - Add TypeScript type annotations
   - Add JSDoc comments
   - Simplify logic where possible
   ```

4. Request comparison:
   ```
   Explain the improvements you made to test-agent5-messy.ts
   ```

**Expected Results:**
- ✓ Descriptive variable names used
- ✓ Clear function names
- ✓ Proper formatting applied
- ✓ TypeScript types added
- ✓ Comments added
- ✓ Logic simplified (e.g., `y` function becomes `return a > 0`)
- ✓ Functionality preserved
- ✓ Clear explanation of improvements

**Verification:**
```bash
cat test-agent5-messy.ts
deno check test-agent5-messy.ts
```

**Pass/Fail:** ___________

---

### Test 5.4: Cross-Agent Workflow

**Objective:** Verify smooth transitions between different agents

**Steps:**
1. Start with cursor-coder to create:
   ```
   /agent action:start agent_name:cursor-coder
   Create test-agent5-calculator.ts with add, subtract, multiply, divide functions
   ```

2. Switch to cursor-refactor to improve:
   ```
   /agent action:switch agent_name:cursor-refactor
   Add input validation to all functions in test-agent5-calculator.ts
   ```

3. Switch to cursor-debugger to test:
   ```
   /agent action:switch agent_name:cursor-debugger
   Create test-agent5-calculator.test.ts with tests including edge cases (division by zero, etc.)
   ```

4. Switch to cursor-fast for quick fix:
   ```
   /agent action:switch agent_name:cursor-fast
   Add a power function to test-agent5-calculator.ts
   ```

**Expected Results:**
- ✓ All agent switches successful
- ✓ Each agent completes its task
- ✓ File modified by multiple agents correctly
- ✓ No conflicts or corruption
- ✓ Final file has all requested features:
  - Original 4 functions
  - Input validation
  - Tests
  - Power function

**Verification:**
```bash
cat test-agent5-calculator.ts
cat test-agent5-calculator.test.ts
grep -E "(add|subtract|multiply|divide|power)" test-agent5-calculator.ts
```

**Pass/Fail:** ___________

---

### Test 5.5: Git Integration

**Objective:** Verify Cursor agents work with git operations

**Steps:**
1. Start cursor-coder:
   ```
   /agent action:start agent_name:cursor-coder
   ```

2. Create files:
   ```
   Create test-agent5-feature.ts with a simple feature
   ```

3. Check git status (if /git command exists):
   ```
   /git action:status
   ```

4. Stage and commit (if available):
   ```
   /git action:commit message:Add test-agent5-feature.ts
   ```

5. Create more files:
   ```
   Create test-agent5-feature2.ts with another feature
   ```

6. Check git diff:
   ```
   /git action:diff
   ```

**Expected Results:**
- ✓ Files created by Cursor agent
- ✓ Git recognizes new files
- ✓ Files can be committed
- ✓ Git diff shows changes
- ✓ No conflicts between Cursor and git operations

**Verification:**
```bash
git status
git log --oneline -5
```

**Pass/Fail:** ___________

---

### Test 5.6: Complex Multi-File Project

**Objective:** Verify agent can handle complex, multi-file project creation

**Steps:**
1. Start cursor-coder:
   ```
   /agent action:start agent_name:cursor-coder
   ```

2. Request complete project:
   ```
   Create a simple TODO app with:
   - test-agent5-todo-types.ts: TypeScript interfaces for Todo
   - test-agent5-todo-store.ts: In-memory todo storage class
   - test-agent5-todo-api.ts: Express API with CRUD endpoints
   - test-agent5-todo-readme.md: Documentation

   Make sure all files work together and imports are correct.
   ```

**Expected Results:**
- ✓ All 4 files created
- ✓ Type definitions in types file
- ✓ Store class uses types from types file
- ✓ API uses store and types
- ✓ Imports are correct
- ✓ Files are coherent
- ✓ Documentation explains the structure

**Verification:**
```bash
ls test-agent5-todo-*
cat test-agent5-todo-readme.md
grep "import" test-agent5-todo-*.ts
deno check test-agent5-todo-api.ts
```

**Pass/Fail:** ___________

---

### Test 5.7: Performance - Rapid Operations

**Objective:** Verify system performance under rapid operations

**Steps:**
1. Start cursor-fast (for speed):
   ```
   /agent action:start agent_name:cursor-fast
   ```

2. Request multiple files quickly:
   ```
   Request 1: Create test-agent5-file1.txt with "content 1"
   Request 2: Create test-agent5-file2.txt with "content 2"
   Request 3: Create test-agent5-file3.txt with "content 3"
   Request 4: Create test-agent5-file4.txt with "content 4"
   Request 5: Create test-agent5-file5.txt with "content 5"
   Request 6: Create test-agent5-file6.txt with "content 6"
   Request 7: Create test-agent5-file7.txt with "content 7"
   Request 8: Create test-agent5-file8.txt with "content 8"
   Request 9: Create test-agent5-file9.txt with "content 9"
   Request 10: Create test-agent5-file10.txt with "content 10"
   ```

3. Time the completion

**Expected Results:**
- ✓ All 10 files created
- ✓ Each has correct content
- ✓ Reasonable completion time (< 5 minutes total)
- ✓ No errors or timeouts
- ✓ No lost requests

**Verification:**
```bash
ls test-agent5-file*.txt | wc -l  # Should be 10
cat test-agent5-file5.txt  # Should contain "content 5"
```

**Completion Time:** ___________

**Pass/Fail:** ___________

---

### Test 5.8: Error Recovery in Complex Workflow

**Objective:** Verify workflow continues after errors

**Steps:**
1. Start cursor-coder:
   ```
   /agent action:start agent_name:cursor-coder
   ```

2. Request complex feature:
   ```
   Create test-agent5-workflow.ts with a database connection class
   ```

3. Request impossible addition:
   ```
   Connect it to Oracle database running on the moon
   ```

4. Continue with valid request:
   ```
   Add a simple query method to test-agent5-workflow.ts that returns mock data
   ```

5. Request related file:
   ```
   Create test-agent5-workflow.test.ts with tests for the query method
   ```

**Expected Results:**
- ✓ Initial file created
- ✓ Impossible request handled (error or reasonable explanation)
- ✓ Workflow continues after error
- ✓ Query method added successfully
- ✓ Test file created
- ✓ No workflow corruption

**Verification:**
```bash
cat test-agent5-workflow.ts
cat test-agent5-workflow.test.ts
```

**Pass/Fail:** ___________

---

## Test Summary

### Execution Metadata
- **Start Time:** ___________
- **End Time:** ___________
- **Duration:** ___________
- **Total Tests:** 8
- **Tests Passed:** ___________
- **Tests Failed:** ___________

### Files Created
```bash
ls -la test-agent5-* | wc -l
ls -la test-agent5-*
```

### Cleanup
```bash
rm -rf test-agent5-*
git reset --hard  # If git tests were run
```

### Performance Metrics

- **Average Response Time:** ___________
- **Fastest Response:** ___________
- **Slowest Response:** ___________
- **Total Files Created:** ___________

### Issues Found

1. **Issue:** ___________
   - **Severity:** ___________
   - **Details:** ___________

### Integration Points Tested

- [ ] Cursor agent file creation
- [ ] Cursor agent file modification
- [ ] Cursor agent file reading/analysis
- [ ] Cross-agent workflows
- [ ] Git integration
- [ ] Multi-file project creation
- [ ] Error recovery
- [ ] Performance under load

### Observations

1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

### Recommendations

1. ___________________________________________
2. ___________________________________________
3. ___________________________________________
