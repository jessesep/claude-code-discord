# Agent 4: Slack Integration

## Mission
Add Slack as an alternative interface to Discord, enabling enterprise teams to interact with agents via Slack.

## Context
- Discord is great for dev communities; Slack is standard in enterprise
- Competitor (Claude Control) supports both Slack and Discord
- Same agent system, different chat frontend
- Slack has different APIs (Bolt, Events API, Web API)

## Scope
**IN SCOPE:**
- Slack bot setup and OAuth
- Slash commands (`/agent`, `/run`, etc.)
- Message handling (mentions, replies)
- Thread-based conversations (maps to sessions)
- Streaming responses via Slack blocks

**OUT OF SCOPE:**
- Dashboard (Agent 1)
- Direct mentions syntax (Agent 2 - adapt pattern for Slack)
- Remote agents (Agent 3)
- Discord changes

## Key Files to Study First
```
discord/bot.ts              # Discord client setup (REFERENCE)
discord/commands.ts         # Command definitions (ADAPT)
discord/message-handler.ts  # Message processing (ADAPT)
discord/formatting.ts       # Rich embeds (ADAPT to Slack blocks)
agent/index.ts              # Core agent logic (REUSE)
agent/handlers.ts           # Agent handlers (REUSE)
```

## Architecture

### Directory Structure
```
slack/
├── app.ts              # Slack Bolt app initialization
├── commands.ts         # Slash command handlers
├── events.ts           # Event handlers (messages, mentions)
├── blocks.ts           # Slack Block Kit formatters
├── oauth.ts            # OAuth flow for workspace installs
└── index.ts            # Exports
```

### Implementation Plan

### Phase 1: Slack App Setup
1. Create Slack app at https://api.slack.com/apps
2. Configure OAuth scopes:
   - `app_mentions:read`
   - `chat:write`
   - `commands`
   - `im:history`
   - `channels:history`
   - `users:read`

3. Add environment variables:
```bash
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-... # For Socket Mode
```

### Phase 2: Bolt App Initialization
Create `slack/app.ts`:
```typescript
import { App } from '@slack/bolt';

export const slackApp = new App({
  token: Deno.env.get('SLACK_BOT_TOKEN'),
  signingSecret: Deno.env.get('SLACK_SIGNING_SECRET'),
  socketMode: true,
  appToken: Deno.env.get('SLACK_APP_TOKEN'),
});

// Start the app
await slackApp.start();
console.log('⚡️ Slack bot is running!');
```

### Phase 3: Slash Commands
Create `slack/commands.ts`:
```typescript
slackApp.command('/agent', async ({ command, ack, say, client }) => {
  await ack();
  
  const [action, ...args] = command.text.split(' ');
  
  switch (action) {
    case 'list':
      // List available agents
      await say(formatAgentList());
      break;
    case 'chat':
      // Start agent conversation
      const message = args.join(' ');
      await handleAgentChat(command, message, say);
      break;
    case 'status':
      // Show session status
      await say(formatSessionStatus(command.user_id, command.channel_id));
      break;
  }
});

slackApp.command('/run', async ({ command, ack, say }) => {
  await ack();
  // Quick start with default agent
  await handleQuickRun(command, say);
});
```

### Phase 4: Message Handling (Mentions)
Create `slack/events.ts`:
```typescript
slackApp.event('app_mention', async ({ event, say }) => {
  // Remove bot mention from message
  const message = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
  
  // Check for @agent-name pattern (from Agent 2's work)
  const { agentId, cleanMessage } = parseAgentMention(message);
  
  // Create Slack-specific context
  const ctx = createSlackContext(event, say);
  
  // Invoke agent
  await chatWithAgent(ctx, cleanMessage, agentId);
});

// Thread replies continue the session
slackApp.event('message', async ({ event, say }) => {
  if (event.thread_ts) {
    // This is a reply in a thread - continue session
    const session = getSessionByThread(event.thread_ts);
    if (session) {
      await continueSession(session, event.text, say);
    }
  }
});
```

### Phase 5: Slack Block Formatting
Create `slack/blocks.ts`:
```typescript
export function formatAgentResponse(agent: AgentConfig, response: string): Block[] {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${agent.name}` }
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: response }
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `Model: \`${agent.model}\`` },
        { type: 'mrkdwn', text: `Provider: \`${agent.client}\`` }
      ]
    }
  ];
}

export function formatStreamingUpdate(text: string): Block[] {
  // For streaming, update existing message
  return [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: text + ' ▌' } // Cursor indicator
    }
  ];
}
```

### Phase 6: Streaming Responses
Slack doesn't support true streaming, but we can update messages:
```typescript
async function streamToSlack(
  client: WebClient,
  channel: string,
  ts: string,  // Message timestamp for updates
  stream: AsyncIterable<string>
) {
  let fullText = '';
  let lastUpdate = 0;
  
  for await (const chunk of stream) {
    fullText += chunk;
    
    // Throttle updates (max 1 per 500ms to avoid rate limits)
    if (Date.now() - lastUpdate > 500) {
      await client.chat.update({
        channel,
        ts,
        blocks: formatStreamingUpdate(fullText)
      });
      lastUpdate = Date.now();
    }
  }
  
  // Final update with complete response
  await client.chat.update({
    channel,
    ts,
    blocks: formatAgentResponse(agent, fullText)
  });
}
```

### Phase 7: Unified Context Adapter
Create adapter so agents work with both Discord and Slack:
```typescript
// slack/context.ts
export function createSlackContext(event: any, say: SayFn): InteractionContext {
  return {
    user: { id: event.user, ... },
    channelId: event.channel,
    reply: async (content) => await say(content),
    deferReply: async () => {}, // Slack ack() handles this
    editReply: async (content) => {
      // Use chat.update with ts
    },
    // ... map other Discord context methods to Slack equivalents
  };
}
```

## Technical Constraints
- Deno compatibility with @slack/bolt (use npm: specifier)
- Socket Mode preferred (no public URL needed)
- Rate limits: 1 message/second, 20 updates/minute
- Max message length: 40,000 chars (use blocks for long content)

## Dependencies
```json
// deno.json
{
  "imports": {
    "@slack/bolt": "npm:@slack/bolt@^3.17.0",
    "@slack/web-api": "npm:@slack/web-api@^6.11.0"
  }
}
```

## Success Criteria
- [ ] `/agent list` shows available agents in Slack
- [ ] `/agent chat <message>` invokes agent and streams response
- [ ] @mention bot triggers agent interaction
- [ ] Thread replies continue the session
- [ ] Responses formatted with Slack blocks
- [ ] Same agents work in both Discord and Slack

## Testing
```bash
# Set environment variables
export SLACK_BOT_TOKEN=xoxb-...
export SLACK_SIGNING_SECRET=...
export SLACK_APP_TOKEN=xapp-...

# Start bot with Slack enabled
deno run --allow-all index.ts --slack
```

## OAuth for Workspace Installation (Optional Enhancement)
For multi-workspace support:
```typescript
// slack/oauth.ts
slackApp.receiver.router.get('/slack/install', (req, res) => {
  // Redirect to Slack OAuth
});

slackApp.receiver.router.get('/slack/oauth_redirect', (req, res) => {
  // Handle OAuth callback, store tokens
});
```

## Notes
- Consider using the same session manager for both platforms
- Thread TS in Slack maps well to conversation sessions
- Slack's interactive components (buttons, menus) could enhance agent UX
- Enterprise Grid requires additional OAuth scopes
