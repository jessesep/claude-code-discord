# Master Test Execution Guide

**Project:** claude-code-discord
**Test Suite:** Parallel Cursor Agent Integration Testing
**Date:** 2026-01-06
**Status:** Ready for Execution

## Overview

This guide coordinates the execution of 5 parallel test agents that comprehensively test the Cursor agent integration in the Discord bot.

## Pre-Execution Checklist

### Environment Verification
- [ ] Discord bot is running (`ps aux | grep "deno.*index.ts"`)
- [ ] Bot is connected to Discord (check bot.log)
- [ ] Cursor CLI is installed (`cursor --version`)
- [ ] Working directory is clean (no test-agent* files)
- [ ] Git status is clean (if testing git integration)
- [ ] Discord channel is accessible (#main)

### Commands to Run
```bash
# Check bot status
ps aux | grep "deno.*index.ts" | grep -v grep

# Check bot log
tail -20 bot.log

# Verify Cursor CLI
cursor --version

# Clean test files
rm -f test-agent*

# Check git status
git status
```

## Test Agent Overview

| Agent | Focus Area | Primary Agents Used | Test Count | Est. Duration |
|-------|-----------|-------------------|-----------|--------------|
| Agent 1 | File Operations | cursor-coder | 8 tests | 15-20 min |
| Agent 2 | Conversation Flow | cursor-coder, general-assistant | 7 tests | 20-25 min |
| Agent 3 | Session Management | All agents | 8 tests | 15-20 min |
| Agent 4 | Error Handling | cursor-coder, cursor-fast | 11 tests | 20-25 min |
| Agent 5 | Integration | All Cursor agents | 8 tests | 30-40 min |
| **Total** | | | **42 tests** | **100-130 min** |

## Execution Strategy

### Sequential Execution (Recommended for Manual Testing)
Execute one agent's test suite at a time to avoid conflicts and clearly identify issues.

**Order:**
1. Agent 3 (Session Management) - Tests fundamental session operations
2. Agent 1 (File Operations) - Tests core file creation/modification
3. Agent 2 (Conversation Flow) - Tests natural chat and context
4. Agent 4 (Error Handling) - Tests error scenarios
5. Agent 5 (Integration) - Tests complete workflows

### Parallel Execution (For Automated Testing)
If using automated test framework, execute all agents concurrently:
- Stagger starts by 10 seconds each
- Use unique file prefixes (test-agent1-*, test-agent2-*, etc.)
- Monitor all outputs simultaneously
- Aggregate results at end

## Execution Instructions

### For Each Test Agent:

1. **Open Test Document**
   - Agent 1: `test-reports/agent1-file-operations.md`
   - Agent 2: `test-reports/agent2-conversation-flow.md`
   - Agent 3: `test-reports/agent3-session-management.md`
   - Agent 4: `test-reports/agent4-error-handling.md`
   - Agent 5: `test-reports/agent5-integration.md`

2. **Execute Tests Sequentially**
   - Follow steps in each test scenario
   - Record results (Pass/Fail)
   - Note any unexpected behavior
   - Capture error messages
   - Take screenshots of key moments

3. **Verify Results**
   - Run verification commands
   - Check file contents
   - Verify agent responses

4. **Document Findings**
   - Fill in Pass/Fail status
   - Record notes for each test
   - Document issues found
   - Note observations

5. **Clean Up**
   - Run cleanup commands
   - Prepare for next agent

## Test Execution Template

### Agent [N]: [Name]

```
Start Time: [HH:MM:SS]

Test 1: [Name] - PASS / FAIL
  Notes:

Test 2: [Name] - PASS / FAIL
  Notes:

[... continue for all tests ...]

End Time: [HH:MM:SS]
Duration: [MM:SS]

Tests Passed: [X] / [Total]
Tests Failed: [X] / [Total]

Issues Found:
1. [Issue description]
   Severity: Critical / High / Medium / Low
   Steps to reproduce:

Files Created: [count]
```

## Result Aggregation

After completing all test agents, aggregate results:

### Summary Statistics
```
Total Tests Executed: ___ / 42
Tests Passed: ___
Tests Failed: ___
Tests Skipped: ___
Pass Rate: ____%

Total Duration: ___ minutes
Average Test Duration: ___ seconds
```

### Issues by Severity
```
Critical Issues: ___
High Priority Issues: ___
Medium Priority Issues: ___
Low Priority Issues: ___
Total Issues: ___
```

### Coverage Analysis
```
✓ / ✗  File creation works
✓ / ✗  File modification works
✓ / ✗  File reading works
✓ / ✗  Natural chat flow works
✓ / ✗  Context retention works
✓ / ✗  Session start/end works
✓ / ✗  Agent switching works
✓ / ✗  Error handling works
✓ / ✗  Invalid input handling works
✓ / ✗  Multi-file projects work
✓ / ✗  Cross-agent workflows work
✓ / ✗  Git integration works
```

## Post-Execution Tasks

### 1. Create GitHub Issues
For each bug/issue found:
```bash
gh issue create \
  --title "[Bug] [Brief description]" \
  --body "**Description:**
  [Detailed description]

  **Steps to Reproduce:**
  1. [Step 1]
  2. [Step 2]

  **Expected Behavior:**
  [What should happen]

  **Actual Behavior:**
  [What actually happens]

  **Severity:** [Critical/High/Medium/Low]

  **Test:** [Agent N, Test X.Y]

  **Environment:**
  - Bot Version: [commit hash]
  - Cursor CLI: [version]
  - OS: [macOS version]" \
  --label "bug,cursor-integration"
```

### 2. Create Enhancement Issues
For improvements identified:
```bash
gh issue create \
  --title "[Enhancement] [Brief description]" \
  --body "**Use Case:**
  [Why this would be useful]

  **Proposed Solution:**
  [How to implement]

  **Benefits:**
  [What this improves]

  **Test:** [Agent N, Test X.Y]" \
  --label "enhancement,cursor-integration"
```

### 3. Generate Final Report
Use template in `test-reports/FINAL-REPORT-TEMPLATE.md`

### 4. Clean Up Test Artifacts
```bash
# Remove all test files
rm -f test-agent*

# Reset git if needed
git reset --hard

# Verify cleanup
ls test-agent* 2>/dev/null || echo "✓ All test files cleaned"
```

## Quick Reference

### Discord Bot Commands
```
/agent action:list                           # List all agents
/agent action:start agent_name:cursor-coder  # Start session
/agent action:chat message:Hello             # Chat with agent
/agent action:status                         # Check session status
/agent action:switch agent_name:cursor-refactor  # Switch agent
/agent action:end                            # End session
/agent action:info agent_name:cursor-coder   # Get agent info
```

### Natural Chat (After Session Start)
```
Just send regular messages without /agent prefix
The bot will respond using the active agent
```

### Verification Commands
```bash
# Check file exists
ls -la test-agent1-hello.txt

# Read file content
cat test-agent1-hello.txt

# Verify TypeScript syntax
deno check test-agent1-math.ts

# Validate JSON
deno eval "JSON.parse(Deno.readTextFileSync('test-agent1-config.json'))"

# Count files
ls test-agent1-* | wc -l

# Search file content
grep "function add" test-agent1-math.ts

# Git status
git status
```

## Troubleshooting

### Bot Not Responding
1. Check bot process: `ps aux | grep deno`
2. Check bot log: `tail -50 bot.log`
3. Restart if needed: `./start-bot.sh`

### Cursor CLI Errors
1. Verify installation: `cursor --version`
2. Check permissions: `which cursor`
3. Test manually: `cursor agent --print "hello"`

### Discord Permission Issues
1. Verify bot is in correct channel
2. Check channel ID in bot.log
3. Verify bot permissions in Discord

### Session Not Starting
1. End any existing sessions: `/agent action:end`
2. Check status: `/agent action:status`
3. Restart bot if needed

### Files Not Created
1. Check working directory: `pwd`
2. Verify Cursor has write permissions
3. Check Cursor CLI output for errors
4. Review bot messages for error details

## Success Criteria

### Must Pass (Critical)
- [ ] At least 35/42 tests pass (83% pass rate)
- [ ] No critical bugs that crash the bot
- [ ] File creation works reliably
- [ ] Session management works correctly
- [ ] Natural chat flow works

### Should Pass (Important)
- [ ] At least 38/42 tests pass (90% pass rate)
- [ ] Error handling works for all major cases
- [ ] Context retention works in conversations
- [ ] Cross-agent workflows function correctly
- [ ] Git integration works (if available)

### Nice to Have
- [ ] 100% test pass rate
- [ ] All edge cases handled
- [ ] Performance benchmarks met
- [ ] No minor UI/UX issues

## Notes and Observations

Use this space during execution to note patterns, trends, or insights:

```
[Timestamp] [Observation]

Example:
14:23 - cursor-fast responds ~30% faster than cursor-coder
14:45 - Natural chat works perfectly, no slash command needed after session start
15:10 - Found bug: switching agents doesn't preserve context (should it?)
```

---

**Remember:** The goal is comprehensive coverage, not perfection. Document everything, even if tests fail - that's valuable information!
