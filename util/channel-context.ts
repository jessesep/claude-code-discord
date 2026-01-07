/**
 * Channel Context Manager
 * 
 * Extracts project/workspace information from Discord channels based on:
 * 1. Channel topic (most reliable - contains full path)
 * 2. Category name (contains repo name)
 * 3. Config file mapping (manual overrides)
 */

export interface ChannelProjectContext {
  channelId: string;
  channelName: string;
  categoryName: string | null;
  projectPath: string;
  repoName: string;
  branchName: string;
  source: 'topic' | 'category' | 'config' | 'default';
}

export interface CategoryNotFoundResult {
  categoryName: string;
  similarFolders: string[];
  needsUserPrompt: true;
}

export class ChannelContextManager {
  private channelCache = new Map<string, ChannelProjectContext>();
  private defaultWorkDir: string;

  constructor(defaultWorkDir?: string) {
    this.defaultWorkDir = defaultWorkDir || Deno.cwd();
  }

  /**
   * Extract project context from a Discord channel
   * Returns null if not found, or CategoryNotFoundResult if category doesn't exist (needs user prompt)
   */
  async getChannelContext(channel: any): Promise<ChannelProjectContext | CategoryNotFoundResult | null> {
    if (!channel || !channel.id) {
      return null;
    }

    // 1. Check cache
    if (this.channelCache.has(channel.id)) {
      return this.channelCache.get(channel.id)!;
    }

    // 2. Try to extract from channel topic (most reliable)
    const topicContext = await this.extractFromTopic(channel);
    if (topicContext) {
      this.channelCache.set(channel.id, topicContext);
      return topicContext;
    }

    // 3. Try to extract from category name
    const categoryResult = await this.extractFromCategory(channel);
    if (categoryResult && 'needsUserPrompt' in categoryResult) {
      // Category not found, return result with similar folders
      return categoryResult;
    }
    if (categoryResult) {
      this.channelCache.set(channel.id, categoryResult);
      return categoryResult;
    }

    // 4. Try config file mapping
    const configContext = await this.extractFromConfig(channel);
    if (configContext) {
      this.channelCache.set(channel.id, configContext);
      return configContext;
    }

    return null;
  }

  /**
   * Extract context from channel topic
   * Format: "Repository: ${repoName} | Branch: ${branchName} | Machine: ${machine} | Path: ${workDir}"
   */
  private async extractFromTopic(channel: any): Promise<ChannelProjectContext | null> {
    if (!channel.topic) {
      return null;
    }

    try {
      // Parse: "Repository: ${repoName} | Branch: ${branchName} | Machine: ${machine} | Path: ${workDir}"
      const pathMatch = channel.topic.match(/Path:\s*(.+?)(?:\s*\||$)/);
      const repoMatch = channel.topic.match(/Repository:\s*(.+?)(?:\s*\||$)/);
      const branchMatch = channel.topic.match(/Branch:\s*(.+?)(?:\s*\||$)/);

      if (pathMatch && repoMatch) {
        const projectPath = pathMatch[1].trim();
        const repoName = repoMatch[1].trim();
        const branchName = branchMatch ? branchMatch[1].trim() : 'main';

        // Validate path exists
        try {
          const stat = await Deno.stat(projectPath);
          if (!stat.isDirectory) {
            console.warn(`[ChannelContext] Path exists but is not a directory: ${projectPath}`);
            return null;
          }
        } catch {
          console.warn(`[ChannelContext] Path does not exist: ${projectPath}`);
          return null;
        }

        const category = channel.parent ? channel.parent.name : null;

        return {
          channelId: channel.id,
          channelName: channel.name || 'unknown',
          categoryName: category,
          projectPath,
          repoName,
          branchName,
          source: 'topic'
        };
      }
    } catch (error) {
      console.warn(`[ChannelContext] Error parsing topic: ${error}`);
    }

    return null;
  }

  /**
   * Extract context from category name
   * Format: "categoryName (repoName)" or just "repoName"
   * 
   * Priority:
   * 1. Try category name directly as folder in repos directory (e.g., category "my-project" -> /Users/jessesep/repos/my-project)
   * 2. Parse "categoryName (repoName)" format and use repoName
   * 3. Use category name as-is and search common locations
   * 4. If not found, return CategoryNotFoundResult with similar folders
   */
  private async extractFromCategory(channel: any): Promise<ChannelProjectContext | CategoryNotFoundResult | null> {
    if (!channel.parent) {
      return null;
    }

    try {
      const categoryName = channel.parent.name;
      
      // First, try using the category name directly as a folder in the repos directory
      // This allows categories like "my-project" to map to /Users/jessesep/repos/my-project
      const categoryBasedPath = await this.findCategoryBasedPath(categoryName);
      if (categoryBasedPath) {
        return {
          channelId: channel.id,
          channelName: channel.name || 'unknown',
          categoryName: categoryName,
          projectPath: categoryBasedPath,
          repoName: categoryName, // Use category name as repo name
          branchName: channel.name || 'main', // Channel name is usually branch name
          source: 'category'
        };
      }

      // Fallback: Parse: "categoryName (repoName)" or just "repoName"
      const match = categoryName.match(/^(.+?)\s*\((.+?)\)$|^(.+)$/);

      if (match) {
        const repoName = match[2] || match[3] || categoryName;
        // Try to find project directory for this repo
        const projectPath = await this.findProjectPath(repoName);

        if (projectPath) {
          return {
            channelId: channel.id,
            channelName: channel.name || 'unknown',
            categoryName: categoryName,
            projectPath,
            repoName,
            branchName: channel.name || 'main', // Channel name is usually branch name
            source: 'category'
          };
        }
      }

      // Category not found - check for similar folders and return result for user prompt
      const { findSimilarFolders } = await import("./repo-initializer.ts");
      const reposBaseDir = this.getReposBaseDir();
      const similarFolders = await findSimilarFolders(categoryName, reposBaseDir);
      
      return {
        categoryName,
        similarFolders,
        needsUserPrompt: true,
      };
    } catch (error) {
      console.warn(`[ChannelContext] Error parsing category: ${error}`);
    }

    return null;
  }

  /**
   * Extract context from config file mapping
   */
  private async extractFromConfig(channel: any): Promise<ChannelProjectContext | null> {
    try {
      const configPath = 'data/channel-mappings.json';
      const configText = await Deno.readTextFile(configPath);
      const config = JSON.parse(configText);
      const mapping = config.channels?.[channel.id];

      if (mapping && mapping.projectPath) {
        // Validate path exists
        try {
          const stat = await Deno.stat(mapping.projectPath);
          if (!stat.isDirectory) {
            console.warn(`[ChannelContext] Config path is not a directory: ${mapping.projectPath}`);
            return null;
          }
        } catch {
          console.warn(`[ChannelContext] Config path does not exist: ${mapping.projectPath}`);
          return null;
        }

        return {
          channelId: channel.id,
          channelName: channel.name || 'unknown',
          categoryName: channel.parent?.name || null,
          projectPath: mapping.projectPath,
          repoName: mapping.repoName || 'unknown',
          branchName: mapping.branchName || channel.name || 'main',
          source: 'config'
        };
      }
    } catch (error) {
      // Config file doesn't exist or invalid - this is expected for most channels
      if (error instanceof Deno.errors.NotFound) {
        // File doesn't exist, that's fine
      } else {
        console.debug(`[ChannelContext] Config file error: ${error}`);
      }
    }

    return null;
  }

  /**
   * Find project path based on category name
   * Tries category name directly as folder in repos directory
   * Supports environment variable REPOS_BASE_DIR (defaults to ~/repos or /Users/jessesep/repos)
   */
  private async findCategoryBasedPath(categoryName: string): Promise<string | null> {
    // Get base repos directory from environment or default
    const reposBaseDir = Deno.env.get('REPOS_BASE_DIR') || 
                         Deno.env.get('REPOS_DIR') ||
                         (Deno.env.get('HOME') ? `${Deno.env.get('HOME')}/repos` : null) ||
                         '/Users/jessesep/repos';
    
    // Try category name directly as folder name
    const categoryPath = `${reposBaseDir}/${categoryName}`;
    try {
      const stat = await Deno.stat(categoryPath);
      if (stat.isDirectory) {
        console.log(`[ChannelContext] Found category-based path: ${categoryPath}`);
        return categoryPath;
      }
    } catch {
      // Not found, continue to other methods
    }

    return null;
  }

  /**
   * Find project path for a repository name
   * Tries common locations and environment variables
   */
  private async findProjectPath(repoName: string): Promise<string | null> {
    const commonPaths = [
      Deno.env.get('PROJECTS_DIR'),
      Deno.env.get('REPOS_DIR'),
      Deno.env.get('REPOSITORIES_DIR'),
      Deno.env.get('REPOS_BASE_DIR'), // Also check REPOS_BASE_DIR
      Deno.env.get('HOME') ? `${Deno.env.get('HOME')}/repos` : null,
      Deno.env.get('HOME') ? `${Deno.env.get('HOME')}/projects` : null,
      Deno.env.get('HOME') ? `${Deno.env.get('HOME')}/code` : null,
      '/Users/jessesep/repos', // Explicit fallback for jessesep/repos
    ].filter((p): p is string => p !== null && p !== undefined);

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

    // Also try relative to current working directory
    const relativePath = `../${repoName}`;
    try {
      const stat = await Deno.stat(relativePath);
      if (stat.isDirectory) {
        return relativePath;
      }
    } catch {
      // Not found
    }

    return null;
  }

  /**
   * Invalidate cache for a channel (call when channel is updated)
   */
  invalidateCache(channelId: string): void {
    this.channelCache.delete(channelId);
  }

  /**
   * Clear all cached contexts
   */
  clearCache(): void {
    this.channelCache.clear();
  }

  /**
   * Get default work directory
   */
  getDefaultWorkDir(): string {
    return this.defaultWorkDir;
  }

  /**
   * Get repos base directory
   */
  private getReposBaseDir(): string {
    return Deno.env.get('REPOS_BASE_DIR') || 
           Deno.env.get('REPOS_DIR') ||
           (Deno.env.get('HOME') ? `${Deno.env.get('HOME')}/repos` : null) ||
           '/Users/jessesep/repos';
  }
}
