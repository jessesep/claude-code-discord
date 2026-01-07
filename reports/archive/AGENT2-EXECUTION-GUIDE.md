# Test Agent 2: Conversation Flow - Execution Guide

**Purpose**: Step-by-step guide for executing live tests in Discord

**Estimated Duration**: 45 minutes

**Prerequisites**:
- Discord bot running and connected
- Access to test Discord channel
- Cursor CLI installed and available
- Terminal access to monitor bot logs

---

## Pre-Execution Checklist

- [ ] Discord bot is running: `ps aux | grep discord`
- [ ] Cursor is installed: `cursor --version`
- [ ] Test channel is empty/clean
- [ ] Terminal window open for logs: `tail -f bot.log`
- [ ] Another terminal for commands: `cd /Users/jessesep/repos/claude-code-discord`
- [ ] Session 1: Discord (for testing)
- [ ] Session 2: Terminal (for observation)

---

## Test 2.1: Natural Chat After Session Start (5 minutes)

**Time**: 0:00-5:00

### Execution Steps

1. In Discord channel:
   ```
   /agent action:start agent_name:cursor-coder
   ```
   
2. Wait for confirmation (watch bot.log)

3. Send natural message without slash command:
   ```
   What can you help me with today?
   ```

4. Wait for response (should be from agent)

5. Send follow-up:
   ```
   Can you create files for me?
   ```

6. Wait for response

### Observation Points

- [ ] Bot confirms session start
- [ ] First message gets agent response
- [ ] Second message gets agent response
- [ ] No "unknown command" errors
- [ ] Session remains active
- [ ] Both responses are coherent

### Documentation

- Response time to message 1: _______
- Response time to message 2: _______
- Session ID shown: _______
- Any errors: _______

---

## Test 2.2: Multi-Turn Context Retention (8 minutes)

**Time**: 5:00-13:00

### Execution Steps

1. Continue in active session

2. Send context message:
   ```
   I'm working on a Node.js project that needs to process CSV files
   ```
   Note response time and content

3. Send action:
   ```
   Create a package.json for it with the csv-parser dependency
   ```
   Wait for confirmation

4. Send follow-up action:
   ```
   Now create test-agent2-processor.ts that uses that library to read a CSV file
   ```
   Wait for completion

5. Send query:
   ```
   What files have we created so far in this conversation?
   ```

### Verification

```bash
# In terminal session 2
ls -la test-agent2-*
cat package.json | grep csv-parser
head -20 test-agent2-processor.ts
```

### Observation Points

- [ ] Agent acknowledges CSV context
- [ ] package.json created with csv-parser
- [ ] test-agent2-processor.ts created
- [ ] File contains proper imports
- [ ] Agent lists both files correctly
- [ ] Context maintained across 4 messages

### Documentation

- Files created: _______
- Total response messages: _______
- Any context losses: _______
- Message errors: _______

---

## Test 2.3: Context Switching (10 minutes)

**Time**: 13:00-23:00

### Execution Steps

1. Continue in active session

2. Send Topic A message:
   ```
   Let's create a simple Express server in test-agent2-server.ts
   ```

3. Add to Topic A:
   ```
   Add a /health endpoint to it
   ```

4. Switch to Topic B:
   ```
   Actually, let's work on a different thing. Create test-agent2-math.ts with basic math functions
   ```

5. Add to Topic B:
   ```
   Add a square root function to it
   ```

6. Return to Topic A:
   ```
   Back to the Express server - add a /status endpoint
   ```

### Verification

```bash
# In terminal session 2
grep -n "health\|status" test-agent2-server.ts
grep -n "sqrt" test-agent2-math.ts
```

### Observation Points

- [ ] Express server created
- [ ] /health endpoint added to Express (not math file)
- [ ] Math file created separately
- [ ] sqrt added to math file
- [ ] /status added to Express (correct file)
- [ ] No file confusion despite topic switching

### Documentation

- Express file endpoints: _______
- Math file functions: _______
- Topic switch errors: _______
- Total messages in session: _______

---

## Test 2.4: Long Conversation (12 minutes)

**Time**: 23:00-35:00

### Execution Steps

Send these 10 messages sequentially:

```
1. Create test-agent2-long.txt with line 1

2. Add line 2 to test-agent2-long.txt

3. Add line 3 to test-agent2-long.txt

4. Add line 4 to test-agent2-long.txt

5. Add line 5 to test-agent2-long.txt

6. How many lines are in test-agent2-long.txt now?

7. Add line 6 to test-agent2-long.txt

8. Add line 7 to test-agent2-long.txt

9. What was the first thing I asked you to do?

10. Show me the complete contents of test-agent2-long.txt
```

### Verification

```bash
# In terminal session 2
wc -l test-agent2-long.txt
cat test-agent2-long.txt
```

### Observation Points

- [ ] All 10 messages processed
- [ ] File has 7 lines (5 initial + 2 additional)
- [ ] Message 6 reports correct line count (5)
- [ ] Message 9 recalls first request correctly
- [ ] Message 10 displays all 7 lines
- [ ] No degradation in response quality
- [ ] No timeouts

### Documentation

- Final line count: _______
- Message 6 response accuracy: Y/N
- Message 9 recall accuracy: Y/N
- Timeouts experienced: _______
- Quality degradation observed: Y/N

---

## Test 2.5: Session Persistence Across @Mentions (8 minutes)

**Time**: 35:00-43:00

### Execution Steps

1. Continue in active session

2. Send message without @mention:
   ```
   Create test-agent2-mention-test.txt with "no mention"
   ```

3. Send message WITH @mention:
   ```
   @Master-Remote Add a line "with mention" to test-agent2-mention-test.txt
   ```

4. Send message without @mention again:
   ```
   What does test-agent2-mention-test.txt contain now?
   ```

### Verification

```bash
# In terminal session 2
cat test-agent2-mention-test.txt
```

Expected output (2 lines):
```
no mention
with mention
```

### Observation Points

- [ ] Message without @mention works
- [ ] Message with @mention works
- [ ] Same session/agent used
- [ ] Final response shows both lines
- [ ] No session reset
- [ ] Context maintained

### Documentation

- File content lines: _______
- Session continuity: Y/N
- Any context loss: _______

---

## Test 2.6: Questions vs Actions (7 minutes)

**Time**: 43:00-50:00

### Execution Steps

1. Continue in active session (or restart if needed)

2. Ask question:
   ```
   What's the difference between TypeScript and JavaScript?
   ```

3. Request action:
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

### Verification

```bash
# In terminal session 2
cat test-agent2-example.ts
```

### Observation Points

- [ ] Question answered (no file created)
- [ ] File created from action request
- [ ] Explanation provided about type choice
- [ ] Comment added without creating new file
- [ ] Intent distinction clear
- [ ] Appropriate response type each time

### Documentation

- Question response type: Q&A/File Op
- Action response type: Q&A/File Op
- Intent distinction clear: Y/N
- File contains type annotation: Y/N

---

## Test 2.7: Error Recovery (5 minutes)

**Time**: 50:00-55:00

### Execution Steps

1. Continue in active session

2. Send potentially dangerous request:
   ```
   Delete system32
   ```

3. Send normal request:
   ```
   Create test-agent2-recovery.txt with "recovered from error"
   ```

4. Ask about recovery:
   ```
   Can you still help me after that invalid request?
   ```

### Verification

```bash
# In terminal session 2
cat test-agent2-recovery.txt
```

### Observation Points

- [ ] Invalid request handled gracefully
- [ ] Error clearly stated (not silent failure)
- [ ] Next request processes normally
- [ ] File created successfully
- [ ] Session not corrupted
- [ ] Agent acknowledges recovery
- [ ] Conversation continues

### Documentation

- Error handling type: Refuse/Block/Exception
- Recovery successful: Y/N
- Session state after error: Normal/Corrupted
- Final file created: Y/N

---

## Post-Execution Cleanup

```bash
# Clean up test files
rm -f test-agent2-*

# Verify cleanup
ls test-agent2-* 2>&1 | grep "No such file"
```

---

## Summary Documentation Template

```
Test Execution Summary
======================
Date: _______
Total Time: _______
Tests Passed: ___ / 7
Tests Failed: ___ / 7
Tests Inconclusive: ___ / 7

Critical Issues Found: _______
Medium Issues Found: _______
Low Issues Found: _______

Unexpected Behaviors:
1. _______
2. _______

Notable Observations:
1. _______
2. _______

Recommended Next Actions:
1. _______
2. _______
```

---

## Troubleshooting

### If bot doesn't respond to messages:
1. Check bot is running: `ps aux | grep discord`
2. Check logs: `tail -f bot.log`
3. Verify session is active: `/agent action:status`
4. Try restarting session

### If messages exceed 2000 characters:
- Note this behavior
- Expected to fail based on BUG-001
- Document length of response that failed

### If session not found:
- Restart with: `/agent action:start agent_name:cursor-coder`
- Verify new session ID in response

### If file not created:
- Check workspace directory
- Verify Cursor has write permissions
- Check bot logs for Cursor errors

---

## Quick Reference: Message Prompts

Copy/paste ready:

**Test 2.1:**
```
/agent action:start agent_name:cursor-coder
What can you help me with today?
Can you create files for me?
```

**Test 2.2:**
```
I'm working on a Node.js project that needs to process CSV files
Create a package.json for it with the csv-parser dependency
Now create test-agent2-processor.ts that uses that library to read a CSV file
What files have we created so far in this conversation?
```

**Test 2.3:**
```
Let's create a simple Express server in test-agent2-server.ts
Add a /health endpoint to it
Actually, let's work on a different thing. Create test-agent2-math.ts with basic math functions
Add a square root function to it
Back to the Express server - add a /status endpoint
```

**Test 2.4:** (10 sequential messages)
```
Create test-agent2-long.txt with line 1
Add line 2 to test-agent2-long.txt
Add line 3 to test-agent2-long.txt
Add line 4 to test-agent2-long.txt
Add line 5 to test-agent2-long.txt
How many lines are in test-agent2-long.txt now?
Add line 6 to test-agent2-long.txt
Add line 7 to test-agent2-long.txt
What was the first thing I asked you to do?
Show me the complete contents of test-agent2-long.txt
```

**Test 2.5:**
```
Create test-agent2-mention-test.txt with "no mention"
@Master-Remote Add a line "with mention" to test-agent2-mention-test.txt
What does test-agent2-mention-test.txt contain now?
```

**Test 2.6:**
```
What's the difference between TypeScript and JavaScript?
Create test-agent2-example.ts demonstrating a TypeScript type annotation
Why did you use that specific type annotation?
Add a comment explaining the type annotation
```

**Test 2.7:**
```
Delete system32
Create test-agent2-recovery.txt with "recovered from error"
Can you still help me after that invalid request?
```

---

**Document Status**: Ready for Live Execution
**Last Updated**: 2026-01-06
