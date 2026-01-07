/**
 * Repository Initialization Utility
 * 
 * Handles creating new repositories with agent system initialization
 */

import { join } from "https://deno.land/std@0.208.0/path/mod.ts";

export interface RepoInitOptions {
  repoName: string;
  repoPath: string;
  description?: string;
  createGitHub?: boolean;
  githubVisibility?: 'public' | 'private';
}

export interface RepoInitResult {
  success: boolean;
  repoPath: string;
  gitInitialized: boolean;
  githubCreated: boolean;
  githubUrl?: string;
  error?: string;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  const len1 = str1.length;
  const len2 = str2.length;

  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[len2][len1];
}

/**
 * Find similar folder names using fuzzy matching
 */
export async function findSimilarFolders(
  categoryName: string,
  reposBaseDir: string
): Promise<string[]> {
  try {
    const entries = Deno.readDir(reposBaseDir);
    const folders: string[] = [];
    
    for await (const entry of entries) {
      if (entry.isDirectory && !entry.name.startsWith('.')) {
        folders.push(entry.name);
      }
    }

    // Calculate similarity scores
    const similarities = folders.map(folder => ({
      name: folder,
      distance: levenshteinDistance(categoryName.toLowerCase(), folder.toLowerCase()),
      similarity: 1 - (levenshteinDistance(categoryName.toLowerCase(), folder.toLowerCase()) / Math.max(categoryName.length, folder.length))
    }));

    // Filter by similarity threshold (0.6 = 60% similar)
    const threshold = 0.6;
    const similar = similarities
      .filter(item => item.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5) // Top 5 matches
      .map(item => item.name);

    return similar;
  } catch (error) {
    console.warn(`[RepoInitializer] Error finding similar folders: ${error}`);
    return [];
  }
}

/**
 * Initialize a new repository with agent system files
 */
export async function initializeRepository(options: RepoInitOptions): Promise<RepoInitResult> {
  const { repoName, repoPath, description } = options;
  
  try {
    // Create directory
    await Deno.mkdir(repoPath, { recursive: true });
    console.log(`[RepoInitializer] Created directory: ${repoPath}`);

    // Initialize git repository
    let gitInitialized = false;
    try {
      const gitInit = new Deno.Command('git', {
        args: ['init'],
        cwd: repoPath,
        stdout: 'piped',
        stderr: 'piped',
      });
      const { code } = await gitInit.output();
      if (code === 0) {
        gitInitialized = true;
        console.log(`[RepoInitializer] Initialized git repository`);
      }
    } catch (error) {
      console.warn(`[RepoInitializer] Failed to initialize git: ${error}`);
    }

    // Create .agent-context.md
    const agentContextContent = `# ${repoName} - Agent Context

> **MANDATORY READ**: Agents MUST read this file before interacting with the codebase.

## 🎯 Project Mission

${description || `This is a new project: ${repoName}`}

## 📜 Global Conventions

- **Language**: TypeScript (Deno runtime) or as specified
- **Style**: Follow project conventions
- **File Naming**: Use appropriate naming conventions for the project type

## ⚖️ Rules of Engagement

1. **Context Hierarchy**: Always check the local \`.agent-context.md\` when entering a new directory.
2. **Minimalism**: Write concise, high-impact code. Avoid bloat.
3. **Safety**: Never execute destructive commands without verifying the \`Cwd\` and intent.

## 🛠️ Tooling

- Standard development tools for this project type
- Git for version control
`;

    await Deno.writeTextFile(join(repoPath, '.agent-context.md'), agentContextContent);

    // Create README.md
    const readmeContent = `# ${repoName}

${description || `A new project: ${repoName}`}

## Getting Started

This project was initialized with the Claude-Discord agent system.

## Development

\`\`\`bash
# Add your development commands here
\`\`\`

## License

Add your license information here.
`;

    await Deno.writeTextFile(join(repoPath, 'README.md'), readmeContent);

    // Create .gitignore
    const gitignoreContent = `# Dependencies
node_modules/
deno.lock

# Environment
.env
.env.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Build
dist/
build/
*.log
`;

    await Deno.writeTextFile(join(repoPath, '.gitignore'), gitignoreContent);

    // Create initial commit
    let githubCreated = false;
    let githubUrl: string | undefined;
    
    if (gitInitialized) {
      try {
        // Configure git user if not set
        const gitConfig = new Deno.Command('git', {
          args: ['config', 'user.name'],
          cwd: repoPath,
          stdout: 'piped',
          stderr: 'piped',
        });
        const { stdout: userName } = await gitConfig.output();
        if (!userName || new TextDecoder().decode(userName).trim() === '') {
          // Set default git user
          await new Deno.Command('git', {
            args: ['config', 'user.name', 'Claude-Discord Bot'],
            cwd: repoPath,
          }).output();
        }

        // Add and commit initial files
        await new Deno.Command('git', {
          args: ['add', '.'],
          cwd: repoPath,
        }).output();

        await new Deno.Command('git', {
          args: ['commit', '-m', `Initial commit: ${repoName}\n\n${description || ''}`],
          cwd: repoPath,
        }).output();
      } catch (error) {
        console.warn(`[RepoInitializer] Failed to create initial commit: ${error}`);
      }
    }

    return {
      success: true,
      repoPath,
      gitInitialized,
      githubCreated,
      githubUrl,
    };
  } catch (error) {
    return {
      success: false,
      repoPath,
      gitInitialized: false,
      githubCreated: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create GitHub repository and push local code
 */
export async function createGitHubRepository(
  repoPath: string,
  repoName: string,
  visibility: 'public' | 'private',
  description?: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Check if gh CLI is available
    const ghCheck = new Deno.Command('gh', {
      args: ['--version'],
      stdout: 'piped',
      stderr: 'piped',
    });
    const { code: ghCode } = await ghCheck.output();
    
    if (ghCode !== 0) {
      return {
        success: false,
        error: 'GitHub CLI (gh) is not installed. Please install it from https://cli.github.com/',
      };
    }

    // Create GitHub repository
    const createArgs = [
      'repo', 'create', repoName,
      '--' + visibility,
      '--source', '.',
      '--remote', 'origin',
      '--push',
    ];
    
    if (description) {
      createArgs.splice(2, 0, '--description', description);
    }

    const createRepo = new Deno.Command('gh', {
      args: createArgs,
      cwd: repoPath,
      stdout: 'piped',
      stderr: 'piped',
    });

    const { code, stdout, stderr } = await createRepo.output();
    
    if (code !== 0) {
      const errorMsg = new TextDecoder().decode(stderr);
      return {
        success: false,
        error: `Failed to create GitHub repository: ${errorMsg}`,
      };
    }

    // Extract URL from output
    const output = new TextDecoder().decode(stdout);
    const urlMatch = output.match(/https:\/\/github\.com\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : `https://github.com/${await getGitHubUsername()}/${repoName}`;

    return {
      success: true,
      url,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get GitHub username from gh CLI
 */
async function getGitHubUsername(): Promise<string> {
  try {
    const ghUser = new Deno.Command('gh', {
      args: ['api', 'user', '--jq', '.login'],
      stdout: 'piped',
      stderr: 'piped',
    });
    const { stdout } = await ghUser.output();
    return new TextDecoder().decode(stdout).trim();
  } catch {
    return 'jessesep'; // Default fallback
  }
}
