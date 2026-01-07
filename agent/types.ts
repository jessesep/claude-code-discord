import { MANAGER_SYSTEM_PROMPT } from "./manager.ts";

export interface AgentConfig {
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  capabilities: string[];
  riskLevel: 'low' | 'medium' | 'high';
  client?: 'claude' | 'cursor' | 'antigravity' | 'ollama'; // Which CLI client to use (default: claude)
  workspace?: string; // For cursor: working directory
  force?: boolean; // For cursor: auto-approve operations
  sandbox?: 'enabled' | 'disabled'; // For cursor: sandbox mode
  isManager?: boolean; // If true, this agent can spawn other agents
}

export interface AgentSession {
  id: string;
  agentName: string;
  userId: string;
  channelId: string;
  startTime: Date;
  messageCount: number;
  totalCost: number;
  lastActivity: Date;

  status: 'active' | 'paused' | 'completed' | 'error';
  history: { role: 'user' | 'model'; content: string }[];
  
  // Cursor session ID for resuming conversations
  cursorSessionId?: string;
  
  // Selected role for the session
  roleId?: string;

  // Selected project path (workspace) for the session
  projectPath?: string;
  
  // Selected model for the session (overrides agent default)
  modelOverride?: string;

  // Agent-mem session ID for persistent memory
  memorySessionId?: string;
}

// Context note for all agents
export const CONTEXT_NOTE = `\n\n> **Mandatory Context Read**: Every repository contains a root \`.agent-context.md\` defining "Golden Standards" and improvement tasks. Your VERY FIRST action MUST be to use the \`view_file\` tool to read this file. This ensures you are aligned with the project mission and standards. Additionally, all repos include a \`CLAUDE.md\` with \`agent-mem\` memory shortcuts—use them for historical context.`;

// ═══════════════════════════════════════════════════════════════════════════
// Agent Styling - Consistent colors and icons per agent type
// ═══════════════════════════════════════════════════════════════════════════

export interface AgentStyle {
  emoji: string;
  color: number; // Discord color (hex)
  icon?: string; // Optional URL to icon
}

export const AGENT_STYLES: Record<string, AgentStyle> = {
  // Manager agents - Purple/Magenta theme
  'ag-manager': { emoji: '🎯', color: 0x9B59B6 },
  
  // Coder agents - Green theme
  'ag-coder': { emoji: '💻', color: 0x2ECC71 },
  'cursor-coder': { emoji: '⚡', color: 0x00D166 },
  'cursor-fast': { emoji: '🚀', color: 0x57F287 },
  
  // Refactoring - Cyan theme
  'cursor-refactor': { emoji: '🔄', color: 0x1ABC9C },
  
  // Architect agents - Blue theme
  'ag-architect': { emoji: '🏗️', color: 0x3498DB },
  'architect': { emoji: '📐', color: 0x5865F2 },
  
  // Security agents - Red theme
  'ag-security': { emoji: '🛡️', color: 0xE74C3C },
  
  // Tester agents - Orange theme
  'ag-tester': { emoji: '🧪', color: 0xE67E22 },
  
  // Reviewer agents - Gold theme
  'code-reviewer': { emoji: '👁️', color: 0xF1C40F },
  
  // General assistant - Blurple (Discord color)
  'general-assistant': { emoji: '🤖', color: 0x5865F2 },
  
  // Default fallback
  'default': { emoji: '🤖', color: 0x99AAB5 },
};

/**
 * Get styling for an agent by name/type
 */
export function getAgentStyle(agentName: string): AgentStyle {
  // Try exact match first
  if (AGENT_STYLES[agentName]) {
    return AGENT_STYLES[agentName];
  }
  
  // Try partial match (e.g., 'cursor-coder' matches 'coder')
  for (const [key, style] of Object.entries(AGENT_STYLES)) {
    if (agentName.includes(key) || key.includes(agentName)) {
      return style;
    }
  }
  
  // Check by capability keywords
  const nameLower = agentName.toLowerCase();
  if (nameLower.includes('manager') || nameLower.includes('orchestrat')) {
    return AGENT_STYLES['ag-manager'];
  }
  if (nameLower.includes('coder') || nameLower.includes('code')) {
    return AGENT_STYLES['cursor-coder'];
  }
  if (nameLower.includes('architect') || nameLower.includes('design')) {
    return AGENT_STYLES['ag-architect'];
  }
  if (nameLower.includes('test') || nameLower.includes('qa')) {
    return AGENT_STYLES['ag-tester'];
  }
  if (nameLower.includes('security') || nameLower.includes('audit')) {
    return AGENT_STYLES['ag-security'];
  }
  if (nameLower.includes('review')) {
    return AGENT_STYLES['code-reviewer'];
  }
  
  return AGENT_STYLES['default'];
}

// Predefined agent configurations
export const PREDEFINED_AGENTS: Record<string, AgentConfig> = {
  'ag-manager': {
    name: 'one manager',
    description: 'Main orchestrator agent that manages other agents and interacts with the user',
    model: 'gemini-3-flash-preview',
    systemPrompt: MANAGER_SYSTEM_PROMPT,
    temperature: 0.3,
    maxTokens: 10000,
    capabilities: ['orchestration', 'planning', 'subagent-management', 'task-decomposition'],
    riskLevel: 'low',
    client: 'antigravity',
    isManager: true
  },
  'ag-coder': {
    name: 'one coder',
    description: 'Autonomous coding agent for various tasks',
    model: 'gemini-3-flash-preview',
    systemPrompt: `You are an autonomous coding agent.\n- Plan, execute, and verify complex coding tasks\n- Use available tools effectively\n- Write high-quality code\n\n${CONTEXT_NOTE}`,
    temperature: 0.3,
    maxTokens: 30000,
    capabilities: ['file-editing', 'planning', 'autonomous', 'browser-interaction'],
    riskLevel: 'high',
    client: 'antigravity',
    sandbox: 'enabled'
  },
  'ag-architect': {
    name: 'one architect',
    description: 'High-level system design and planning agent',
    model: 'gemini-3-flash-preview',
    systemPrompt: `You are a software architect agent.\n- Analyze requirements\n- Design systems and architecture\n- Create implementation plans\n- Use planning tools effectively\n\n${CONTEXT_NOTE}`,
    temperature: 0.4,
    maxTokens: 30000,
    capabilities: ['system-design', 'planning', 'architecture'],
    riskLevel: 'medium',
    client: 'antigravity'
  },
  'ag-security': {
    name: 'one security',
    description: 'Security analyst for finding vulnerabilities and secure coding',
    model: 'gemini-3-flash-preview',
    systemPrompt: `You are a security analyst agent.\n- Identify security vulnerabilities\n- Suggest secure coding practices\n- Perform threat modeling\n\n${CONTEXT_NOTE}`,
    temperature: 0.2,
    maxTokens: 10000,
    capabilities: ['security-analysis', 'vulnerability-assessment', 'threat-modeling'],
    riskLevel: 'medium',
    client: 'antigravity'
  },
  'ag-tester': {
    name: 'one tester',
    description: 'Specialized in running and verifying E2E tests and quality assurance',
    model: 'gemini-3-flash-preview',
    systemPrompt: `You are a specialized Testing & QA agent.\n- Your primary goal is to execute test suites and verify system behavior.\n- Use the budget-friendly testing utilities (model="gemini-3-flash-preview") for all tasks.\n- Analyze test outputs and report failures with clear diagnostic information.\n- You can use shell tools to run the test runner: \`deno run --allow-all scripts/run-e2e-tests.ts\`.\n\n${CONTEXT_NOTE}`,
    temperature: 0.2,
    maxTokens: 15000,
    capabilities: ['testing', 'qa', 'shell-execution', 'analysis'],
    riskLevel: 'medium',
    client: 'antigravity'
  },
  'cursor-coder': {
    name: 'one coder (autonomous)',
    description: 'Autonomous agent that can write and edit code independently',
    model: 'sonnet-4.5',
    systemPrompt: `You are an autonomous coding agent.\n- Read, write, and modify code files\n- Write clean, maintainable code\n- Follow best practices\n- Test your changes\n\n${CONTEXT_NOTE}`,
    temperature: 0.3,
    maxTokens: 8000,
    capabilities: ['file-editing', 'code-generation', 'refactoring', 'autonomous'],
    riskLevel: 'high',
    client: 'cursor',
    sandbox: 'enabled'
  },
  'cursor-refactor': {
    name: 'one refactorer',
    description: 'Specialized in autonomous code refactoring',
    model: 'sonnet-4.5',
    systemPrompt: `You are a refactoring specialist.\n- Improve code structure and readability\n- Maintain functionality while refactoring\n- Write tests to verify behavior\n\n${CONTEXT_NOTE}`,
    temperature: 0.2,
    maxTokens: 8000,
    capabilities: ['refactoring', 'code-improvement', 'file-editing'],
    riskLevel: 'high',
    client: 'cursor',
    sandbox: 'enabled'
  },
  'cursor-fast': {
    name: 'one fast-coder',
    description: 'Quick code changes with auto-approval (use with caution)',
    model: 'sonnet-4.5',
    systemPrompt: `You are a fast coding agent. Make quick, targeted changes efficiently.\n\n${CONTEXT_NOTE}`,
    temperature: 0.3,
    maxTokens: 4096,
    capabilities: ['quick-edits', 'file-editing', 'autonomous'],
    riskLevel: 'high',
    client: 'cursor',
    force: true,
    sandbox: 'disabled'
  },
  'code-reviewer': {
    name: 'one reviewer',
    description: 'Specialized in code review and quality analysis',
    model: 'sonnet',
    systemPrompt: `You are an expert code reviewer. Focus on:\n- Code quality and maintainability\n- Security vulnerabilities\n- Performance issues\n- Best practices and design patterns\n\nProvide detailed, actionable feedback with specific suggestions.\n\n${CONTEXT_NOTE}`,
    temperature: 0.3,
    maxTokens: 4096,
    capabilities: ['code-review', 'security-analysis', 'performance-optimization'],
    riskLevel: 'low',
    client: 'claude'
  },
  'architect': {
    name: 'one architect (senior)',
    description: 'Senior software architect for system design decisions',
    model: 'sonnet',
    systemPrompt: `You are a senior software architect. Help with:\n- System design and architecture patterns\n- Technology selection and trade-offs\n- Scalability and maintainability\n\n${CONTEXT_NOTE}`,
    temperature: 0.5,
    maxTokens: 4096,
    capabilities: ['system-design', 'architecture-review', 'technology-selection'],
    riskLevel: 'low',
    client: 'claude'
  },
  'general-assistant': {
    name: 'one assistant',
    description: 'General purpose AI assistant for various tasks',
    model: 'gemini-3-flash-preview',
    systemPrompt: `You are a helpful AI assistant. Answer user questions and help with various tasks.\n\n${CONTEXT_NOTE}`,
    temperature: 0.7,
    maxTokens: 4096,
    capabilities: ['general-assistance', 'information-retrieval'],
    riskLevel: 'low',
    client: 'antigravity'
  }
};

export interface RoleDefinition {
  name: string;
  description: string;
  emoji: string;
  documentPath: string; // Path to role document in repository (e.g., ".roles/builder.md")
  systemPromptAddition: string; // Additional instructions for this role
}

export const ROLE_DEFINITIONS: Record<string, RoleDefinition> = {
  builder: {
    name: 'Builder',
    description: 'Build and create code, implement features',
    emoji: '🔨',
    documentPath: '.roles/builder.md',
    systemPromptAddition: `
**Role: Builder**
Your primary focus is building and creating code. You should:
- Implement new features and functionality
- Write clean, well-structured code
- Follow best practices and coding standards
- Create comprehensive documentation
- Consider maintainability and scalability
`
  },
  tester: {
    name: 'Tester',
    description: 'Test code, ensure quality, find bugs',
    emoji: '🧪',
    documentPath: '.roles/tester.md',
    systemPromptAddition: `
**Role: Tester**
Your primary focus is testing and quality assurance. You should:
- Write comprehensive tests (unit, integration, e2e)
- Identify bugs and edge cases
- Verify code quality and standards
- Perform code reviews
- Ensure proper error handling
`
  },
  investigator: {
    name: 'Investigator',
    description: 'Investigate issues, analyze systems, security',
    emoji: '🔍',
    documentPath: '.roles/investigator.md',
    systemPromptAddition: `
**Role: Investigator**
Your primary focus is investigation and analysis. You should:
- Analyze system architecture and design
- Investigate security vulnerabilities
- Debug complex issues
- Perform root cause analysis
- Document findings and recommendations
`
  },
  architect: {
    name: 'Architect',
    description: 'Design systems, plan architecture',
    emoji: '🏗️',
    documentPath: '.roles/architect.md',
    systemPromptAddition: `
**Role: Architect**
Your primary focus is system design and architecture. You should:
- Design scalable, maintainable systems
- Plan implementation strategies
- Make technology decisions
- Create architectural diagrams
- Consider trade-offs and best practices
`
  },
  reviewer: {
    name: 'Reviewer',
    description: 'Review code, provide feedback',
    emoji: '👁️',
    documentPath: '.roles/reviewer.md',
    systemPromptAddition: `
**Role: Reviewer**
Your primary focus is code review and feedback. You should:
- Review code for quality and standards
- Identify potential issues
- Suggest improvements
- Ensure best practices are followed
- Provide constructive feedback
`
  }
};
