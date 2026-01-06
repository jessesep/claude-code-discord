/**
 * Conversation Sync
 * 
 * Syncs Discord agent conversations to files that can be read by Cursor/Antigravity.
 * This enables continuing conversations across interfaces.
 * 
 * Security: 
 * - All file paths are sanitized to prevent directory traversal
 * - Conversation files are stored in a dedicated directory
 * - File permissions are set to owner-only on Unix systems
 */

import { ensureDir } from "https://deno.land/std@0.208.0/fs/ensure_dir.ts";

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  source: 'discord' | 'cursor' | 'antigravity';
}

export interface ConversationFile {
  id: string;
  userId: string;
  channelId: string;
  agentName: string;
  cursorSessionId?: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
}

const CONVERSATIONS_DIR = "./data/conversations";

// Track if system has been initialized
let isInitialized = false;

/**
 * Sanitize user/channel IDs to prevent directory traversal attacks
 */
function sanitizeId(id: string): string {
  // Only allow alphanumeric characters and underscores
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Initialize the conversation sync system
 * Should be called on bot startup
 */
export async function initializeConversationSync(): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("[ConversationSync] Initializing...");
    
    // Ensure the conversations directory exists
    await ensureDir(CONVERSATIONS_DIR);
    
    // On Unix systems, set directory permissions to owner-only (700)
    if (Deno.build.os !== "windows") {
      try {
        await Deno.chmod(CONVERSATIONS_DIR, 0o700);
      } catch (chmodError) {
        console.warn("[ConversationSync] Could not set directory permissions:", chmodError);
      }
    }
    
    // Validate existing conversation files
    let validCount = 0;
    let invalidCount = 0;
    
    try {
      for await (const entry of Deno.readDir(CONVERSATIONS_DIR)) {
        if (entry.isFile && entry.name.endsWith('.json')) {
          try {
            const content = await Deno.readTextFile(`${CONVERSATIONS_DIR}/${entry.name}`);
            const conversation = JSON.parse(content) as ConversationFile;
            
            // Validate required fields
            if (!conversation.id || !conversation.userId || !conversation.channelId) {
              console.warn(`[ConversationSync] Invalid conversation file: ${entry.name}`);
              invalidCount++;
            } else {
              validCount++;
            }
          } catch {
            console.warn(`[ConversationSync] Could not parse: ${entry.name}`);
            invalidCount++;
          }
        }
      }
    } catch {
      // Directory might be empty, which is fine
    }
    
    isInitialized = true;
    console.log(`[ConversationSync] Initialized. ${validCount} valid, ${invalidCount} invalid conversations.`);
    
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[ConversationSync] Initialization failed:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Check if the system is initialized
 */
export function isConversationSyncReady(): boolean {
  return isInitialized;
}

/**
 * Get the file path for a conversation
 */
function getConversationPath(userId: string, channelId: string): string {
  // Sanitize IDs to prevent path traversal
  const safeUserId = sanitizeId(userId);
  const safeChannelId = sanitizeId(channelId);
  return `${CONVERSATIONS_DIR}/${safeUserId}-${safeChannelId}.json`;
}

/**
 * Get the markdown export path for a conversation
 */
function getMarkdownPath(userId: string, channelId: string): string {
  // Sanitize IDs to prevent path traversal
  const safeUserId = sanitizeId(userId);
  const safeChannelId = sanitizeId(channelId);
  return `${CONVERSATIONS_DIR}/${safeUserId}-${safeChannelId}.md`;
}

/**
 * Load an existing conversation or create a new one
 */
export async function loadConversation(
  userId: string, 
  channelId: string,
  agentName: string
): Promise<ConversationFile> {
  const path = getConversationPath(userId, channelId);
  
  try {
    const content = await Deno.readTextFile(path);
    const conversation = JSON.parse(content) as ConversationFile;
    return conversation;
  } catch {
    // Create new conversation
    return {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      channelId,
      agentName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };
  }
}

/**
 * Save a conversation to disk
 */
export async function saveConversation(conversation: ConversationFile): Promise<void> {
  await ensureDir(CONVERSATIONS_DIR);
  
  const path = getConversationPath(conversation.userId, conversation.channelId);
  conversation.updatedAt = new Date().toISOString();
  
  await Deno.writeTextFile(path, JSON.stringify(conversation, null, 2));
  
  // Also export to markdown for easy viewing
  await exportToMarkdown(conversation);
}

/**
 * Add a message to a conversation
 */
export async function addMessage(
  userId: string,
  channelId: string,
  agentName: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  source: 'discord' | 'cursor' | 'antigravity' = 'discord'
): Promise<ConversationFile> {
  const conversation = await loadConversation(userId, channelId, agentName);
  
  conversation.messages.push({
    role,
    content,
    timestamp: new Date().toISOString(),
    source
  });
  
  await saveConversation(conversation);
  
  console.log(`[ConversationSync] Added ${role} message. Total: ${conversation.messages.length}`);
  
  return conversation;
}

/**
 * Update the Cursor session ID for a conversation
 */
export async function setCursorSessionId(
  userId: string,
  channelId: string,
  agentName: string,
  sessionId: string
): Promise<void> {
  const conversation = await loadConversation(userId, channelId, agentName);
  conversation.cursorSessionId = sessionId;
  await saveConversation(conversation);
  
  console.log(`[ConversationSync] Saved Cursor session ID: ${sessionId}`);
}

/**
 * Export conversation to markdown format
 * This file can be referenced in Cursor/Antigravity for context
 */
export async function exportToMarkdown(conversation: ConversationFile): Promise<string> {
  await ensureDir(CONVERSATIONS_DIR);
  
  const lines: string[] = [
    `# Conversation: ${conversation.agentName}`,
    ``,
    `**ID:** ${conversation.id}`,
    `**Started:** ${conversation.createdAt}`,
    `**Updated:** ${conversation.updatedAt}`,
    conversation.cursorSessionId ? `**Cursor Session:** ${conversation.cursorSessionId}` : '',
    ``,
    `---`,
    ``
  ];
  
  for (const msg of conversation.messages) {
    const roleEmoji = msg.role === 'user' ? '👤' : msg.role === 'assistant' ? '🤖' : '⚙️';
    const sourceTag = msg.source !== 'discord' ? ` [${msg.source}]` : '';
    
    lines.push(`## ${roleEmoji} ${msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}${sourceTag}`);
    lines.push(`*${new Date(msg.timestamp).toLocaleString()}*`);
    lines.push(``);
    lines.push(msg.content);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }
  
  // Add instructions for continuing in Cursor
  lines.push(`## 📋 Continue in Cursor`);
  lines.push(``);
  lines.push(`To continue this conversation in Cursor, use:`);
  lines.push(`\`\`\`bash`);
  if (conversation.cursorSessionId) {
    lines.push(`cursor agent --resume ${conversation.cursorSessionId} "Your message here"`);
  } else {
    lines.push(`# Reference this file in Cursor chat:`);
    lines.push(`# @${conversation.userId}-${conversation.channelId}.md Continue the conversation...`);
  }
  lines.push(`\`\`\``);
  
  const markdown = lines.join('\n');
  const path = getMarkdownPath(conversation.userId, conversation.channelId);
  await Deno.writeTextFile(path, markdown);
  
  return path;
}

/**
 * Get the conversation context as a string (for injecting into prompts)
 */
export async function getConversationContext(
  userId: string,
  channelId: string,
  agentName: string,
  maxMessages: number = 10
): Promise<string> {
  const conversation = await loadConversation(userId, channelId, agentName);
  
  if (conversation.messages.length === 0) {
    return '';
  }
  
  const recentMessages = conversation.messages.slice(-maxMessages);
  
  const context = recentMessages.map(msg => {
    const roleLabel = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'System';
    return `${roleLabel}: ${msg.content}`;
  }).join('\n\n');
  
  return `\n\n--- Previous Conversation ---\n${context}\n--- End Previous ---\n\n`;
}

/**
 * List all conversations for a user
 */
export async function listUserConversations(userId: string): Promise<ConversationFile[]> {
  await ensureDir(CONVERSATIONS_DIR);
  
  const conversations: ConversationFile[] = [];
  
  for await (const entry of Deno.readDir(CONVERSATIONS_DIR)) {
    if (entry.isFile && entry.name.startsWith(userId) && entry.name.endsWith('.json')) {
      try {
        const content = await Deno.readTextFile(`${CONVERSATIONS_DIR}/${entry.name}`);
        conversations.push(JSON.parse(content));
      } catch {
        // Skip invalid files
      }
    }
  }
  
  return conversations.sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
