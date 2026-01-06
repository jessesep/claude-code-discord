# Channel-Based Project Routing - Implementation Summary

## Overview

This implementation enables the Discord bot to dynamically determine which project/workspace to use based on the Discord channel and category where messages are received, rather than being tied to a single project at startup.

## What Was Implemented

### 1. Channel Context Manager (`util/channel-context.ts`)

A new utility class that extracts project information from Discord channels using three methods (in priority order):

1. **Channel Topic** (most reliable)
   - Parses the channel topic which contains: `Repository: ${repoName} | Branch: ${branchName} | Machine: ${machine} | Path: ${workDir}`
   - Extracts the full project path directly

2. **Category Name**
   - Parses category name format: `"categoryName (repoName)"` or just `"repoName"`
   - Attempts to find the project directory by searching common locations

3. **Config File** (`data/channel-mappings.json`)
   - Manual mapping of channel IDs to project paths
   - Format:
     ```json
     {
       "channels": {
         "123456789": {
           "projectPath": "/path/to/project1",
           "repoName": "project1",
           "branchName": "main"
         }
       }
     }
     ```

### 2. Updated Bot Message Handler (`discord/bot.ts`)

- Added `ChannelContextManager` initialization
- Updated message handler to extract channel context
- Made channel restriction optional (controlled by feature flag)
- Passes `channelContext` to all interaction contexts

### 3. Updated Type Definitions (`discord/types.ts`)

- Added `channelContext?: ChannelProjectContext` to `InteractionContext` interface

### 4. Updated Agent Command Handler (`discord/commands.ts`)

- Uses `ctx.channelContext?.projectPath` for `workDir` when available
- Falls back to `Deno.cwd()` if no channel context

## How It Works

1. **Message Received**: Bot receives a message in any Discord channel
2. **Context Extraction**: `ChannelContextManager` attempts to extract project info from:
   - Channel topic (if available)
   - Category name (if topic unavailable)
   - Config file (if both unavailable)
3. **Dynamic WorkDir**: If context is found, uses that project's directory
4. **Handler Execution**: All handlers (agent, git, shell, etc.) use the context-aware `workDir`

## Feature Flag

The feature is controlled by the `ENABLE_CHANNEL_ROUTING` environment variable:

```bash
# Enable channel-based routing
export ENABLE_CHANNEL_ROUTING=true

# Disable (default behavior - only responds to own channel)
# ENABLE_CHANNEL_ROUTING not set or set to false
```

## Usage

### Automatic Detection (Recommended)

The bot automatically detects projects from channel topics. When a bot creates a channel, it sets the topic with project information:

```
Repository: claude-code-discord | Branch: main | Machine: hostname | Path: /path/to/project
```

The bot will automatically use this path when messages are received in that channel.

### Manual Configuration

Create `data/channel-mappings.json`:

```json
{
  "channels": {
    "YOUR_CHANNEL_ID": {
      "projectPath": "/absolute/path/to/project",
      "repoName": "project-name",
      "branchName": "main"
    }
  }
}
```

### Category-Based Detection

If a channel is in a category named `"MyProject (repo-name)"`, the bot will:
1. Extract `repo-name` from the category
2. Search common locations: `$PROJECTS_DIR`, `$REPOS_DIR`, `$HOME/repos`, etc.
3. Use that directory if found

## Benefits

1. **Single Bot Instance**: One bot can handle multiple projects
2. **Automatic Routing**: No manual configuration needed if channel topics are set
3. **Backward Compatible**: Existing bots continue to work (feature flag disabled by default)
4. **Flexible**: Multiple ways to configure (topic, category, config file)

## Limitations & Considerations

1. **Path Security**: All paths are validated to exist before use
2. **Performance**: Channel contexts are cached to avoid repeated parsing
3. **Fallback Behavior**: If no context is found, falls back to default `workDir`
4. **Channel Restriction**: When routing is disabled, bot only responds to its own channel (original behavior)

## Testing

1. **Enable the feature**:
   ```bash
   export ENABLE_CHANNEL_ROUTING=true
   ```

2. **Test with channel topic**:
   - Create a channel with topic: `Repository: test-repo | Branch: main | Path: /path/to/test`
   - Send a message in that channel
   - Bot should use `/path/to/test` as workDir

3. **Test with category**:
   - Create category: `"Test Project (test-repo)"`
   - Create channel in that category
   - Ensure `test-repo` exists in a common location
   - Bot should find and use that directory

4. **Test fallback**:
   - Send message in channel without context
   - Bot should use default `workDir` (if it's the bot's own channel)

## Future Enhancements

1. **Management Commands**: Add `/channel-map` command to manage mappings
2. **Cache Invalidation**: Auto-invalidate cache when channels are updated
3. **Path Validation**: More robust path validation and security checks
4. **Multi-Project Sessions**: Support multiple active projects simultaneously
5. **Project Discovery**: Auto-scan and suggest project directories

## Files Modified

- `util/channel-context.ts` (new)
- `discord/bot.ts` (updated)
- `discord/types.ts` (updated)
- `discord/commands.ts` (updated)
- `docs/CHANNEL-PROJECT-ROUTING.md` (implementation plan)
- `docs/CHANNEL-ROUTING-IMPLEMENTATION.md` (this file)

## Related Documentation

- See `docs/CHANNEL-PROJECT-ROUTING.md` for detailed implementation plan
- See `.agent-context.md` for project architecture overview
