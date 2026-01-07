# Agent 2: Conversation Flow Testing

**Test Agent:** Conversation Flow Tester
**Primary Agents:** cursor-coder, general-assistant
**Test File Prefix:** test-agent2-*
**Status:** Ready for Execution

## Test Setup

### Pre-requisites
1. Discord bot is running
2. Fresh Discord channel state (no active sessions)
3. User account ready for testing

### Initial State
```bash
# Clean up any existing test files
rm -f test-agent2-*
```

## Test Scenarios

### Test 2.1: Natural Chat After Session Start

**Objective:** Verify users can chat naturally without slash commands after starting a session

**Steps:**
1. Start agent session:
   ```
   /agent action:start agent_name:cursor-coder
   ```

2. Wait for confirmation

3. Send regular message (NO slash command):
   ```
   What can you help me with today?
   ```

4. Send follow-up:
   ```
   Can you create files for me?
   ```

**Expected Results:**
- ✓ Session starts successfully
- ✓ First message (no slash) gets agent response
- ✓ Second message (no slash) gets agent response
- ✓ No "unknown command" errors
- ✓ No requirement to use `/agent action:chat`

**Actual Results:** ___________

**Pass/Fail:** ___________

---

### Test 2.2: Multi-Turn Context Retention

**Objective:** Verify agent remembers context across multiple messages

**Steps:**
1. Start session:
   ```
   /agent action:start agent_name:cursor-coder
   ```

2. Message 1:
   ```
   I'm working on a Node.js project that needs to process CSV files
   ```

3. Message 2 (relies on context):
   ```
   Create a package.json for it with the csv-parser dependency
   ```

4. Message 3 (relies on previous context):
   ```
   Now create test-agent2-processor.ts that uses that library to read a CSV file
   ```

5. Message 4:
   ```
   What files have we created so far in this conversation?
   ```

**Expected Results:**
- ✓ Agent acknowledges Node.js/CSV context in message 1
- ✓ package.json created with csv-parser (message 2)
- ✓ TypeScript file created using csv-parser (message 3)
- ✓ Agent lists both files created (message 4)
- ✓ Context maintained across all messages

**Verification:**
```bash
cat package.json
cat test-agent2-processor.ts
grep -q "csv-parser" package.json
```

**Pass/Fail:** ___________

---

### Test 2.3: Context Switching Between Topics

**Objective:** Verify agent can handle topic changes

**Steps:**
1. Continue in same session

2. Topic A - Message 1:
   ```
   Let's create a simple Express server in test-agent2-server.ts
   ```

3. Topic A - Message 2:
   ```
   Add a /health endpoint to it
   ```

4. Topic B - Message 3 (switch topic):
   ```
   Actually, let's work on a different thing. Create test-agent2-math.ts with basic math functions
   ```

5. Topic B - Message 4:
   ```
   Add a square root function to it
   ```

6. Topic A - Message 5 (return to first topic):
   ```
   Back to the Express server - add a /status endpoint
   ```

**Expected Results:**
- ✓ Express server created (topic A)
- ✓ /health endpoint added
- ✓ Math file created (topic B switch)
- ✓ Square root added to math file
- ✓ /status endpoint added to Express file (not math file)
- ✓ Agent correctly identifies which file to modify

**Verification:**
```bash
cat test-agent2-server.ts | grep -E "(health|status)"
cat test-agent2-math.ts | grep "sqrt"
```

**Pass/Fail:** ___________

---

### Test 2.4: Long Conversation Handling

**Objective:** Verify agent handles extended conversations without degradation

**Steps:**
1. Continue in same session

2. Send 10 consecutive messages:
   ```
   Message 1: Create test-agent2-long.txt with line 1
   Message 2: Add line 2 to test-agent2-long.txt
   Message 3: Add line 3 to test-agent2-long.txt
   Message 4: Add line 4 to test-agent2-long.txt
   Message 5: Add line 5 to test-agent2-long.txt
   Message 6: How many lines are in test-agent2-long.txt now?
   Message 7: Add line 6 to test-agent2-long.txt
   Message 8: Add line 7 to test-agent2-long.txt
   Message 9: What was the first thing I asked you to do?
   Message 10: Show me the complete contents of test-agent2-long.txt
   ```

**Expected Results:**
- ✓ All messages processed successfully
- ✓ File contains 7 lines
- ✓ Message 6 correctly reports 5 lines at that point
- ✓ Message 9 correctly recalls first request
- ✓ Message 10 shows all 7 lines
- ✓ No errors or timeouts
- ✓ Response quality doesn't degrade

**Verification:**
```bash
wc -l test-agent2-long.txt  # Should show 7 lines
cat test-agent2-long.txt
```

**Pass/Fail:** ___________

---

### Test 2.5: Session Persistence Across @Mentions

**Objective:** Verify session works with both natural chat and @mentions

**Steps:**
1. Ensure session is still active

2. Send without @mention:
   ```
   Create test-agent2-mention-test.txt with "no mention"
   ```

3. Send WITH @mention:
   ```
   @Master-Remote Add a line "with mention" to test-agent2-mention-test.txt
   ```

4. Send without @mention again:
   ```
   What does test-agent2-mention-test.txt contain now?
   ```

**Expected Results:**
- ✓ Message without @mention works
- ✓ Message with @mention works
- ✓ Both use same session/agent
- ✓ Final response shows both lines
- ✓ No session reset or confusion

**Verification:**
```bash
cat test-agent2-mention-test.txt
# Should contain both "no mention" and "with mention"
```

**Pass/Fail:** ___________

---

### Test 2.6: Response to Questions vs Actions

**Objective:** Verify agent handles both questions and action requests

**Steps:**
1. Continue in same session

2. Ask a question:
   ```
   What's the difference between TypeScript and JavaScript?
   ```

3. Request an action:
   ```
   Create test-agent2-example.ts demonstrating a TypeScript type annotation
   ```

4. Ask about the action:
   ```
   Why did you use that specific type annotation?
   ```

5. Request related action:
   ```
   Add a comment explaining the type annotation
   ```

**Expected Results:**
- ✓ Question answered appropriately
- ✓ File created correctly
- ✓ Explanation provided
- ✓ Comment added to file
- ✓ Agent distinguishes between Q&A and file operations

**Verification:**
```bash
cat test-agent2-example.ts
# Should have type annotation with explanatory comment
```

**Pass/Fail:** ___________

---

### Test 2.7: Error Recovery in Conversation

**Objective:** Verify conversation continues after errors

**Steps:**
1. Continue in same session

2. Send invalid request:
   ```
   Delete system32
   ```

3. Send normal request:
   ```
   Create test-agent2-recovery.txt with "recovered from error"
   ```

4. Reference the error:
   ```
   Can you still help me after that invalid request?
   ```

**Expected Results:**
- ✓ Invalid request handled gracefully (error or refusal)
- ✓ Next valid request works fine
- ✓ Session not corrupted
- ✓ Agent acknowledges recovery
- ✓ Conversation continues normally

**Verification:**
```bash
cat test-agent2-recovery.txt
```

**Pass/Fail:** ___________

---

## Test Summary

### Execution Metadata
- **Start Time:** ___________
- **End Time:** ___________
- **Duration:** ___________
- **Total Tests:** 7
- **Tests Passed:** ___________
- **Tests Failed:** ___________

### Files Created
```bash
ls -la test-agent2-*
```

### Cleanup
```bash
rm -rf test-agent2-*
```

### Issues Found

1. **Issue:** ___________
   - **Severity:** ___________
   - **Description:** ___________

### Observations

1. ___________________________________________
2. ___________________________________________

### Recommendations

1. ___________________________________________
2. ___________________________________________
