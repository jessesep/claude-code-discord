// Repository management system
import { existsSync } from "https://deno.land/std@0.208.0/fs/mod.ts";
import { join, basename } from "https://deno.land/std@0.208.0/path/mod.ts";

export interface RepoInfo {
  name: string;
  path: string;
  branch: string;
  isGit: boolean;
}

export class RepoManager {
  private static instance: RepoManager;
  private repos: Map<string, RepoInfo> = new Map();
  private basePath: string;
  private currentRepo: string | null = null;

  private constructor(basePath: string = Deno.cwd()) {
    this.basePath = basePath;
  }

  static getInstance(basePath?: string): RepoManager {
    if (!RepoManager.instance) {
      RepoManager.instance = new RepoManager(basePath);
    }
    return RepoManager.instance;
  }

  /**
   * Scan for repositories in the base path and subdirectories
   */
  async scanRepositories(scanDepth: number = 2): Promise<RepoInfo[]> {
    const repos: RepoInfo[] = [];
    
    try {
      // Check base path itself
      if (await this.isGitRepository(this.basePath)) {
        const repoInfo = await this.getRepoInfo(this.basePath);
        if (repoInfo) {
          repos.push(repoInfo);
          this.repos.set(repoInfo.name, repoInfo);
        }
      }

      // Scan subdirectories up to scanDepth levels
      await this.scanDirectory(this.basePath, repos, scanDepth, 0);
      
      // Update internal map
      repos.forEach(repo => {
        this.repos.set(repo.name, repo);
      });

      return repos;
    } catch (error) {
      console.error("[RepoManager] Error scanning repositories:", error);
      return repos;
    }
  }

  private async scanDirectory(
    dir: string,
    repos: RepoInfo[],
    maxDepth: number,
    currentDepth: number
  ): Promise<void> {
    if (currentDepth >= maxDepth) return;

    try {
      const entries = Deno.readDir(dir);
      
      for await (const entry of entries) {
        if (entry.isDirectory && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const fullPath = join(dir, entry.name);
          
          // Check if this directory is a git repo
          if (await this.isGitRepository(fullPath)) {
            const repoInfo = await this.getRepoInfo(fullPath);
            if (repoInfo && !repos.find(r => r.path === repoInfo.path)) {
              repos.push(repoInfo);
            }
          } else {
            // Recursively scan subdirectories
            await this.scanDirectory(fullPath, repos, maxDepth, currentDepth + 1);
          }
        }
      }
    } catch (error) {
      // Ignore permission errors or inaccessible directories
      console.debug(`[RepoManager] Could not scan ${dir}:`, error);
    }
  }

  private async isGitRepository(path: string): Promise<boolean> {
    try {
      const gitDir = join(path, '.git');
      return existsSync(gitDir);
    } catch {
      return false;
    }
  }

  private async getRepoInfo(path: string): Promise<RepoInfo | null> {
    try {
      const name = basename(path);
      
      // Try to get branch name
      let branch = 'main';
      try {
        const command = new Deno.Command('git', {
          args: ['branch', '--show-current'],
          cwd: path,
          stdout: 'piped',
          stderr: 'piped',
        });
        const { stdout } = await command.output();
        const branchOutput = new TextDecoder().decode(stdout).trim();
        if (branchOutput) {
          branch = branchOutput;
        }
      } catch {
        // Use default branch
      }

      return {
        name,
        path,
        branch,
        isGit: true,
      };
    } catch (error) {
      console.error(`[RepoManager] Error getting repo info for ${path}:`, error);
      return null;
    }
  }

  /**
   * Get all scanned repositories
   */
  getRepositories(): RepoInfo[] {
    return Array.from(this.repos.values());
  }

  /**
   * Get repository by name
   */
  getRepository(name: string): RepoInfo | undefined {
    return this.repos.get(name);
  }

  /**
   * Set current repository
   */
  setCurrentRepo(name: string): boolean {
    if (this.repos.has(name)) {
      this.currentRepo = name;
      return true;
    }
    return false;
  }

  /**
   * Get current repository
   */
  getCurrentRepo(): RepoInfo | null {
    if (this.currentRepo && this.repos.has(this.currentRepo)) {
      return this.repos.get(this.currentRepo)!;
    }
    return null;
  }

  /**
   * Clear all repositories
   */
  clear(): void {
    this.repos.clear();
    this.currentRepo = null;
  }

  /**
   * Set base path for scanning
   */
  setBasePath(path: string): void {
    this.basePath = path;
  }

  /**
   * Get base path
   */
  getBasePath(): string {
    return this.basePath;
  }
}
