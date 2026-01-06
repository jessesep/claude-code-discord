# Handoff: Fix GitHub Issue Creation

**Priority:** High  
**Status:** ✅ COMPLETED  
**Date:** 2026-01-06  
**Completed:** 2026-01-06

## Problem Statement

The bot cannot create simple GitHub issues. When users ask agents to create GitHub issues, the functionality fails.

## Current State

1. **GitHub Issue Utility Created:**
   - File: `util/github-issues.ts`
   - Function: `createGitHubIssueWithCLI()`
   - Uses Deno.Command to call GitHub CLI (`gh`)
   - Properly handles errors and returns issue numbers

2. **Manager Agent Awareness:**
   - File: `agent/manager.ts`
   - Manager knows about GitHub issue creation utility
   - Instructs agents to use utility functions instead of scripts

3. **MCP Client:**
   - File: `util/mcp-client.ts`
   - Lists fallback tools including GitHub issue creation
   - Currently returns empty arrays (MCP not fully implemented)

## Issue

The agent cannot actually call the GitHub issue creation function. The utility exists but:
- Agents don't have a way to invoke it
- No integration between agent responses and the utility function
- Agents may be trying to generate scripts instead of calling the function

## Root Cause Analysis Needed

1. **Check how agents execute code:**
   - Do agents have access to Deno runtime?
   - Can agents call utility functions directly?
   - What execution context do agents have?

2. **Check agent tool access:**
   - What tools do Antigravity agents have?
   - Can agents call Deno functions?
   - Is there a tool calling mechanism?

3. **Check actual agent behavior:**
   - What does the agent actually do when asked to create issues?
   - Does it generate scripts? Try to use MCP? Something else?
   - Check recent Discord messages/logs for agent responses

## Investigation Steps

1. **Review agent execution context:**
   - Check `agent/index.ts` - how do agents execute code?
   - Check `claude/antigravity-client.ts` - what capabilities do Antigravity agents have?
   - Check if agents can call Deno functions or if they need a different approach

2. **Test GitHub issue creation manually:**
   - Try calling `createGitHubIssueWithCLI()` directly from code
   - Verify GitHub CLI (`gh`) is installed and authenticated
   - Test if the function works when called programmatically

3. **Check agent tool integration:**
   - Look for tool calling mechanisms in the codebase
   - Check if there's a way to expose utility functions as "tools" to agents
   - Review how other agent actions are executed

4. **Review agent prompts:**
   - Check what instructions agents receive about GitHub issues
   - Verify agents know HOW to call the utility function
   - Check if there's a pattern for agents to call Deno functions

## Solution Approaches

### Option 1: Expose as Agent Tool
- Create a tool/function that agents can call
- Integrate with Antigravity's tool calling system
- Allow agents to invoke `createGitHubIssueWithCLI()` as a tool

### Option 2: Direct Function Call in Agent Handler
- Modify agent response handler to detect GitHub issue creation requests
- Intercept and call the utility function directly
- Return results to the agent for formatting

### Option 3: Script Execution with Validation
- If agents must generate code, create a safe execution environment
- Validate and execute only GitHub issue creation scripts
- Sandbox execution for security

## Files to Review

- `util/github-issues.ts` - The utility function
- `agent/index.ts` - Agent execution and tool calling
- `agent/manager.ts` - Manager instructions
- `claude/antigravity-client.ts` - Antigravity agent capabilities
- `util/mcp-client.ts` - MCP tool integration

## Expected Outcome

Agents should be able to create GitHub issues when requested by:
1. Either calling the utility function directly
2. Or having the system intercept and execute the function
3. Or using a proper tool calling mechanism

## Success Criteria

- User asks agent to create a GitHub issue
- Agent successfully creates the issue
- Issue appears in the GitHub repository
- Agent reports success with issue number

## Solution Implemented

**Approach:** Option 2 - Direct Function Call in Agent Handler

### Changes Made:

1. **Parser Function Created** (`agent/manager.ts`):
   - Added `parseGitHubIssueRequest()` function to detect GitHub issue creation requests in agent responses
   - Parses JSON blocks with `create_github_issue` action format
   - Returns structured action object with title, body, and labels

2. **Manager System Prompt Updated** (`agent/manager.ts`):
   - Added clear instructions for GitHub issue creation using JSON action format
   - Format: `{"action": "create_github_issue", "title": "...", "body": "...", "labels": [...]}`
   - Updated `ManagerAction` interface to include `create_github_issue` action type

3. **Agent Response Interception** (`agent/index.ts`):
   - Added GitHub issue creation interception in `chatWithAgent()` function
   - Checks agent responses for GitHub issue creation requests before displaying
   - Executes `createGitHubIssueWithCLI()` when request is detected
   - Returns success/error messages to user via Discord embeds
   - Handles both success and error cases with appropriate user feedback

4. **Manager Handler Updated** (`agent/index.ts`):
   - Added GitHub issue creation handling in `handleManagerInteraction()`
   - Manager can now create issues directly when it outputs the action format
   - Provides consistent error handling and user feedback

5. **MCP Client Updated** (`util/mcp-client.ts`):
   - Updated fallback tools info to include the JSON action format
   - Provides clear instructions for agents on how to create issues

### How It Works:

1. User asks agent (e.g., Manager) to create a GitHub issue
2. Agent outputs a JSON block with `create_github_issue` action
3. System intercepts the response and parses the JSON
4. System calls `createGitHubIssueWithCLI()` utility function
5. System displays result (success with issue number or error) to user
6. Response is saved to conversation history

### Usage Example:

When an agent wants to create an issue, it outputs:
```json
{
  "action": "create_github_issue",
  "title": "Fix bug in authentication",
  "body": "Users cannot log in with OAuth",
  "labels": ["bug", "authentication"]
}
```

The system automatically executes this and reports the result.

## Notes

- GitHub CLI (`gh`) must be installed and authenticated
- The utility function exists and works correctly
- Agents can now create issues by using the JSON action format
- Works for both Manager agent and other agents (interception in `chatWithAgent`)
- Error messages provide helpful troubleshooting information
