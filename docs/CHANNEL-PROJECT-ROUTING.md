# Channel/Category-Based Project Routing Implementation Plan

## Overview
Enable the bot to dynamically determine which project/workspace to use based on the Discord channel and category where messages are received, rather than being tied to a single project at startup.

## Current Architecture

### Current Behavior
- Bot is started with a fixed `workDir` from `Deno.cwd()`
- Bot only responds to messages in its own channel (`myChannel.id`)
- Each bot instance is tied to one project directory
- Multi-project support exists via `WorktreeBotManager` spawning separate processes

### Key Components
1. **Channel Topic**: Already contains project info: `Repository: ${repoName} | Branch: ${branchName} | Machine: ${Deno.hostname()} | Path: ${workDir}`
2. **Category Name**: Format `"categoryName (repoName)"` or just `"repoName"`
3. **Channel Name**: Sanitized branch name
4. **workDir Usage**: Used throughout:
   - Shell commands (`shell/handler.ts`)
   - Git commands (`git/handler.ts`)
   - Agent context (`agent/index.ts`)
   - File operations

## Implementation Strategy

### Phase 1: Channel Context Extraction

#### 1.1 Create Channel Context Manager
**File**: `util/channel-context.ts`

```typescript
export interface ChannelProjectContext {
  channelId: string;
  channelName: string;
  categoryName: string | null;
  projectPath: string;
  repoName: string;
  branchName: string;
  source: 'topic' | 'category' | 'config' | 'default';
}

export class ChannelContextManager {
  private channelCache = new Map<string, ChannelProjectContext>();
  
  /**
   * Extract project context from a Discord channel
   */
  async getChannelContext(channel: any): Promise<ChannelProjectContext | null> {
    // 1. Check cache
    if (this.channelCache.has(channel.id)) {
      return this.channelCache.get(channel.id)!;
    }
    
    // 2. Try to extract from channel topic (most reliable)
    const context = await this.extractFromTopic(channel);
    if (context) {
      this.channelCache.set(channel.id, context);
      return context;
    }
    
    // 3. Try to extract from category name
    const categoryContext = await this.extractFromCategory(channel);
    if (categoryContext) {
      this.channelCache.set(channel.id, categoryContext);
      return categoryContext;
    }
    
    // 4. Try config file mapping
    const configContext = await this.extractFromConfig(channel);
    if (configContext) {
      this.channelCache.set(channel.id, configContext);
      return configContext;
    }
    
    return null;
  }
  
  private async extractFromTopic(channel: any): Promise<ChannelProjectContext | null> {
    if (!channel.topic) return null;
    
    // Parse: "Repository: ${repoName} | Branch: ${branchName} | Machine: ${machine} | Path: ${workDir}"
    const pathMatch = channel.topic.match(/Path:\s*(.+?)(?:\s*\||$)/);
    const repoMatch = channel.topic.match(/Repository:\s*(.+?)(?:\s*\||$)/);
    const branchMatch = channel.topic.match(/Branch:\s*(.+?)(?:\s*\||$)/);
    
    if (pathMatch && repoMatch) {
      const category = channel.parent ? channel.parent.name : null;
      return {
        channelId: channel.id,
        channelName: channel.name,
        categoryName: category,
        projectPath: pathMatch[1].trim(),
        repoName: repoMatch[1].trim(),
        branchName: branchMatch ? branchMatch[1].trim() : 'main',
        source: 'topic'
      };
    }
    
    return null;
  }
  
  private async extractFromCategory(channel: any): Promise<ChannelProjectContext | null> {
    if (!channel.parent) return null;
    
    const categoryName = channel.parent.name;
    // Parse: "categoryName (repoName)" or just "repoName"
    const match = categoryName.match(/^(.+?)\s*\((.+?)\)$|^(.+)$/);
    
    if (match) {
      const repoName = match[2] || match[3] || categoryName;
      // Try to find project directory for this repo
      const projectPath = await this.findProjectPath(repoName);
      
      if (projectPath) {
        return {
          channelId: channel.id,
          channelName: channel.name,
          categoryName: categoryName,
          projectPath,
          repoName,
          branchName: channel.name, // Channel name is usually branch name
          source: 'category'
        };
      }
    }
    
    return null;
  }
  
  private async extractFromConfig(channel: any): Promise<ChannelProjectContext | null> {
    // Load from data/channel-mappings.json
    try {
      const config = JSON.parse(await Deno.readTextFile('data/channel-mappings.json'));
      const mapping = config.channels?.[channel.id];
      
      if (mapping && mapping.projectPath) {
        return {
          channelId: channel.id,
          channelName: channel.name,
          categoryName: channel.parent?.name || null,
          projectPath: mapping.projectPath,
          repoName: mapping.repoName || 'unknown',
          branchName: mapping.branchName || channel.name,
          source: 'config'
        };
      }
    } catch {
      // Config file doesn't exist or invalid
    }
    
    return null;
  }
  
  private async findProjectPath(repoName: string): Promise<string | null> {
    // Try common locations or use environment variable
    const commonPaths = [
      Deno.env.get('PROJECTS_DIR'),
      Deno.env.get('REPOS_DIR'),
      Deno.env.get('HOME') + '/repos',
      Deno.env.get('HOME') + '/projects',
    ].filter(Boolean);
    
    for (const basePath of commonPaths) {
      const potentialPath = `${basePath}/${repoName}`;
      try {
        const stat = await Deno.stat(potentialPath);
        if (stat.isDirectory) {
          return potentialPath;
        }
      } catch {
        continue;
      }
    }
    
    return null;
  }
  
  invalidateCache(channelId: string) {
    this.channelCache.delete(channelId);
  }
}
```

### Phase 2: Update Message Handler

#### 2.1 Modify Bot Message Handler
**File**: `discord/bot.ts`

Changes needed:
1. Remove restriction: `if (!myChannel || message.channelId !== myChannel.id) return;`
2. Extract channel context for incoming messages
3. Pass context to handlers

```typescript
// In createDiscordBot function, add:
import { ChannelContextManager } from "../util/channel-context.ts";
const channelContextManager = new ChannelContextManager();

// In MessageCreate handler:
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  
  // Get channel context (project directory)
  const channelContext = await channelContextManager.getChannelContext(message.channel);
  
  if (!channelContext) {
    // Could optionally reply that channel is not configured
    // For now, only respond if it's our channel (backward compatibility)
    if (!myChannel || message.channelId !== myChannel.id) return;
  }
  
  // Use channel context workDir if available, otherwise fall back to default
  const effectiveWorkDir = channelContext?.projectPath || workDir;
  
  // ... rest of message handling with effectiveWorkDir
});
```

### Phase 3: Context-Aware Dependencies

#### 3.1 Update Agent Handler Dependencies
**File**: `agent/index.ts` and `discord/commands.ts`

Need to make `workDir` dynamic based on channel context:

```typescript
// In chatWithAgent and handlers:
// Instead of: const workDir = deps?.workDir || Deno.cwd();
// Use: const workDir = ctx.channelContext?.projectPath || deps?.workDir || Deno.cwd();

// Add to InteractionContext:
export interface InteractionContext {
  // ... existing fields
  channelContext?: ChannelProjectContext;
}
```

#### 3.2 Update Shell Manager
**File**: `shell/handler.ts`

Make ShellManager accept workDir per command instead of at construction:

```typescript
// Change from:
class ShellManager {
  constructor(private workDir: string) {}
  async execute(command: string, ...) {
    // Uses this.workDir
  }
}

// To:
class ShellManager {
  async execute(command: string, workDir: string, ...) {
    // Uses provided workDir
  }
}
```

#### 3.3 Update Git Handler
**File**: `git/handler.ts`

Already accepts `workDir` as parameter, but need to ensure it's passed from context.

### Phase 4: Configuration & Management

#### 4.1 Channel Mapping Config
**File**: `data/channel-mappings.json` (optional)

```json
{
  "channels": {
    "123456789": {
      "projectPath": "/path/to/project1",
      "repoName": "project1",
      "branchName": "main"
    },
    "987654321": {
      "projectPath": "/path/to/project2",
      "repoName": "project2",
      "branchName": "develop"
    }
  }
}
```

#### 4.2 Management Commands
Add commands to manage channel mappings:
- `/channel-map set <channel> <path>` - Manually map channel to project
- `/channel-map list` - List all channel mappings
- `/channel-map clear <channel>` - Clear mapping for channel

### Phase 5: Backward Compatibility

#### 5.1 Fallback Behavior
- If channel context cannot be determined, fall back to default `workDir`
- If bot is started in a specific directory, that remains the default
- Existing single-project bots continue to work

#### 5.2 Migration Path
1. Deploy with feature flag: `ENABLE_CHANNEL_ROUTING=true`
2. Test with one channel first
3. Gradually enable for more channels
4. Eventually make it default behavior

## Implementation Steps

### Step 1: Create Channel Context Manager
- [ ] Create `util/channel-context.ts`
- [ ] Implement topic parsing
- [ ] Implement category parsing
- [ ] Implement config file support
- [ ] Add caching mechanism

### Step 2: Update Message Handler
- [ ] Remove channel restriction in `discord/bot.ts`
- [ ] Integrate ChannelContextManager
- [ ] Pass context to handlers

### Step 3: Make Handlers Context-Aware
- [ ] Update `InteractionContext` interface
- [ ] Update `chatWithAgent` to use channel context
- [ ] Update shell handler to accept dynamic workDir
- [ ] Update git handler calls
- [ ] Update file operations

### Step 4: Add Management Commands
- [ ] Create `/channel-map` command
- [ ] Add handlers for mapping management
- [ ] Create config file structure

### Step 5: Testing & Documentation
- [ ] Test with multiple channels
- [ ] Test fallback behavior
- [ ] Update documentation
- [ ] Add examples

## Edge Cases & Considerations

1. **Channel Topic Missing**: Fall back to category or config
2. **Invalid Path**: Validate path exists before using
3. **Permission Issues**: Handle cases where bot can't read channel topic
4. **Cache Invalidation**: Clear cache when channel is updated
5. **Security**: Validate paths to prevent directory traversal
6. **Performance**: Cache channel contexts to avoid repeated parsing

## Benefits

1. **Single Bot Instance**: One bot can handle multiple projects
2. **Dynamic Routing**: Automatic project detection from channel info
3. **Flexible Configuration**: Multiple ways to configure (topic, category, config)
4. **Backward Compatible**: Existing bots continue to work
5. **Easy Management**: Commands to manage mappings

## Risks & Mitigations

1. **Path Security**: Validate all paths, prevent traversal attacks
2. **Performance**: Cache aggressively, limit cache size
3. **Complexity**: Keep implementation simple, well-documented
4. **Breaking Changes**: Feature flag, gradual rollout
