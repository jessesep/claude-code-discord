import { SlashCommandBuilder } from "npm:discord.js@14.14.1";
import { AGENT_MODELS, AGENT_TEMPLATES } from "./enhanced-client.ts";

export const enhancedAgentCommands = [
  new SlashCommandBuilder()
    .setName('agent-enhanced')
    .setDescription('Send message to agent with advanced options')
    .addStringOption(option =>
      option.setName('prompt')
        .setDescription('Prompt for agent')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('model')
        .setDescription('Agent model to use')
        .setRequired(false)
        .addChoices(
          ...Object.entries(AGENT_MODELS).map(([value, model]) => ({
            name: model.name,
            value: value
          }))
        ))
    .addStringOption(option =>
      option.setName('template')
        .setDescription('Use a predefined template')
        .setRequired(false)
        .addChoices(
          ...Object.entries(AGENT_TEMPLATES).map(([key, value]) => ({
            name: key.charAt(0).toUpperCase() + key.slice(1),
            value: key
          }))
        ))
    .addBooleanOption(option =>
      option.setName('include_system_info')
        .setDescription('Include system information in context')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('include_git_context')
        .setDescription('Include git repository context')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('context_files')
        .setDescription('Comma-separated list of files to include in context')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('session_id')
        .setDescription('Session ID to continue (optional)')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('agent-models')
    .setDescription('List available agent models and their capabilities'),

  new SlashCommandBuilder()
    .setName('agent-sessions')
    .setDescription('Manage agent sessions')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Action to perform')
        .setRequired(true)
        .addChoices(
          { name: 'list', value: 'list' },
          { name: 'info', value: 'info' },
          { name: 'delete', value: 'delete' },
          { name: 'cleanup', value: 'cleanup' }
        ))
    .addStringOption(option =>
      option.setName('session_id')
        .setDescription('Session ID (required for info/delete actions)')
        .setRequired(false)),

  // NOTE: templates command removed as requested
  // Template functionality is now handled through enhanced prompting

  new SlashCommandBuilder()
    .setName('agent-context')
    .setDescription('Show context information that would be sent to agent')
    .addBooleanOption(option =>
      option.setName('include_system_info')
        .setDescription('Include system information')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('include_git_context')
        .setDescription('Include git context')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('context_files')
        .setDescription('Comma-separated list of files to preview')
        .setRequired(false))
];

export interface EnhancedAgentHandlerDeps {
  workDir: string;
  agentController: AbortController | null;
  setAgentController: (controller: AbortController | null) => void;
  setAgentSessionId: (sessionId: string | undefined) => void;
  sendAgentMessages: (messages: any[]) => Promise<void>;
  sessionManager: any;
  crashHandler: any;
}

export function createEnhancedAgentHandlers(deps: EnhancedAgentHandlerDeps) {
  const { workDir, sessionManager, crashHandler, sendAgentMessages } = deps;
  
  return {
    async onAgentEnhanced(
      ctx: any,
      prompt: string,
      model?: string,
      template?: string,
      includeSystemInfo?: boolean,
      includeGitContext?: boolean,
      contextFiles?: string,
      sessionId?: string
    ) {
      try {
        // Cancel any existing session
        if (deps.agentController) {
          deps.agentController.abort();
        }

        const controller = new AbortController();
        deps.setAgentController(controller);

        await ctx.deferReply();

        // Apply template if specified
        let enhancedPrompt = prompt;
        if (template && AGENT_TEMPLATES[template as keyof typeof AGENT_TEMPLATES]) {
          const templateText = AGENT_TEMPLATES[template as keyof typeof AGENT_TEMPLATES];
          enhancedPrompt = `${templateText}\n\n${prompt}`;
        }

        // Parse context files
        const contextFilesList = contextFiles ? 
          contextFiles.split(',').map(f => f.trim()).filter(f => f.length > 0) : 
          undefined;

        await ctx.editReply({
          embeds: [{
            color: 0xffff00,
            title: '🤖 Enhanced Agent Running...',
            description: 'Processing with advanced options...',
            fields: [
              { name: 'Model', value: model || 'Default', inline: true },
              { name: 'Template', value: template || 'None', inline: true },
              { name: 'System Info', value: includeSystemInfo ? 'Yes' : 'No', inline: true },
              { name: 'Git Context', value: includeGitContext ? 'Yes' : 'No', inline: true },
              { name: 'Context Files', value: contextFilesList?.length ? `${contextFilesList.length} files` : 'None', inline: true },
              { name: 'Prompt Preview', value: `\`${enhancedPrompt.substring(0, 200)}${enhancedPrompt.length > 200 ? '...' : ''}\``, inline: false }
            ],
            timestamp: true
          }]
        });

        const { enhancedAgentQuery } = await import("./enhanced-client.ts");

        const result = await enhancedAgentQuery(
          enhancedPrompt,
          {
            workDir,
            model,
            includeSystemInfo: !!includeSystemInfo,
            includeGitContext: !!includeGitContext,
            contextFiles: contextFilesList
          },
          controller,
          sessionId,
          undefined,
          async (jsonData) => {
            const { convertToClaudeMessages } = await import("./message-converter.ts");
            const agentMessages = convertToClaudeMessages(jsonData);
            if (agentMessages.length > 0) {
              sendAgentMessages(agentMessages).catch(() => {});
            }
          },
          false
        );

        deps.setAgentSessionId(result.sessionId);
        deps.setAgentController(null);

        // Update session manager
        if (result.sessionId) {
          sessionManager.updateSession(result.sessionId, result.cost);
          
          await sendAgentMessages([{
            type: 'system',
            content: '',
            metadata: {
              subtype: 'completion',
              session_id: result.sessionId,
              model: result.modelUsed || model || 'Default',
              total_cost_usd: result.cost,
              duration_ms: result.duration,
              cwd: workDir,
              enhanced_options: {
                template,
                includeSystemInfo,
                includeGitContext,
                contextFiles: contextFilesList?.length || 0
              }
            }
          }]);
        }

        return result;
      } catch (error) {
        await crashHandler.reportCrash('claude', error instanceof Error ? error : new Error(String(error)), 'enhanced', 'Enhanced Claude query');
        throw error;
      }
    },

    async onAgentModels(ctx: any) {
      const modelsList = Object.entries(AGENT_MODELS).map(([key, model]) => {
        const recommended = model.recommended ? ' ⭐' : '';
        return `**${model.name}${recommended}**\n${model.description}\nContext: ${model.contextWindow.toLocaleString()} tokens\nID: \`${key}\``;
      }).join('\n\n');

      await ctx.reply({
        embeds: [{
          color: 0x0099ff,
          title: '🤖 Available Models',
          description: modelsList,
          footer: { text: '⭐ = Recommended for general use' },
          timestamp: true
        }],
        ephemeral: true
      });
    },

    async onAgentSessions(ctx: any, action: string, sessionId?: string) {
      try {
        switch (action) {
          case 'list':
            const sessions = sessionManager.getAllSessions();
            if (sessions.length === 0) {
              await ctx.reply({
                embeds: [{
                  color: 0xffaa00,
                  title: '📋 Agent Sessions',
                  description: 'No active sessions found.',
                  timestamp: true
                }],
                ephemeral: true
              });
              return;
            }

            const sessionsList = sessions.map((session: any) => {
              const uptime = Date.now() - session.startTime.getTime();
              const uptimeStr = formatDuration(uptime);
              return `**${session.id.substring(0, 12)}...**\nMessages: ${session.messageCount} | Cost: $${session.totalCost.toFixed(4)} | Uptime: ${uptimeStr}\nModel: ${session.model}`;
            }).join('\n\n');

            await ctx.reply({
              embeds: [{
                color: 0x00ff00,
                title: '📋 Active Agent Sessions',
                description: sessionsList,
                footer: { text: `Total: ${sessions.length} sessions` },
                timestamp: true
              }],
              ephemeral: true
            });
            break;

          case 'info':
            if (!sessionId) {
              await ctx.reply({
                content: 'Session ID is required for info action.',
                ephemeral: true
              });
              return;
            }

            const session = sessionManager.getSession(sessionId);
            if (!session) {
              await ctx.reply({
                content: 'Session not found.',
                ephemeral: true
              });
              return;
            }

            const sessionUptime = Date.now() - session.startTime.getTime();
            const lastActivity = Date.now() - session.lastActivity.getTime();

            await ctx.reply({
              embeds: [{
                color: 0x0099ff,
                title: '📊 Session Details',
                fields: [
                  { name: 'Session ID', value: `\`${session.id}\``, inline: false },
                  { name: 'Model', value: session.model, inline: true },
                  { name: 'Messages', value: session.messageCount.toString(), inline: true },
                  { name: 'Total Cost', value: `$${session.totalCost.toFixed(4)}`, inline: true },
                  { name: 'Started', value: session.startTime.toLocaleString(), inline: true },
                  { name: 'Last Activity', value: `${formatDuration(lastActivity)} ago`, inline: true },
                  { name: 'Uptime', value: formatDuration(sessionUptime), inline: true },
                  { name: 'Working Directory', value: `\`${session.workDir}\``, inline: false }
                ],
                timestamp: true
              }],
              ephemeral: true
            });
            break;

          case 'delete':
            if (!sessionId) {
              await ctx.reply({
                content: 'Session ID is required for delete action.',
                ephemeral: true
              });
              return;
            }

            const deleted = sessionManager.deleteSession(sessionId);
            await ctx.reply({
              embeds: [{
                color: deleted ? 0x00ff00 : 0xff0000,
                title: deleted ? '✅ Session Deleted' : '❌ Session Not Found',
                description: deleted ? `Session ${sessionId.substring(0, 12)}... has been deleted.` : 'The specified session was not found.',
                timestamp: true
              }],
              ephemeral: true
            });
            break;

          case 'cleanup':
            const cleanedCount = sessionManager.cleanup();
            await ctx.reply({
              embeds: [{
                color: 0x00ff00,
                title: '🧹 Sessions Cleaned Up',
                description: `Removed ${cleanedCount} old sessions (older than 24 hours).`,
                timestamp: true
              }],
              ephemeral: true
            });
            break;
        }
      } catch (error) {
        await crashHandler.reportCrash('main', error instanceof Error ? error : new Error(String(error)), 'claude-sessions', `Action: ${action}`);
        throw error;
      }
    },

    // NOTE: onClaudeTemplates handler removed as the claude-templates command was removed
    // Template functionality is now handled through the enhanced prompting system

    async onAgentContext(
      ctx: any,
      includeSystemInfo?: boolean,
      includeGitContext?: boolean,
      contextFiles?: string
    ) {
      try {
        await ctx.deferReply({ ephemeral: true });

        const contextParts: string[] = [];

        if (includeSystemInfo) {
          try {
            const systemInfo = `System: ${Deno.build.os} ${Deno.build.arch}\nDeno: ${Deno.version.deno}\nWorking Directory: ${workDir}`;
            contextParts.push(`**System Information:**\n\`\`\`\n${systemInfo}\n\`\`\``);
          } catch (error) {
            contextParts.push(`**System Information:** Error - ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        if (includeGitContext) {
          try {
            const { executeGitCommand } = await import("../git/handler.ts");
            const [branch, status] = await Promise.all([
              executeGitCommand(workDir, "git branch --show-current"),
              executeGitCommand(workDir, "git status --porcelain")
            ]);
            
            const gitInfo = `Branch: ${branch.trim()}\nStatus: ${status || 'Clean'}`;
            contextParts.push(`**Git Context:**\n\`\`\`\n${gitInfo}\n\`\`\``);
          } catch (error) {
            contextParts.push(`**Git Context:** Error - ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        if (contextFiles) {
          const fileList = contextFiles.split(',').map(f => f.trim()).filter(f => f.length > 0);
          const fileContents: string[] = [];

          for (const filePath of fileList.slice(0, 5)) { // Limit to 5 files
            try {
              const content = await Deno.readTextFile(filePath);
              const preview = content.length > 200 ? content.substring(0, 200) + '...' : content;
              fileContents.push(`**${filePath}:**\n\`\`\`\n${preview}\n\`\`\``);
            } catch (error) {
              fileContents.push(`**${filePath}:** Error reading file`);
            }
          }

          if (fileList.length > 5) {
            fileContents.push(`**... and ${fileList.length - 5} more files**`);
          }

          contextParts.push(fileContents.join('\n\n'));
        }

        const fullContext = contextParts.join('\n\n');

        await ctx.editReply({
          embeds: [{
            color: 0x0099ff,
            title: '📋 Agent Context Preview',
            description: fullContext || 'No context selected. Enable options to see what would be included.',
            footer: { text: 'This is what would be sent to the agent as additional context' },
            timestamp: true
          }]
        });
      } catch (error) {
        await crashHandler.reportCrash('main', error instanceof Error ? error : new Error(String(error)), 'agent-context', 'Context preview');
        throw error;
      }
    }
  };
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}