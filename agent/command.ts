import { SlashCommandBuilder } from "npm:discord.js@14.14.1";
import { PREDEFINED_AGENTS } from "./types.ts";

// Agent command definition
export const agentCommand = new SlashCommandBuilder()
  .setName('agent')
  .setDescription('Interact with specialized AI agents for different development tasks')
  .addStringOption(option =>
    option.setName('action')
      .setDescription('Agent action to perform')
      .setRequired(true)
      .addChoices(
        { name: 'List Agents', value: 'list' },
        { name: 'Select Agent', value: 'select' },
        { name: 'Start Session', value: 'start' },
        { name: 'Chat with Agent', value: 'chat' },
        { name: 'Switch Agent', value: 'switch' },
        { name: 'Agent Status', value: 'status' },
        { name: 'End Session', value: 'end' },
        { name: 'Agent Info', value: 'info' },
        { name: 'Sync Models', value: 'sync_models' }
      ))
  .addStringOption(option =>
    option.setName('agent_name')
      .setDescription('Name of the agent to interact with')
      .setRequired(false)
      .addChoices(
        ...Object.entries(PREDEFINED_AGENTS).map(([key, agent]) => ({
          name: agent.name,
          value: key
        }))
      ))
  .addStringOption(option =>
    option.setName('message')
      .setDescription('Message to send to the agent')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('context_files')
      .setDescription('Comma-separated list of files to include in context')
      .setRequired(false))
  .addBooleanOption(option =>
    option.setName('include_system_info')
      .setDescription('Include system information in context')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('model')
      .setDescription('Override default model for the agent')
      .setRequired(false));

// --- Simple Commands Implementation ---
export const runCommand = new SlashCommandBuilder()
  .setName('run')
  .setDescription('Start a helper agent that will guide you through your task');

export const killCommand = new SlashCommandBuilder()
  .setName('kill')
  .setDescription('Stop the current active agent session');

export const syncCommand = new SlashCommandBuilder()
  .setName('sync')
  .setDescription('Open the current conversation in an IDE (Cursor, VS Code, etc.)');

export const runAdvCommand = new SlashCommandBuilder()
  .setName('run-adv')
  .setDescription('Advanced agent runner with provider, role, and model selection');

export const simpleCommands = [runCommand, killCommand, syncCommand, runAdvCommand];
