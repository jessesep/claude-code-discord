# Agent 3: Session Management Testing

**Test Agent:** Session Management Tester
**Agents Used:** cursor-coder, cursor-refactor, cursor-debugger, general-assistant
**Test File Prefix:** test-agent3-*
**Status:** Ready for Execution

## Test Setup

### Pre-requisites
1. Discord bot is running
2. No active agent sessions
3. Clean state for testing

### Initial State
```bash
rm -f test-agent3-*
```

## Test Scenarios

### Test 3.1: Start New Session

**Objective:** Verify session start command works correctly

**Steps:**
1. Check status (should be no session):
   ```
   /agent action:status
   ```

2. Start session:
   ```
   /agent action:start agent_name:cursor-coder
   ```

3. Check status again:
   ```
   /agent action:status
   ```

**Expected Results:**
- ✓ Initial status shows no active session
- ✓ Start command succeeds
- ✓ Confirmation message shows agent name, risk level, capabilities
- ✓ Session ID displayed
- ✓ Status command shows active session with cursor-coder

**Actual Results:** ___________

**Pass/Fail:** ___________

---

### Test 3.2: Get Agent Info

**Objective:** Verify agent info command provides complete details

**Steps:**
1. Get info for each agent:
   ```
   /agent action:info agent_name:cursor-coder
   /agent action:info agent_name:cursor-refactor
   /agent action:info agent_name:cursor-debugger
   /agent action:info agent_name:cursor-fast
   /agent action:info agent_name:general-assistant
   ```

**Expected Results:**
For each agent:
- ✓ Agent name displayed
- ✓ Description shown
- ✓ Model specified
- ✓ Temperature shown
- ✓ Risk level indicated
- ✓ Capabilities listed
- ✓ System prompt preview included
- ✓ Correct color coding by risk level

**Pass/Fail:** ___________

---

### Test 3.3: Switch Between Agents

**Objective:** Verify agent switching works and preserves/resets context appropriately

**Steps:**
1. Start with cursor-coder:
   ```
   /agent action:start agent_name:cursor-coder
   ```

2. Create file with first agent:
   ```
   Create test-agent3-switch.txt with "Created by cursor-coder"
   ```

3. Switch to cursor-refactor:
   ```
   /agent action:switch agent_name:cursor-refactor
   ```

4. Verify switch worked:
   ```
   /agent action:status
   ```

5. Test new agent:
   ```
   Add a line "Modified by cursor-refactor" to test-agent3-switch.txt
   ```

6. Switch to cursor-debugger:
   ```
   /agent action:switch agent_name:cursor-debugger
   ```

7. Test third agent:
   ```
   Analyze test-agent3-switch.txt for any potential issues
   ```

**Expected Results:**
- ✓ Initial session with cursor-coder works
- ✓ File created successfully
- ✓ Switch to cursor-refactor confirmed
- ✓ Status shows new agent
- ✓ File modification works with new agent
- ✓ Switch to cursor-debugger confirmed
- ✓ Analysis works with third agent
- ✓ Each switch shows previous and new agent names

**Verification:**
```bash
cat test-agent3-switch.txt
# Should contain both lines
```

**Pass/Fail:** ___________

---

### Test 3.4: End Session

**Objective:** Verify session end command works correctly

**Steps:**
1. Ensure active session exists

2. End session:
   ```
   /agent action:end
   ```

3. Check status:
   ```
   /agent action:status
   ```

4. Try to chat (should fail or require new session):
   ```
   Create test-agent3-after-end.txt with "test"
   ```

5. Start new session:
   ```
   /agent action:start agent_name:general-assistant
   ```

**Expected Results:**
- ✓ End command succeeds
- ✓ Confirmation message shows session ended
- ✓ Status shows no active session
- ✓ Chat without session shows appropriate message
- ✓ New session can be started
- ✓ New session is independent (different agent works)

**Pass/Fail:** ___________

---

### Test 3.5: List All Available Agents

**Objective:** Verify list command shows all agents with details

**Steps:**
1. Run list command:
   ```
   /agent action:list
   ```

**Expected Results:**
- ✓ All predefined agents shown:
  - code-reviewer
  - architect
  - debugger
  - security-expert
  - performance-optimizer
  - devops-engineer
  - general-assistant
  - cursor-coder
  - cursor-refactor
  - cursor-debugger
  - cursor-fast
- ✓ Each shows name, description, capabilities
- ✓ Risk levels color-coded (🟢 Low, 🟡 Medium, 🔴 High)
- ✓ Footer explains how to start session
- ✓ Legend explains risk levels

**Pass/Fail:** ___________

---

### Test 3.6: Session Isolation (Single User, Different Requests)

**Objective:** Verify sessions handle separate conversation threads

**Steps:**
1. Start session:
   ```
   /agent action:start agent_name:cursor-coder
   ```

2. Begin task A:
   ```
   I need you to create a web server for me
   ```

3. Start different task B in same session:
   ```
   Actually, forget that. Create test-agent3-math.ts with a calculator
   ```

4. Return to task A:
   ```
   Now back to the web server - create test-agent3-server.ts
   ```

**Expected Results:**
- ✓ Agent handles topic switch
- ✓ Both files created
- ✓ No confusion between tasks
- ✓ Agent can context-switch within same session

**Verification:**
```bash
ls test-agent3-math.ts test-agent3-server.ts
```

**Pass/Fail:** ___________

---

### Test 3.7: Rapid Session Operations

**Objective:** Verify system handles quick session changes

**Steps:**
1. Perform rapid operations:
   ```
   /agent action:start agent_name:cursor-coder
   /agent action:status
   /agent action:switch agent_name:cursor-refactor
   /agent action:status
   /agent action:switch agent_name:general-assistant
   /agent action:status
   /agent action:end
   /agent action:status
   /agent action:start agent_name:cursor-debugger
   /agent action:status
   ```

**Expected Results:**
- ✓ All commands processed
- ✓ No errors or timeouts
- ✓ Status always reflects current state
- ✓ No race conditions
- ✓ Final status shows cursor-debugger active

**Pass/Fail:** ___________

---

### Test 3.8: Session After Bot Restart

**Objective:** Verify session state after bot restart (if sessions are persisted)

**Steps:**
1. Start session and note session ID:
   ```
   /agent action:start agent_name:cursor-coder
   ```

2. Create a file:
   ```
   Create test-agent3-persist.txt
   ```

3. Check status before restart:
   ```
   /agent action:status
   ```

4. Restart the bot (if possible during test)

5. Check status after restart:
   ```
   /agent action:status
   ```

6. Try to continue conversation:
   ```
   Add a line to test-agent3-persist.txt
   ```

**Expected Results:**
Either:
- ✓ Session persists and conversation continues, OR
- ✓ Session is cleared and user must start new session
- ✓ Behavior is consistent and predictable
- ✓ No corrupted state

**Notes:** Document actual behavior - _________

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
ls -la test-agent3-*
```

### Cleanup
```bash
rm -rf test-agent3-*
```

### Issues Found

1. **Issue:** ___________
   - **Severity:** ___________
   - **Details:** ___________

### Observations

1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

### Recommendations

1. ___________________________________________
2. ___________________________________________
