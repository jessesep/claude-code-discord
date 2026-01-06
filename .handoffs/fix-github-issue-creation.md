# Handoff: Fix GitHub Issue Creation

**Priority:** High  
**Status:** Ready for Agent  
**Date:** 2026-01-06

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

## Notes

- GitHub CLI (`gh`) must be installed and authenticated
- The utility function exists and should work if called correctly
- The issue is likely in the integration between agents and the utility function
- Check recent bot logs for actual error messages when issue creation is attempted
