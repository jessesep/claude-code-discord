// deno-lint-ignore-file no-explicit-any

/**
 * OSC Discord Commands
 * 
 * Handles !osc commands from Discord for testing OSC functionality.
 */

import { Message, EmbedBuilder } from "npm:discord.js@14.14.1";
import type { OSCManager, OSCStats } from "./index.ts";

/**
 * Handle OSC-related Discord messages
 */
export async function handleOSCMessage(
  message: Message, 
  oscManager: OSCManager | null
): Promise<boolean> {
  const content = message.content.trim();
  
  // Only handle !osc commands
  if (!content.startsWith('!osc')) return false;
  
  const parts = content.split(/\s+/);
  const command = parts[1]?.toLowerCase();
  const args = parts.slice(2);

  if (!oscManager) {
    await message.reply({
      embeds: [createEmbed('❌ OSC Not Available', 'OSC Manager is not initialized.', 0xff0000) as any]
    });
    return true;
  }

  switch (command) {
    case 'ping':
      await handlePing(message, oscManager);
      break;

    case 'status':
      await handleStatus(message, oscManager);
      break;

    case 'send':
      await handleSend(message, oscManager, args);
      break;

    case 'git':
      await handleGitCommand(message, oscManager, args);
      break;

    case 'agent':
      await handleAgentCommand(message, oscManager, args);
      break;

    case 'help':
    default:
      await handleHelp(message);
      break;
  }

  return true;
}

/**
 * Handle !osc ping
 */
async function handlePing(message: Message, oscManager: OSCManager): Promise<void> {
  const startTime = Date.now();
  
  await message.reply({
    embeds: [createEmbed('🏓 Sending /ping...', 'Waiting for response...', 0xffff00) as any]
  });

  // Send ping via OSC
  await oscManager.sendFromDiscord('/ping', [1]);
  
  const latency = Date.now() - startTime;
  
  await message.channel.send({
    embeds: [createEmbed(
      '✅ OSC Ping Complete',
      `OSC bridge responded in ${latency}ms`,
      0x00ff00,
      [
        { name: 'Latency', value: `${latency}ms`, inline: true },
        { name: 'Status', value: 'Active', inline: true }
      ]
    ) as any]
  });
}

/**
 * Handle !osc status
 */
async function handleStatus(message: Message, oscManager: OSCManager): Promise<void> {
  const stats: OSCStats = oscManager.getStats();
  
  const uptimeStr = formatUptime(stats.uptime);
  const lastMsgStr = stats.lastMessageTime 
    ? stats.lastMessageTime.toLocaleTimeString() 
    : 'Never';

  await message.reply({
    embeds: [createEmbed(
      '📊 OSC Bridge Status',
      stats.isRunning ? '🟢 Bridge is active' : '🔴 Bridge is offline',
      stats.isRunning ? 0x00ff00 : 0xff0000,
      [
        { name: 'Status', value: stats.isRunning ? 'Running' : 'Stopped', inline: true },
        { name: 'Uptime', value: uptimeStr, inline: true },
        { name: 'Messages Received', value: stats.messagesReceived.toString(), inline: true },
        { name: 'Messages Sent', value: stats.messagesSent.toString(), inline: true },
        { name: 'Last Message', value: lastMsgStr, inline: true },
        { name: 'Listen Port', value: '9000', inline: true },
        { name: 'Feedback Port', value: '9001', inline: true }
      ]
    ) as any]
  });
}

/**
 * Handle !osc send <address> [args...]
 */
async function handleSend(message: Message, oscManager: OSCManager, args: string[]): Promise<void> {
  if (args.length === 0) {
    await message.reply({
      embeds: [createEmbed(
        '❌ Missing Address',
        'Usage: `!osc send <address> [arg1] [arg2] ...`\nExample: `!osc send /ping`',
        0xff0000
      ) as any]
    });
    return;
  }

  const address = args[0].startsWith('/') ? args[0] : `/${args[0]}`;
  const oscArgs = args.slice(1).map(parseArg);

  await oscManager.sendFromDiscord(address, oscArgs.length > 0 ? oscArgs : [1]);

  await message.reply({
    embeds: [createEmbed(
      `📤 Sent: ${address}`,
      `Args: ${oscArgs.length > 0 ? oscArgs.map(a => `\`${a}\``).join(', ') : '`1`'}`,
      0x00ff88
    ) as any]
  });
}

/**
 * Handle !osc git <status|sync>
 */
async function handleGitCommand(message: Message, oscManager: OSCManager, args: string[]): Promise<void> {
  const subcommand = args[0]?.toLowerCase() || 'status';

  switch (subcommand) {
    case 'status':
      await message.reply({
        embeds: [createEmbed('📊 Requesting Git Status...', 'Sending /git/status', 0xffff00) as any]
      });
      await oscManager.sendFromDiscord('/git/status', [1]);
      break;

    case 'sync':
      await message.reply({
        embeds: [createEmbed('🔄 Starting GitHub Sync...', 'Sending /github/sync', 0xffff00) as any]
      });
      await oscManager.sendFromDiscord('/github/sync', [1]);
      break;

    default:
      await message.reply({
        embeds: [createEmbed(
          '❓ Unknown Git Command',
          'Available: `!osc git status`, `!osc git sync`',
          0xffaa00
        ) as any]
      });
  }
}

/**
 * Handle !osc agent <name>
 */
async function handleAgentCommand(message: Message, oscManager: OSCManager, args: string[]): Promise<void> {
  const agentName = args[0]?.toLowerCase();

  if (!agentName) {
    await message.reply({
      embeds: [createEmbed(
        '❓ Select an Agent',
        'Available agents:\n`coder` `architect` `manager` `tester` `security` `reviewer` `assistant`\n\nUsage: `!osc agent coder`',
        0xffaa00
      ) as any]
    });
    return;
  }

  await message.reply({
    embeds: [createEmbed(
      `🤖 Selecting Agent: ${agentName}`,
      `Sending /agent/select/${agentName}`,
      0xffff00
    ) as any]
  });

  await oscManager.sendFromDiscord(`/agent/select/${agentName}`, [1]);
}

/**
 * Handle !osc help
 */
async function handleHelp(message: Message): Promise<void> {
  await message.reply({
    embeds: [createEmbed(
      '🎛️ OSC Commands',
      'Control the OSC bridge from Discord',
      0x0099ff,
      [
        { name: '!osc ping', value: 'Test OSC connectivity', inline: false },
        { name: '!osc status', value: 'Show OSC bridge status and stats', inline: false },
        { name: '!osc send <address> [args]', value: 'Send custom OSC message\nExample: `!osc send /ping`', inline: false },
        { name: '!osc git status', value: 'Request git status via OSC', inline: false },
        { name: '!osc git sync', value: 'Trigger git pull/push via OSC', inline: false },
        { name: '!osc agent <name>', value: 'Select an agent\nExample: `!osc agent coder`', inline: false }
      ]
    ) as any]
  });
}

/**
 * Helper to create embeds
 */
function createEmbed(
  title: string, 
  description: string, 
  color: number,
  fields?: { name: string; value: string; inline?: boolean }[]
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();

  if (fields) {
    embed.addFields(fields);
  }

  return embed;
}

/**
 * Parse argument to appropriate type
 */
function parseArg(arg: string): number | string {
  const num = parseFloat(arg);
  if (!isNaN(num)) return num;
  return arg;
}

/**
 * Format uptime to human readable
 */
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
