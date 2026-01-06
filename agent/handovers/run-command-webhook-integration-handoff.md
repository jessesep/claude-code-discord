# Handoff: /run Command Webhook Integration & Model Listing Fixes

**Date**: January 6, 2026  
**Status**: In Progress - Issues Found  
**Priority**: High

## 🎯 Current Task

The `/run` command is showing only Google/Gemini model options and duplicates. Need to:
1. Fix duplicate model options in select menu
2. Add Cursor and Antigravity webhook options (currently only showing Google models)
3. Ensure webhooks are properly displayed when configured

## 📋 What Was Done

### ✅ Completed
1. **Fixed `/run` command select menu interaction errors**
   - Added `deferUpdate()` method to `InteractionContext` interface
   - Fixed "expected a string" errors by properly handling Discord.js components
   - Updated `convertMessageContent` to handle ActionRowBuilder instances and select menus

2. **Implemented dynamic model listing**
   - Created `util/list-models.ts` to fetch available models from Google API
   - Models are now fetched dynamically instead of hardcoded
   - Filters models that support `generateContent`

3. **Added webhook integration to `/run`**
   - Webhooks are fetched from settings and added to select menu
   - Webhook handler triggers agent sessions
   - Server webhook endpoint updated to start agent sessions

### ⚠️ Current Issues

1. **Only Google models showing**: The select menu only displays Gemini/Google models, missing:
   - Cursor webhook options
   - Antigravity webhook options
   - Other agent types

2. **Duplicates appearing**: Same models showing multiple times in the menu

3. **Webhook detection not working**: Webhooks may not be properly detected/displayed

## 🔍 Key Files Modified

- `agent/index.ts` (lines 1857-1970): `/run` command handler, model listing, webhook integration
- `discord/bot.ts` (lines 322-420): Select menu handler, webhook selection processing
- `util/list-models.ts`: New file for dynamic model fetching
- `server/index.ts` (lines 56-74): Webhook endpoint handler
- `discord/types.ts`: Added `deferUpdate()` to InteractionContext
- `discord/bot.ts` (lines 189-227): Updated `createInteractionContext` with `deferUpdate()`

## 🐛 Debugging Steps Needed

1. **Check webhook detection**:
   ```typescript
   // In agent/index.ts around line 1862-1864
   const settings = SettingsPersistence.getInstance().getSettings();
   const enabledWebhooks = (settings.webhooks || []).filter((w: any) => w.enabled);
   console.log('[Run] Enabled webhooks:', enabledWebhooks);
   ```

2. **Check model categorization**:
   ```typescript
   // In util/list-models.ts getModelsForAgents()
   console.log('[ListModels] Manager models:', manager);
   console.log('[ListModels] Coder models:', coder);
   console.log('[ListModels] Architect models:', architect);
   ```

3. **Check for duplicates**:
   - Models might be appearing in multiple categories (manager, coder, architect)
   - Need to deduplicate or use unique identifiers

4. **Verify webhook naming**:
   - Webhooks need "cursor" or "antigravity"/"gemini" in name to be detected
   - Check `data/settings.json` for webhook configuration

## 🎯 Next Steps

1. **Fix duplicate models**:
   - Deduplicate models across categories
   - Use Set to track already-added models
   - Or limit each model to appear only once

2. **Fix webhook display**:
   - Verify webhook detection logic
   - Check if webhooks exist in settings
   - Ensure webhook names match detection criteria

3. **Add Cursor/Antigravity direct options**:
   - If webhooks aren't configured, show direct agent options
   - Add `cursor-coder`, `ag-coder` (Antigravity) as direct options
   - Not just webhook-triggered options

4. **Test the select menu**:
   - Run `/run` command
   - Verify all options appear correctly
   - Check for duplicates
   - Verify webhook options show when configured

## 📝 Code Locations

### Select Menu Creation
- File: `agent/index.ts`
- Function: `handleSimpleCommand` (line 1849)
- Lines: 1857-1970

### Model Fetching
- File: `util/list-models.ts`
- Function: `getModelsForAgents()` (line 87)
- Function: `listAvailableModels()` (line 21)

### Webhook Handling
- File: `discord/bot.ts`
- Function: `handleSelectMenu` (line 312)
- Lines: 322-420

### Webhook Endpoint
- File: `server/index.ts`
- Route: `POST /api/webhooks/:id` (line 57)

## 🔧 Quick Fixes to Try

1. **Deduplicate models**:
   ```typescript
   const seenModels = new Set<string>();
   // Before adding to availableAgents, check: if (!seenModels.has(model.name))
   ```

2. **Add direct agent options** (not just webhooks):
   ```typescript
   // Add cursor-coder and ag-coder as direct options
   availableAgents.push({
     name: 'cursor-coder',
     label: 'Cursor Coder Agent',
     description: 'Direct Cursor agent (no webhook)',
     model: 'cursor',
     type: 'agent'
   });
   ```

3. **Debug webhook detection**:
   ```typescript
   console.log('[Run] All webhooks:', settings.webhooks);
   console.log('[Run] Enabled webhooks:', enabledWebhooks);
   ```

## 📚 Related Context

- Discord context: `discord/.agent-context.md`
- Agent context: `agent/AGENT_CONTEXT.md`
- Settings structure: `settings/unified-settings.ts` (WebhookConfig interface)

## 🚨 Known Issues

- Model list might be empty if API call fails (falls back to hardcoded list)
- Webhook detection relies on name matching ("cursor", "antigravity", "gemini")
- No direct Cursor/Antigravity options if webhooks aren't configured
- Duplicates can occur if same model fits multiple categories

---

**Handoff complete. New agent should:**
1. First check what's actually showing in the select menu
2. Debug why webhooks aren't appearing
3. Fix duplicate models
4. Add direct agent options if needed
5. Test thoroughly with `/run` command
