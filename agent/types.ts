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

  // Claude-mem session ID for persistent memory
  memorySessionId?: string;
}

// Context note for all agents
export const CONTEXT_NOTE = `\n\n> **CONTEXT AVAILABLE**: The root \`.agent-context.md\` and relevant compartment context files have been automatically loaded into your prompt. Use this information to understand the project structure and conventions.`;

// Predefined agent configurations
export const PREDEFINED_AGENTS: Record<string, AgentConfig> = {
  'ag-manager': {
    name: 'Gemini Manager',
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
    name: 'Antigravity Coder',
    description: 'Google Antigravity agent for autonomous coding tasks',
    model: 'gemini-3-flash-preview',
    systemPrompt: `You are an autonomous coding agent powered by Google Antigravity.\n- Plan, execute, and verify complex coding tasks\n- Use available tools effectively\n- Write high-quality code\n\n${CONTEXT_NOTE}`,
    temperature: 0.3,
    maxTokens: 30000,
    capabilities: ['file-editing', 'planning', 'autonomous', 'browser-interaction'],
    riskLevel: 'high',
    client: 'antigravity',
    sandbox: 'enabled'
  },
  'ag-architect': {
    name: 'Antigravity Architect',
    description: 'High-level system design and planning agent',
    model: 'gemini-3-flash-preview',
    systemPrompt: `You are a software architect agent.\n- Analyze requirements\n- Design systems and architecture\n- Create implementation plans\n- Use Antigravity tools effectively\n\n${CONTEXT_NOTE}`,
    temperature: 0.4,
    maxTokens: 30000,
    capabilities: ['system-design', 'planning', 'architecture'],
    riskLevel: 'medium',
    client: 'antigravity'
  },
  'ag-security': {
    name: 'Antigravity Security',
    description: 'Security analyst for finding vulnerabilities and secure coding',
    model: 'gemini-3-flash-preview',
    systemPrompt: `You are a security analyst agent.\n- Identify security vulnerabilities\n- Suggest secure coding practices\n- Perform threat modeling\n\n${CONTEXT_NOTE}`,
    temperature: 0.2,
    maxTokens: 10000,
    capabilities: ['security-analysis', 'vulnerability-assessment', 'threat-modeling'],
    riskLevel: 'medium',
    client: 'antigravity'
  },
  'cursor-coder': {
    name: 'Cursor Autonomous Coder',
    description: 'Cursor AI agent that can autonomously write and edit code',
    model: 'sonnet-4.5',
    systemPrompt: `You are an autonomous coding agent powered by Cursor.\n- Read, write, and modify code files\n- Write clean, maintainable code\n- Follow best practices\n- Test your changes\n\n${CONTEXT_NOTE}`,
    temperature: 0.3,
    maxTokens: 8000,
    capabilities: ['file-editing', 'code-generation', 'refactoring', 'autonomous'],
    riskLevel: 'high',
    client: 'cursor',
    sandbox: 'enabled'
  },
  'cursor-refactor': {
    name: 'Cursor Refactoring Specialist',
    description: 'Specialized in autonomous code refactoring using Cursor',
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
    name: 'Cursor Fast Agent',
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
    name: 'Code Reviewer',
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
    name: 'Software Architect',
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
    name: 'General Assistant',
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
