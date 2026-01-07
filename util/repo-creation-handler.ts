/**
 * Repository Creation Handler
 * 
 * Handles interactive Discord prompts for creating new repositories
 */

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "npm:discord.js@14.14.1";
import { findSimilarFolders, initializeRepository, createGitHubRepository } from "./repo-initializer.ts";
import { join } from "https://deno.land/std@0.208.0/path/mod.ts";

export interface RepoCreationState {
  categoryName: string;
  channelId: string;
  userId: string;
  similarFolders: string[];
  step: 'confirm' | 'description' | 'github' | 'github-visibility' | 'complete';
  repoPath?: string;
  description?: string;
  createGitHub?: boolean;
  githubVisibility?: 'public' | 'private';
}

// Store active creation states (keyed by channelId)
const creationStates = new Map<string, RepoCreationState>();

/**
 * Get repos base directory
 */
function getReposBaseDir(): string {
  return Deno.env.get('REPOS_BASE_DIR') || 
         Deno.env.get('REPOS_DIR') ||
         (Deno.env.get('HOME') ? `${Deno.env.get('HOME')}/repos` : null) ||
         '/Users/jessesep/repos';
}

/**
 * Check if category folder exists and find similar folders
 */
export async function checkCategoryAndFindSimilar(categoryName: string): Promise<{
  exists: boolean;
  similarFolders: string[];
}> {
  const reposBaseDir = getReposBaseDir();
  const categoryPath = `${reposBaseDir}/${categoryName}`;
  
  // Check if folder exists
  try {
    const stat = await Deno.stat(categoryPath);
    if (stat.isDirectory) {
      return { exists: true, similarFolders: [] };
    }
  } catch {
    // Folder doesn't exist
  }

  // Find similar folders
  const similarFolders = await findSimilarFolders(categoryName, reposBaseDir);
  
  return { exists: false, similarFolders };
}

/**
 * Start repo creation flow - show initial prompt
 */
export async function startRepoCreationFlow(
  categoryName: string,
  channelId: string,
  userId: string,
  similarFolders: string[]
): Promise<{ embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] }> {
  // Store state
  const state: RepoCreationState = {
    categoryName,
    channelId,
    userId,
    similarFolders,
    step: 'confirm',
  };
  creationStates.set(channelId, state);

  // Create embed
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📁 Repository Not Found')
    .setDescription(
      `The category **"${categoryName}"** doesn't match any folder in \`${getReposBaseDir()}\`.\n\n` +
      (similarFolders.length > 0
        ? `**Did you mean one of these?**\n${similarFolders.map(f => `• \`${f}\``).join('\n')}\n\n`
        : '') +
      `Would you like to create a new repository folder with this name?`
    )
    .addFields({
      name: 'What will happen',
      value: '• Create folder: `' + join(getReposBaseDir(), categoryName) + '`\n' +
             '• Initialize git repository\n' +
             '• Create agent system files (.agent-context.md, README.md)\n' +
             '• Set up initial project structure',
    })
    .setTimestamp();

  // Create buttons
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`repo-create-yes-${channelId}`)
        .setLabel('✅ Yes, Create Repository')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`repo-create-no-${channelId}`)
        .setLabel('❌ No, Cancel')
        .setStyle(ButtonStyle.Danger)
    );

  // Add similar folder buttons if available
  if (similarFolders.length > 0) {
    const similarRow = new ActionRowBuilder<ButtonBuilder>();
    for (const folder of similarFolders.slice(0, 3)) {
      similarRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`repo-use-similar-${folder}-${channelId}`)
          .setLabel(`📂 Use: ${folder}`)
          .setStyle(ButtonStyle.Secondary)
      );
    }
    return { embed, components: [row, similarRow] };
  }

  return { embed, components: [row] };
}

/**
 * Handle button interaction for repo creation
 */
export async function handleRepoCreationButton(
  customId: string,
  userId: string,
  channelId: string
): Promise<{ embed: EmbedBuilder; components?: ActionRowBuilder<ButtonBuilder>[]; complete?: boolean } | null> {
  const state = creationStates.get(channelId);
  if (!state || state.userId !== userId) {
    return null;
  }

  // Handle "Yes" button
  if (customId.startsWith(`repo-create-yes-${channelId}`)) {
    state.step = 'description';
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📝 Repository Description')
      .setDescription(
        `Creating repository: **${state.categoryName}**\n\n` +
        `Please provide a description for this repository. You can:\n` +
        `• Type a description in this channel\n` +
        `• Or click "Skip" to use a default description`
      )
      .addFields({
        name: 'Repository Path',
        value: '`' + join(getReposBaseDir(), state.categoryName) + '`',
      })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`repo-skip-desc-${channelId}`)
          .setLabel('⏭️ Skip Description')
          .setStyle(ButtonStyle.Secondary)
      );

    return { embed, components: [row] };
  }

  // Handle "No" button
  if (customId.startsWith(`repo-create-no-${channelId}`)) {
    creationStates.delete(channelId);
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Repository Creation Cancelled')
      .setDescription('Repository creation has been cancelled.')
      .setTimestamp();
    return { embed, complete: true };
  }

  // Handle similar folder selection
  if (customId.startsWith(`repo-use-similar-`)) {
    const folderMatch = customId.match(/repo-use-similar-(.+?)-(\d+)/);
    if (folderMatch) {
      const folderName = folderMatch[1];
      const repoPath = join(getReposBaseDir(), folderName);
      creationStates.delete(channelId);
      
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Using Existing Repository')
        .setDescription(`Using existing repository: **${folderName}**\n\nPath: \`${repoPath}\``)
        .setTimestamp();
      
      return { embed, complete: true };
    }
  }

  // Handle skip description
  if (customId.startsWith(`repo-skip-desc-${channelId}`)) {
    state.description = `A new project: ${state.categoryName}`;
    return await promptForGitHub(channelId);
  }

  // Handle GitHub creation buttons
  if (customId.startsWith(`repo-github-yes-${channelId}`)) {
    state.createGitHub = true;
    state.step = 'github-visibility';
    return await promptForGitHubVisibility(channelId);
  }

  if (customId.startsWith(`repo-github-no-${channelId}`)) {
    state.createGitHub = false;
    return await completeRepoCreation(channelId);
  }

  // Handle visibility selection
  if (customId.startsWith(`repo-visibility-public-${channelId}`)) {
    state.githubVisibility = 'public';
    return await completeRepoCreation(channelId);
  }

  if (customId.startsWith(`repo-visibility-private-${channelId}`)) {
    state.githubVisibility = 'private';
    return await completeRepoCreation(channelId);
  }

  return null;
}

/**
 * Handle description message
 */
export async function handleDescriptionMessage(
  channelId: string,
  description: string
): Promise<{ embed: EmbedBuilder; components?: ActionRowBuilder<ButtonBuilder>[] } | null> {
  const state = creationStates.get(channelId);
  if (!state || state.step !== 'description') {
    return null;
  }

  state.description = description;
  return await promptForGitHub(channelId);
}

/**
 * Prompt for GitHub creation
 */
async function promptForGitHub(channelId: string): Promise<{ embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] }> {
  const state = creationStates.get(channelId)!;
  state.step = 'github';

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🐙 GitHub Repository')
    .setDescription(
      `Would you like to create a GitHub repository for **${state.categoryName}**?\n\n` +
      `This will:\n` +
      `• Create a repository on GitHub\n` +
      `• Push your local code to GitHub\n` +
      `• Set up the remote origin`
    )
    .addFields({
      name: 'Note',
      value: 'You need GitHub CLI (`gh`) installed and authenticated.',
    })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`repo-github-yes-${channelId}`)
        .setLabel('✅ Yes, Create GitHub Repo')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`repo-github-no-${channelId}`)
        .setLabel('⏭️ Skip GitHub')
        .setStyle(ButtonStyle.Secondary)
    );

  return { embed, components: [row] };
}

/**
 * Prompt for GitHub visibility
 */
async function promptForGitHubVisibility(channelId: string): Promise<{ embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] }> {
  const state = creationStates.get(channelId)!;

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🔒 Repository Visibility')
    .setDescription(`Choose visibility for **${state.categoryName}** on GitHub:`)
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`repo-visibility-public-${channelId}`)
        .setLabel('🌐 Public')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`repo-visibility-private-${channelId}`)
        .setLabel('🔒 Private')
        .setStyle(ButtonStyle.Danger)
    );

  return { embed, components: [row] };
}

/**
 * Complete repository creation
 */
async function completeRepoCreation(channelId: string): Promise<{ embed: EmbedBuilder; complete: boolean }> {
  const state = creationStates.get(channelId)!;
  if (!state) {
    throw new Error('No creation state found');
  }

  const reposBaseDir = getReposBaseDir();
  const repoPath = join(reposBaseDir, state.categoryName);

  // Initialize repository
  const initResult = await initializeRepository({
    repoName: state.categoryName,
    repoPath,
    description: state.description,
    createGitHub: state.createGitHub,
    githubVisibility: state.githubVisibility,
  });

  if (!initResult.success) {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Repository Creation Failed')
      .setDescription(`Failed to create repository: ${initResult.error}`)
      .setTimestamp();
    creationStates.delete(channelId);
    return { embed: errorEmbed, complete: true };
  }

  // Create GitHub repo if requested
  let githubUrl: string | undefined;
  if (state.createGitHub && state.githubVisibility) {
    const githubResult = await createGitHubRepository(
      repoPath,
      state.categoryName,
      state.githubVisibility,
      state.description
    );

    if (githubResult.success) {
      githubUrl = githubResult.url;
    }
  }

  // Create success embed
  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('✅ Repository Created Successfully')
    .setDescription(
      `Repository **${state.categoryName}** has been created!\n\n` +
      `**Path:** \`${repoPath}\`\n` +
      `**Git:** ${initResult.gitInitialized ? '✅ Initialized' : '❌ Not initialized'}\n` +
      (githubUrl ? `**GitHub:** [View Repository](${githubUrl})\n` : '') +
      (state.description ? `\n**Description:** ${state.description}` : '')
    )
    .addFields({
      name: 'Next Steps',
      value: 'You can now use this repository in your Discord channel. The agent will automatically use this folder when working in this category.',
    })
    .setTimestamp();

  creationStates.delete(channelId);
  return { embed, complete: true };
}

/**
 * Get creation state for a channel
 */
export function getCreationState(channelId: string): RepoCreationState | undefined {
  return creationStates.get(channelId);
}

/**
 * Check if a channel has an active creation flow
 */
export function hasActiveCreation(channelId: string): boolean {
  return creationStates.has(channelId);
}
