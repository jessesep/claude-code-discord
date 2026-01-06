#!/usr/bin/env -S deno run --allow-all
import { loadConversation, exportToMarkdown } from './util/conversation-sync.ts';

const userId = '367705631014256641';
const channelId = '1458093359162986620';
const agentName = 'cursor-coder';

console.log('🔄 Syncing conversation...');
const conversation = await loadConversation(userId, channelId, agentName);
console.log(`📝 Found ${conversation.messages.length} messages`);

const mdPath = await exportToMarkdown(conversation);
const absolutePath = `${Deno.cwd()}/${mdPath}`;
console.log(`✅ Exported to: ${mdPath}`);
console.log(`📂 Full path: ${absolutePath}`);

if (conversation.cursorSessionId) {
  console.log(`\n💡 Cursor Session ID: ${conversation.cursorSessionId}`);
  console.log(`   Resume with: cursor agent --resume ${conversation.cursorSessionId} "continue"`);
}

// Try to open in Cursor
try {
  const cursorCmd = new Deno.Command('cursor', { args: [absolutePath] });
  const result = await cursorCmd.output();
  if (result.success) {
    console.log('\n✅ Opened in Cursor!');
  } else {
    console.log('\n⚠️  Cursor command executed but may have failed');
  }
} catch (e) {
  console.log('\n⚠️  Could not open in Cursor automatically:', e.message);
  console.log(`   You can manually open: ${absolutePath}`);
}
