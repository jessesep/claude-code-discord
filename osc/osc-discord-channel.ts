/// <reference lib="deno.unstable" />

/**
 * OSC Discord Channel Manager
 * 
 * Creates and manages dedicated Discord channels for OSC testing and monitoring.
 * Bridges OSC messages to Discord for visibility and debugging.
 */

import { ChannelType, TextChannel, EmbedBuilder, Client } from "npm:discord.js@14.14.1";

export interface OSCDiscordConfig {
  categoryName: string;
  guildId?: string;
}

export interface OSCLogEntry {
  direction: 'in' | 'out';
  address: string;
  args: any[];
  timestamp: Date;
  source?: string;
}

/**
 * Manages Discord channels for OSC testing and monitoring
 */
export class OSCDiscordChannel {
  private client: Client | null = null;
  private oscChannel: TextChannel | null = null;
  private oscLogChannel: TextChannel | null = null;
  private categoryName: string;
  private messageBuffer: OSCLogEntry[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private isReady = false;

  constructor(config: OSCDiscordConfig) {
    this.categoryName = config.categoryName;
  }

  /**
   * Initialize with Discord client
   */
  async initialize(client: Client, guildId: string): Promise<void> {
    this.client = client;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      console.error(`[OSC Discord] Guild ${guildId} not found`);
      return;
    }

    try {
      // Find or create OSC category
      let category = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildCategory && c.name === this.categoryName
      );

      if (!category) {
        console.log(`[OSC Discord] Creating category "${this.categoryName}"...`);
        category = await guild.channels.create({
          name: this.categoryName,
          type: ChannelType.GuildCategory,
        });
      }

      // Create osc-control channel (for sending commands)
      this.oscChannel = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildText && 
               c.name === 'osc-control' && 
               c.parentId === category.id
      ) as TextChannel;

      if (!this.oscChannel) {
        console.log(`[OSC Discord] Creating #osc-control channel...`);
        this.oscChannel = await guild.channels.create({
          name: 'osc-control',
          type: ChannelType.GuildText,
          parent: category.id,
          topic: '🎛️ OSC Control Surface | Send OSC commands and see feedback',
        }) as TextChannel;
      }

      // Create osc-log channel (for monitoring traffic)
      this.oscLogChannel = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildText && 
               c.name === 'osc-log' && 
               c.parentId === category.id
      ) as TextChannel;

      if (!this.oscLogChannel) {
        console.log(`[OSC Discord] Creating #osc-log channel...`);
        this.oscLogChannel = await guild.channels.create({
          name: 'osc-log',
          type: ChannelType.GuildText,
          parent: category.id,
          topic: '📋 OSC Message Log | All incoming and outgoing OSC traffic',
        }) as TextChannel;
      }

      this.isReady = true;
      console.log(`[OSC Discord] Channels ready in "${this.categoryName}"`);

      // Start flush interval for batching log messages
      this.flushInterval = setInterval(() => this.flushMessageBuffer(), 2000);

      // Send welcome message
      await this.sendWelcomeMessage();
    } catch (error) {
      console.error(`[OSC Discord] Failed to initialize:`, error);
    }
  }

  /**
   * Send welcome message to osc-control channel
   */
  private async sendWelcomeMessage(): Promise<void> {
    if (!this.oscChannel) return;

    const embed = new EmbedBuilder()
      .setColor(0x00ff88)
      .setTitle('🎛️ OSC Control Surface Ready')
      .setDescription('This channel bridges OSC messages to Discord for testing and monitoring.')
      .addFields(
        { 
          name: '📤 Send OSC Commands', 
          value: 'Type OSC addresses to send them:\n`/ping` `/git/status` `/agent/select/coder`',
          inline: false 
        },
        { 
          name: '📥 Receive Feedback', 
          value: 'All feedback from TouchOSC will appear here.',
          inline: false 
        },
        { 
          name: '🔧 Test Commands', 
          value: '`!osc ping` - Test connectivity\n`!osc status` - Show OSC status\n`!osc send <address> [args]` - Send custom OSC',
          inline: false 
        },
        {
          name: '📊 Ports',
          value: `Bot Listening: \`9000\`\nFeedback Port: \`9001\``,
          inline: true
        }
      )
      .setTimestamp();

    await this.oscChannel.send({ embeds: [embed] });
  }

  /**
   * Log an incoming OSC message
   */
  logIncoming(address: string, args: any[], source?: string): void {
    this.messageBuffer.push({
      direction: 'in',
      address,
      args,
      timestamp: new Date(),
      source
    });
  }

  /**
   * Log an outgoing OSC message (feedback)
   */
  logOutgoing(address: string, args: any[]): void {
    this.messageBuffer.push({
      direction: 'out',
      address,
      args,
      timestamp: new Date()
    });
  }

  /**
   * Flush message buffer to Discord
   */
  private async flushMessageBuffer(): Promise<void> {
    if (!this.oscLogChannel || this.messageBuffer.length === 0) return;

    const messages = [...this.messageBuffer];
    this.messageBuffer = [];

    // Group messages into batches for embedding
    const lines = messages.map(m => {
      const time = m.timestamp.toISOString().split('T')[1].split('.')[0];
      const icon = m.direction === 'in' ? '📥' : '📤';
      const argsStr = m.args.length > 0 ? ` ${JSON.stringify(m.args)}` : '';
      return `\`${time}\` ${icon} \`${m.address}\`${argsStr}`;
    });

    // Send in chunks to avoid message limits
    const chunkSize = 10;
    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunk = lines.slice(i, i + chunkSize);
      
      try {
        await this.oscLogChannel.send({
          content: chunk.join('\n'),
          allowedMentions: { parse: [] }
        });
      } catch (error) {
        console.error('[OSC Discord] Failed to send log:', error);
      }
    }
  }

  /**
   * Send a control message to osc-control channel
   */
  async sendControlMessage(
    title: string, 
    description: string, 
    color: number = 0x0099ff,
    fields?: { name: string; value: string; inline?: boolean }[]
  ): Promise<void> {
    if (!this.oscChannel) return;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp();

    if (fields) {
      embed.addFields(fields);
    }

    try {
      await this.oscChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('[OSC Discord] Failed to send control message:', error);
    }
  }

  /**
   * Send ping result to control channel
   */
  async sendPingResult(success: boolean, latencyMs?: number): Promise<void> {
    await this.sendControlMessage(
      success ? '🏓 Pong!' : '❌ No Response',
      success 
        ? `OSC bridge is active${latencyMs ? ` (${latencyMs}ms)` : ''}`
        : 'No response from OSC bridge',
      success ? 0x00ff00 : 0xff0000
    );
  }

  /**
   * Send feedback received notification
   */
  async sendFeedbackReceived(address: string, args: any[]): Promise<void> {
    if (!this.oscChannel) return;

    const argsStr = args.length > 0 ? args.map(a => `\`${a}\``).join(', ') : '_none_';
    
    await this.sendControlMessage(
      `📥 ${address}`,
      `Args: ${argsStr}`,
      0x00ff88
    );
  }

  /**
   * Get the control channel
   */
  getControlChannel(): TextChannel | null {
    return this.oscChannel;
  }

  /**
   * Get the log channel
   */
  getLogChannel(): TextChannel | null {
    return this.oscLogChannel;
  }

  /**
   * Check if channels are ready
   */
  ready(): boolean {
    return this.isReady;
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    // Flush remaining messages
    this.flushMessageBuffer();
  }
}

/**
 * Factory function
 */
export function createOSCDiscordChannel(categoryName: string = '🎛️ OSC'): OSCDiscordChannel {
  return new OSCDiscordChannel({ categoryName });
}
