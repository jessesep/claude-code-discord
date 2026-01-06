# Handoff: Fix Truncated Message Expand Buttons

**Priority:** High  
**Status:** Ready for Agent  
**Date:** 2026-01-06

## Problem Statement

Truncated messages with expand buttons don't work. Users cannot view full responses when content is truncated.

## Current State

1. **Truncation Implemented:**
   - File: `agent/index.ts` (lines ~1009-1070)
   - Agent responses truncate at 2000 characters
   - Expand button added when content is truncated
   - Full content stored in `expandableContent` map

2. **Expand Button Handler:**
   - File: `discord/bot.ts` (lines ~357-388)
   - Handles `expand:` button pattern
   - Tries to get content from `expandableContent` map
   - Falls back to handler system

3. **Expandable Content Storage:**
   - File: `claude/discord-sender.ts`
   - `expandableContent` Map exported
   - Used to store full content for expansion

## Issue

The expand buttons don't work. When users click "📖 Show Full Response", nothing happens or an error occurs.

## Root Cause Analysis Needed

1. **Check button interaction flow:**
   - Does the button click reach the handler?
   - Is the `expand:` pattern being matched correctly?
   - Are there any errors in the button handler?

2. **Check content storage:**
   - Is content actually being stored in `expandableContent`?
   - Is the expandId being generated correctly?
   - Is the content accessible when button is clicked?

3. **Check Discord interaction handling:**
   - Are button interactions being routed correctly?
   - Is the `handleButton` function being called?
   - Are there any permission or interaction errors?

4. **Check actual behavior:**
   - What happens when user clicks expand button?
   - Any errors in bot logs?
   - Does the button update? Show error? Do nothing?

## Investigation Steps

1. **Review button creation:**
   - Check `agent/index.ts` where expand button is created
   - Verify `expandId` generation is unique and consistent
   - Verify content is stored before button is created
   - Check button `customId` format matches handler pattern

2. **Review button handler:**
   - Check `discord/bot.ts` expand button handler
   - Verify it's checking `expandableContent` map correctly
   - Check if handler is being called at all
   - Look for any errors in the handler logic

3. **Test expand flow:**
   - Create a test message with truncation
   - Click the expand button
   - Check bot logs for any errors
   - Verify content retrieval from map

4. **Check Discord interaction requirements:**
   - Verify button interactions are properly registered
   - Check if `ctx.update()` is the correct method
   - Verify embed formatting for expanded content
   - Check Discord API limits (embed size, etc.)

## Potential Issues

### Issue 1: Content Not Stored
- Content might not be stored in `expandableContent` map
- `expandId` might not match between storage and retrieval
- Map might be cleared or reset

### Issue 2: Handler Not Called
- Button interaction might not reach the handler
- Pattern matching might fail
- Handler might be in wrong location

### Issue 3: Content Too Large
- Expanded content might exceed Discord embed limits (4096 chars)
- Need to handle pagination or chunking
- Current handler has some chunking but might need improvement

### Issue 4: Interaction Update Failure
- `ctx.update()` might fail
- Discord API might reject the update
- Embed format might be invalid

## Solution Approaches

### Option 1: Fix Content Storage/Retrieval
- Ensure content is stored with correct ID
- Verify ID matching between button and handler
- Add logging to track storage/retrieval

### Option 2: Fix Button Handler
- Improve error handling in expand button handler
- Add fallback mechanisms
- Better content formatting for large responses

### Option 3: Use Follow-up Message
- Instead of updating embed, send new message
- Use `ctx.followUp()` or `ctx.reply()`
- Might be more reliable than `ctx.update()`

### Option 4: Implement Pagination
- Split large content into multiple embeds
- Use pagination buttons (Previous/Next)
- Better UX for very long content

## Files to Review

- `agent/index.ts` - Truncation and button creation (lines ~1009-1070)
- `discord/bot.ts` - Button handler (lines ~357-388)
- `claude/discord-sender.ts` - `expandableContent` map
- `discord/pagination.ts` - Pagination utilities (if exists)

## Expected Outcome

When user clicks "📖 Show Full Response" button:
1. Button interaction is received
2. Full content is retrieved from storage
3. Content is displayed (either updated embed or new message)
4. User can view complete response

## Success Criteria

- User sees truncated message with expand button
- User clicks expand button
- Full content is displayed
- No errors occur
- User can collapse/return to truncated view (optional)

## Testing Steps

1. Send a message that will be truncated (>2000 chars)
2. Verify expand button appears
3. Click expand button
4. Verify full content displays
5. Check bot logs for any errors
6. Test with very long content (>4096 chars)

## Notes

- Current implementation stores content in memory (`expandableContent` Map)
- Content might be lost if bot restarts
- Consider persistence for long-running sessions
- Check if there are similar expand patterns in other parts of codebase that work
- Review `claude/discord-sender.ts` for working expand examples
