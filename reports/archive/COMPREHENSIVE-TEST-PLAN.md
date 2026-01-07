# Comprehensive Testing Plan for Cursor Discord Integration

**Date**: 2026-01-06
**Orchestrator**: Test Orchestrator Agent
**Target**: claude-code-discord bot with Cursor CLI integration

## Executive Summary

This document outlines a comprehensive parallel testing strategy for the Discord bot's Cursor agent integration. Testing focuses on 5 key areas with specific scenarios for each.

## Test Architecture

### Parallel Testing Strategy
- 5 specialized test areas running concurrently
- Each area tests different aspects of the integration
- Coordinated to avoid conflicts using unique test file names
- All tests executed via Discord slash commands and natural chat

---

## Test Area 1: File Operations

**Objective**: Verify Cursor agents can create, read, and modify files correctly

### Test Scenarios

#### T1.1: Create New File
- **Command**: `/agent action:start agent_name:cursor-coder`
- **Follow-up**: "Create a new file test-file-ops-1.ts with a simple hello world function"
- **Expected**: File created with correct content
- **Validation**: Check file exists and contains requested function

#### T1.2: Modify Existing File
- **Command**: Natural chat after session start
- **Message**: "Add a comment to the function you just created"
- **Expected**: File modified with comment added
- **Validation**: File content includes comment

#### T1.3: Create Multiple File Types
- **Messages**:
  - "Create test-data-1.json with sample data"
  - "Create test-docs-1.md with documentation"
  - "Create test-config-1.yaml with configuration"
- **Expected**: All files created with appropriate content
- **Validation**: Verify each file type is correctly formatted

#### T1.4: File with Complex Content
- **Message**: "Create a TypeScript interface file test-types-1.ts with 3 different interfaces"
- **Expected**: Valid TypeScript with proper syntax
- **Validation**: File should pass TypeScript compilation

---

## Test Area 2: Conversation Flow

**Objective**: Test multi-turn conversations and context retention

### Test Scenarios

#### T2.1: Basic Multi-Turn Conversation
- **Turn 1**: `/agent action:start agent_name:cursor-coder`
- **Turn 2**: "Create a file test-conv-1.ts with a Counter class"
- **Turn 3**: "Add a decrement method to the Counter class"
- **Expected**: Agent remembers the Counter class from Turn 2
- **Validation**: File contains both increment (default) and decrement methods

#### T2.2: Context Retention Across Changes
- **Turn 1**: Start session
- **Turn 2**: "Create test-conv-2.ts with a function calculateSum"
- **Turn 3**: "Now add error handling to that function"
- **Turn 4**: "Add TypeScript types to the function parameters"
- **Expected**: Each change builds on previous state
- **Validation**: Final file has all improvements

#### T2.3: Natural Chat Flow After Session Start
- **Setup**: Start cursor-coder session via slash command
- **Test**: Send multiple messages WITHOUT using slash commands
- **Expected**: Bot responds to each message naturally
- **Validation**: No errors, agent processes each message

#### T2.4: Complex Instruction Following
- **Message**: "Create a TypeScript module test-conv-3.ts that exports a class UserManager with methods to add, remove, and list users. Use an array to store users."
- **Expected**: Complete implementation matching all requirements
- **Validation**: Code includes all requested features

---

## Test Area 3: Session Management

**Objective**: Verify session lifecycle and switching capabilities

### Test Scenarios

#### T3.1: Session Start and Status
- **Command**: `/agent action:start agent_name:cursor-coder`
- **Followup**: `/agent action:status`
- **Expected**: Status shows active session
- **Validation**: Correct agent name displayed

#### T3.2: Switch Between Agents
- **Command 1**: `/agent action:start agent_name:cursor-coder`
- **Message**: "Create test-switch-1.ts"
- **Command 2**: `/agent action:switch agent_name:cursor-refactor`
- **Message**: "Refactor the test-switch-1.ts file to use better naming"
- **Expected**: Second agent operates on file from first agent
- **Validation**: File is modified by refactoring agent

#### T3.3: End Session
- **Setup**: Start active session
- **Command**: `/agent action:end`
- **Follow-up**: Send a regular message
- **Expected**: Session ends, bot doesn't respond to message
- **Validation**: Status shows no active session

#### T3.4: Concurrent Sessions in Different Channels
- **Not feasible with current setup** - requires multiple channels
- **Alternative**: Test session isolation by user ID

#### T3.5: Session Info Command
- **Command**: `/agent action:start agent_name:cursor-debugger`
- **Follow-up**: `/agent action:info agent_name:cursor-debugger`
- **Expected**: Detailed agent information displayed
- **Validation**: Info matches predefined agent config

---

## Test Area 4: Error Handling and Edge Cases

**Objective**: Test system behavior under error conditions

### Test Scenarios

#### T4.1: Invalid Agent Name
- **Command**: `/agent action:start agent_name:invalid-agent-name`
- **Expected**: Clear error message
- **Validation**: No crash, helpful error response

#### T4.2: Message Without Active Session
- **Setup**: No active session
- **Action**: Send regular message (no @mention)
- **Expected**: Bot ignores message
- **Validation**: No response

#### T4.3: Empty Message
- **Command**: `/agent action:chat message:` (empty)
- **Expected**: Error message requesting message content
- **Validation**: Graceful handling

#### T4.4: Very Long Message
- **Message**: Send 2000+ character prompt
- **Expected**: Agent processes or provides length warning
- **Validation**: No crash

#### T4.5: Invalid File Operation
- **Message**: "Create a file in /root/protected/test.ts"
- **Expected**: Error or permission denied
- **Validation**: Graceful error handling

#### T4.6: Cursor CLI Not Available
- **Setup**: Requires simulating Cursor unavailability
- **Expected**: Clear error message
- **Validation**: No system crash

---

## Test Area 5: Integration and Advanced Features

**Objective**: Test end-to-end workflows and advanced capabilities

### Test Scenarios

#### T5.1: Complete Development Workflow
- **Step 1**: "Create test-workflow-1.ts with a simple API client class"
- **Step 2**: "Add error handling to the API client"
- **Step 3**: "Add TypeScript types and interfaces"
- **Step 4**: "Add JSDoc comments"
- **Expected**: Complete, production-ready file
- **Validation**: All features implemented correctly

#### T5.2: Git Operations Context
- **Message**: "Create a test file that demonstrates the current git branch"
- **Expected**: Agent is aware of git context (via workspace)
- **Validation**: File references correct branch

#### T5.3: Multiple Agent Collaboration
- **Agent 1**: cursor-coder creates test-collab-1.ts
- **Agent 2**: cursor-refactor improves structure
- **Agent 3**: cursor-debugger adds logging
- **Expected**: File evolves through each agent
- **Validation**: All changes preserved

#### T5.4: Force Mode vs Safe Mode
- **Test A**: Use cursor-fast (force:true) for quick change
- **Test B**: Use cursor-coder (force:false) for careful change
- **Expected**: Different approval behaviors
- **Validation**: Force mode doesn't require approval

#### T5.5: Streaming Response Updates
- **Message**: "Create a complex TypeScript module with 5 classes"
- **Expected**: Discord messages update during processing
- **Validation**: Intermediate updates visible

#### T5.6: Model Variation
- **Test**: Use different agents with different models
  - cursor-coder: sonnet-4.5
  - cursor-debugger: sonnet-4.5-thinking
- **Expected**: Both models work correctly
- **Validation**: Different response characteristics

---

## Testing Coordination

### File Naming Convention
- All test files use `test-[area]-[number].[ext]` pattern
- Examples:
  - `test-file-ops-1.ts`
  - `test-conv-2.json`
  - `test-workflow-1.ts`

### Conflict Avoidance
- Each test area uses distinct file names
- Sequential execution within each area
- Parallel execution across areas

### Cleanup
- All test files should be in gitignore
- Manual cleanup after testing
- Do not commit test artifacts

---

## Success Metrics

### Coverage Targets
- [ ] 15+ test scenarios executed
- [ ] All 5 test areas covered
- [ ] File operations tested (create, modify, read)
- [ ] Multi-turn conversations verified
- [ ] Session management validated
- [ ] Error cases handled gracefully
- [ ] Integration workflows completed

### Quality Metrics
- Zero critical failures in core functionality
- All expected behaviors work correctly
- Error messages are clear and helpful
- No system crashes or hangs

---

## Known Issues to Investigate

Based on codebase review, these potential issues should be investigated during testing:

1. **Session persistence**: Sessions stored in memory, lost on restart
2. **Cursor CLI error handling**: May not handle all error types gracefully
3. **Message length limits**: Discord has 2000 char limit, may need chunking
4. **Concurrent request handling**: Multiple users might conflict
5. **Streaming update timing**: 2-second interval might miss rapid updates
6. **Model name validation**: Cursor models might not match exactly
7. **Workspace path handling**: Relative vs absolute paths
8. **Cost tracking**: Only Claude has cost, Cursor doesn't report cost
9. **Chat ID resumption**: Cursor chat resumption not tested
10. **Natural chat activation**: Might activate incorrectly on @mentions

---

## Test Execution Plan

### Phase 1: Preparation (5 min)
1. Review current bot status
2. Verify test file namespace is clean
3. Document baseline state

### Phase 2: Parallel Testing (30 min)
1. Execute File Operations tests
2. Execute Conversation Flow tests
3. Execute Session Management tests
4. Execute Error Handling tests
5. Execute Integration tests

### Phase 3: Issue Documentation (15 min)
1. Collect all findings
2. Create GitHub issues
3. Prioritize issues

### Phase 4: Reporting (10 min)
1. Aggregate results
2. Generate test report
3. Document recommendations

---

## Test Report Template

```
# Test Execution Report

## Test Area: [Name]
**Date**: [Date]
**Tester**: [Agent/User]

### Scenarios Executed
- [x] T#.#: [Name] - PASS/FAIL
- [ ] T#.#: [Name] - SKIPPED

### Findings
- **Bug**: [Description]
- **Improvement**: [Description]
- **Observation**: [Description]

### Evidence
- Screenshots: [Links]
- Logs: [Excerpts]
- Files: [Paths]

### Issues Created
- #[issue-number]: [Title]
```

---

## Appendix: Agent Configurations

### Cursor Agents Available
1. **cursor-coder**: Autonomous coder (sonnet-4.5, force:false, sandbox:enabled)
2. **cursor-refactor**: Refactoring specialist (sonnet-4.5, force:false, sandbox:enabled)
3. **cursor-debugger**: Debug agent (sonnet-4.5-thinking, force:false, sandbox:enabled)
4. **cursor-fast**: Fast agent (sonnet-4.5, force:true, sandbox:disabled)

### Discord Commands
- `/agent action:list` - List all agents
- `/agent action:start agent_name:[name]` - Start session
- `/agent action:chat message:[text]` - Chat with agent
- `/agent action:status` - Show session status
- `/agent action:switch agent_name:[name]` - Switch agents
- `/agent action:end` - End session
- `/agent action:info agent_name:[name]` - Show agent details

---

**End of Test Plan**
