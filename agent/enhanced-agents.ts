/**
 * Enhanced Agent Configurations
 *
 * Replaces the old PREDEFINED_AGENTS with provider-based configurations
 */

import { EnhancedAgentConfig } from './provider-interface.ts';

/**
 * Centralized agent registry using the provider system
 */
export const ENHANCED_AGENTS: Record<string, EnhancedAgentConfig> = {
  // ========================================================================
  // Manager Agent (Orchestrator)
  // ========================================================================
  'ag-manager': {
    id: 'ag-manager',
    name: 'Gemini Manager',
    description: 'Main orchestrator agent that manages other agents and interacts with the user',
    providerId: 'antigravity',
    model: 'gemini-3-flash-preview',
    systemPrompt: `You are the Manager Agent. Your role is to interact with users and orchestrate work.

**Core Responsibilities**:
1. **Triage Requests**: Determine if a request is simple (you can answer directly) or complex (requires a specialist).
2. **Delegate Tasks**: For complex tasks, output a JSON command to spawn a specialist subagent.
3. **Provide Summaries**: When a subagent completes, summarize the results for the user.

**Output Format**:
- For simple questions: Respond directly with helpful information.
- For complex tasks: Output JSON like: {"action": "spawn_agent", "agent_name": "ag-coder", "task": "Refactor the login page"}

Available Subagents:
- ag-coder: Code writing and editing
- ag-architect: System design and planning
- cursor-coder: Autonomous code editing via Cursor
- code-reviewer: Code quality analysis`,
    defaultOptions: {
      temperature: 0.3,
      maxTokens: 10000,
      streaming: true,
    },
    capabilities: ['orchestration', 'planning', 'subagent-management', 'task-decomposition'],
    riskLevel: 'low',
    isManager: true,
  },

  // ========================================================================
  // Primary CLI Agents (One Agents)
  // ========================================================================
  'code-reviewer': {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    description: 'Specialized in code review and quality analysis',
    providerId: 'primary-cli',
    model: 'sonnet',
    systemPrompt: `You are an expert code reviewer. Focus on:
- Code quality and maintainability
- Security vulnerabilities
- Performance issues
- Best practices and design patterns

Provide detailed, actionable feedback with specific suggestions.

> **MANDATORY READ**: Your VERY FIRST action MUST be to use the \`view_file\` tool to read the root \`.agent-context.md\` and the \`.agent-context.md\` in your specific compartment (if it exists). This ensures you work with the latest local knowledge.`,
    defaultOptions: {
      temperature: 0.3,
      maxTokens: 4096,
      streaming: true,
    },
    capabilities: ['code-review', 'security-analysis', 'performance-optimization'],
    riskLevel: 'low',
  },

  'architect': {
    id: 'architect',
    name: 'Software Architect',
    description: 'Focused on system design and architecture decisions',
    providerId: 'primary-cli',
    model: 'sonnet',
    systemPrompt: `You are a senior software architect. Help with:
- System design and architecture patterns
- Technology selection and trade-offs
- Scalability and maintainability
- Design principles (SOLID, DRY, KISS)

> **MANDATORY READ**: Your VERY FIRST action MUST be to use the \`view_file\` tool to read the root \`.agent-context.md\` and the \`.agent-context.md\` in your specific compartment (if it exists). This ensures you work with the latest local knowledge.`,
    defaultOptions: {
      temperature: 0.5,
      maxTokens: 4096,
      streaming: true,
    },
    capabilities: ['system-design', 'architecture-review', 'technology-selection'],
    riskLevel: 'low',
  },

  // ========================================================================
  // Anthropic API Agents
  // ========================================================================
  'api-debugger': {
    id: 'api-debugger',
    name: 'Debug Specialist (API)',
    description: 'Expert at finding and fixing bugs using Anthropic API',
    providerId: 'anthropic-api',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: `You are a debugging expert. Help with:
- Root cause analysis
- Debugging strategies
- Step-by-step solutions
- Log analysis

> **MANDATORY READ**: Your VERY FIRST action MUST be to use the \`view_file\` tool to read the root \`.agent-context.md\` and the \`.agent-context.md\` in your specific compartment (if it exists). This ensures you work with the latest local knowledge.`,
    defaultOptions: {
      temperature: 0.2,
      maxTokens: 4096,
      streaming: true,
    },
    capabilities: ['bug-analysis', 'debugging', 'troubleshooting'],
    riskLevel: 'medium',
  },

  'api-security': {
    id: 'api-security',
    name: 'Security Analyst (API)',
    description: 'Specialized in security analysis using Anthropic API',
    providerId: 'anthropic-api',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: `You are a cybersecurity expert. Focus on:
- Security vulnerability identification
- Secure coding practices
- Threat modeling
- Compliance and standards

> **MANDATORY READ**: Your VERY FIRST action MUST be to use the \`view_file\` tool to read the root \`.agent-context.md\` and the \`.agent-context.md\` in your specific compartment (if it exists). This ensures you work with the latest local knowledge.`,
    defaultOptions: {
      temperature: 0.1,
      maxTokens: 4096,
      streaming: true,
    },
    capabilities: ['security-analysis', 'vulnerability-assessment', 'threat-modeling'],
    riskLevel: 'medium',
  },

  // ========================================================================
  // Cursor Agents (Autonomous Code Editing)
  // ========================================================================
  'cursor-coder': {
    id: 'cursor-coder',
    name: 'Cursor Autonomous Coder',
    description: 'Cursor AI agent that can autonomously write and edit code',
    providerId: 'cursor',
    model: 'sonnet-4.5',
    systemPrompt: `You are an autonomous coding agent powered by Cursor.
- Read, write, and modify code files
- Write clean, maintainable code
- Follow best practices
- Test your changes

> **MANDATORY READ**: Your VERY FIRST action MUST be to use the \`view_file\` tool to read the root \`.agent-context.md\` and the \`.agent-context.md\` in your specific compartment (if it exists). This ensures you work with the latest local knowledge.`,
    defaultOptions: {
      temperature: 0.3,
      maxTokens: 8000,
      force: false, // Require approval
      sandbox: true,
      streaming: true,
    },
    capabilities: ['file-editing', 'code-generation', 'refactoring', 'autonomous'],
    riskLevel: 'high',
  },

  'cursor-refactor': {
    id: 'cursor-refactor',
    name: 'Cursor Refactoring Specialist',
    description: 'Specialized in autonomous code refactoring using Cursor',
    providerId: 'cursor',
    model: 'sonnet-4.5',
    systemPrompt: `You are a refactoring specialist.
- Improve code structure and readability
- Maintain functionality while refactoring
- Write tests to verify behavior
- Document changes

> **MANDATORY READ**: Your VERY FIRST action MUST be to use the \`view_file\` tool to read the root \`.agent-context.md\` and the \`.agent-context.md\` in your specific compartment (if it exists). This ensures you work with the latest local knowledge.`,
    defaultOptions: {
      temperature: 0.2,
      maxTokens: 8000,
      force: false,
      sandbox: true,
      streaming: true,
    },
    capabilities: ['refactoring', 'code-improvement', 'file-editing'],
    riskLevel: 'high',
  },

  'cursor-fast': {
    id: 'cursor-fast',
    name: 'Cursor Fast Agent',
    description: 'Quick code changes with auto-approval (use with caution)',
    providerId: 'cursor',
    model: 'sonnet-4.5',
    systemPrompt: `You are a fast coding agent. Make quick, targeted changes efficiently.

> **MANDATORY READ**: Your VERY FIRST action MUST be to use the \`view_file\` tool to read the root \`.agent-context.md\` and the \`.agent-context.md\` in your specific compartment (if it exists). This ensures you work with the latest local knowledge.`,
    defaultOptions: {
      temperature: 0.3,
      maxTokens: 4096,
      force: true, // Auto-approve for speed
      sandbox: false,
      streaming: true,
    },
    capabilities: ['quick-edits', 'file-editing', 'autonomous'],
    riskLevel: 'high',
  },

  // ========================================================================
  // Antigravity/Gemini Agents
  // ========================================================================
  'ag-coder': {
    id: 'ag-coder',
    name: 'Antigravity Coder',
    description: 'Google Antigravity agent for autonomous coding tasks',
    providerId: 'antigravity',
    model: 'gemini-3-flash-preview',
    systemPrompt: `You are an autonomous coding agent powered by Google Antigravity.
- Plan, execute, and verify complex coding tasks
- Use available tools effectively
- Write high-quality code

> **MANDATORY READ**: Your VERY FIRST action MUST be to use the \`view_file\` tool to read the root \`.agent-context.md\` and the \`.agent-context.md\` in your specific compartment (if it exists). This ensures you work with the latest local knowledge.`,
    defaultOptions: {
      temperature: 0.3,
      maxTokens: 30000,
      force: false,
      sandbox: true,
      streaming: true,
    },
    capabilities: ['file-editing', 'planning', 'autonomous', 'browser-interaction'],
    riskLevel: 'high',
  },

  'ag-architect': {
    id: 'ag-architect',
    name: 'Antigravity Architect',
    description: 'High-level system design and planning agent',
    providerId: 'antigravity',
    model: 'gemini-3-flash-preview',
    systemPrompt: `You are a software architect agent.
- Analyze requirements
- Design systems and architecture
- Create implementation plans
- Use Antigravity tools effectively

> **MANDATORY READ**: Your VERY FIRST action MUST be to use the \`view_file\` tool to read the root \`.agent-context.md\` and the \`.agent-context.md\` in your specific compartment (if it exists). This ensures you work with the latest local knowledge.`,
    defaultOptions: {
      temperature: 0.4,
      maxTokens: 30000,
      streaming: true,
    },
    capabilities: ['system-design', 'planning', 'architecture'],
    riskLevel: 'medium',
  },

  // ========================================================================
  // VS Code Extension Agents (if available)
  // ========================================================================
  'continue-coder': {
    id: 'continue-coder',
    name: 'Continue.dev Coder',
    description: 'Autonomous coding using Continue.dev extension',
    providerId: 'vscode-continue-continue',
    model: 'claude-sonnet-4',
    systemPrompt: `You are an autonomous coding agent using Continue.dev.
- Write clean, maintainable code
- Follow project conventions
- Test your changes

> **MANDATORY READ**: Your VERY FIRST action MUST be to use the \`view_file\` tool to read the root \`.agent-context.md\` and the \`.agent-context.md\` in your specific compartment (if it exists). This ensures you work with the latest local knowledge.`,
    defaultOptions: {
      temperature: 0.3,
      maxTokens: 4096,
      streaming: true,
    },
    capabilities: ['file-editing', 'code-generation', 'autonomous'],
    riskLevel: 'high',
  },

  'aider-coder': {
    id: 'aider-coder',
    name: 'Aider AI Coder',
    description: 'AI pair programmer using Aider',
    providerId: 'vscode-aider-aider',
    model: 'claude-sonnet-4',
    systemPrompt: `You are an AI pair programmer using Aider.
- Collaborate on code changes
- Commit changes with good messages
- Test your code

> **MANDATORY READ**: Your VERY FIRST action MUST be to use the \`view_file\` tool to read the root \`.agent-context.md\` and the \`.agent-context.md\` in your specific compartment (if it exists). This ensures you work with the latest local knowledge.`,
    defaultOptions: {
      temperature: 0.3,
      maxTokens: 4096,
      streaming: true,
    },
    capabilities: ['file-editing', 'git-integration', 'autonomous'],
    riskLevel: 'high',
  },
};

/**
 * Get agent configuration by ID
 */
export function getAgentConfig(agentId: string): EnhancedAgentConfig | undefined {
  return ENHANCED_AGENTS[agentId];
}

/**
 * Get all available agent IDs
 */
export function getAvailableAgentIds(): string[] {
  return Object.keys(ENHANCED_AGENTS);
}

/**
 * Get agents by provider
 */
export function getAgentsByProvider(providerId: string): EnhancedAgentConfig[] {
  return Object.values(ENHANCED_AGENTS).filter(a => a.providerId === providerId);
}

/**
 * Get agents by risk level
 */
export function getAgentsByRiskLevel(riskLevel: 'low' | 'medium' | 'high'): EnhancedAgentConfig[] {
  return Object.values(ENHANCED_AGENTS).filter(a => a.riskLevel === riskLevel);
}
