import { Client, GatewayIntentBits, TextChannel, Message } from 'npm:discord.js@14';

export const CLAUDE_BOT_ID = Deno.env.get('CLAUDE_BOT_ID') || '1457705423137275914';
export const CHANNEL_ID = Deno.env.get('TEST_CHANNEL_ID') || '1458093359162986620';
export const TEST_BOT_TOKEN = Deno.env.get('TEST_BOT_TOKEN') || '';

export interface TestContext {
  tester: Client;
  channel: TextChannel;
  startTime: number;
}

export async function setupTester(): Promise<TestContext> {
  if (!TEST_BOT_TOKEN) {
    throw new Error('TEST_BOT_TOKEN environment variable is required');
  }

  const tester = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
    ],
  });

  return new Promise((resolve, reject) => {
    tester.once('ready', async () => {
      try {
        const channel = await tester.channels.fetch(CHANNEL_ID);
        if (!channel || !(channel instanceof TextChannel)) {
          throw new Error('Could not find test channel');
        }
        resolve({
          tester,
          channel,
          startTime: Date.now()
        });
      } catch (err) {
        tester.destroy();
        reject(err);
      }
    });
    tester.login(TEST_BOT_TOKEN).catch(reject);
  });
}

export async function waitForResult(
  ctx: TestContext, 
  timeoutMs: number,
  condition: (messages: Message[]) => boolean
): Promise<{ success: boolean; messages: Message[]; error?: string }> {
  const messagesMap = new Map<string, Message>();
  
  return new Promise((resolve) => {
    const onMessage = (msg: Message) => {
      if (msg.channelId !== ctx.channel.id) return;
      if (msg.author.id === ctx.tester.user?.id) return;
      
      console.log(`📩 Message from ${msg.author.tag}: ${msg.content || '(embed)'}`);
      if (msg.embeds.length > 0) {
        msg.embeds.forEach(e => console.log(`   Embed Title: ${e.title}, Desc: ${e.description?.substring(0, 50)}...`));
      }
      
      messagesMap.set(msg.id, msg);
      const messages = Array.from(messagesMap.values());
      if (condition(messages)) {
        cleanup();
        resolve({ success: true, messages });
      }
    };

    const onUpdate = (oldMsg: Message, newMsg: Message) => {
      if (newMsg.channelId !== ctx.channel.id) return;
      if (newMsg.author.id === ctx.tester.user?.id) return;
      
      console.log(`🔄 Update from ${newMsg.author.tag}: ${newMsg.content || '(embed)'}`);
      if (newMsg.embeds.length > 0) {
        newMsg.embeds.forEach(e => console.log(`   Embed Title: ${e.title}, Desc: ${e.description?.substring(0, 50)}...`));
      }

      messagesMap.set(newMsg.id, newMsg);
      const messages = Array.from(messagesMap.values());
      if (condition(messages)) {
        cleanup();
        resolve({ success: true, messages });
      }
    };

    const cleanup = () => {
      ctx.tester.off('messageCreate', onMessage);
      ctx.tester.off('messageUpdate', onUpdate);
      clearTimeout(timeout);
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve({ 
        success: false, 
        messages: Array.from(messagesMap.values()), 
        error: `Timed out after ${timeoutMs/1000}s` 
      });
    }, timeoutMs);

    ctx.tester.on('messageCreate', onMessage);
    ctx.tester.on('messageUpdate', onUpdate);
  });
}

export const isFinalResponse = (messages: Message[]) => {
  return messages.some(r => 
    r.author.id === CLAUDE_BOT_ID && 
    (r.content?.toLowerCase().includes('task completed') || 
     r.content?.toLowerCase().includes('done.') ||
     r.embeds?.some((e: any) => 
      e.title?.toLowerCase().includes('result') || 
      e.title?.toLowerCase().includes('completed') ||
      e.title?.toLowerCase().includes('summary') ||
      e.title?.includes('✅') ||
      e.title?.includes('🏁') ||
      e.description?.toLowerCase().includes('successfully') ||
      e.description?.toLowerCase().includes('created') ||
      e.description?.toLowerCase().includes('finished') ||
      e.description?.toLowerCase().includes('done') ||
      e.fields?.some((f: any) => 
        (f.name.toLowerCase().includes('status') && f.value.toLowerCase().includes('complete')) ||
        (f.name.toLowerCase().includes('result') && f.value.length > 0)
      )
    ))
  );
};

/**
 * Budget-friendly testing utilities
 */
export const BUDGET_MODEL = "gemini-3-flash";

export function getBudgetPrompt(agent: string, task: string): string {
  return `<@${CLAUDE_BOT_ID}> using ${agent}, with model="${BUDGET_MODEL}", ${task}`;
}

export const hasError = (messages: Message[]) => {
  return messages.some(r => 
    r.author.id === CLAUDE_BOT_ID && 
    (r.content?.toLowerCase().includes('error') || 
     r.content?.toLowerCase().includes('not found') ||
     r.content?.toLowerCase().includes('does not exist') ||
     r.embeds?.some((e: any) => 
       e.title?.toLowerCase().includes('error') || 
       e.title?.includes('❌') ||
       e.description?.toLowerCase().includes('error') ||
       e.description?.toLowerCase().includes('failed') ||
       e.description?.toLowerCase().includes('not found') ||
       e.description?.toLowerCase().includes('does not exist')
     ))
  );
};
