import { SlashCommandBuilder } from "npm:discord.js@14.14.1";
import { AGENT_MODELS, AGENT_TEMPLATES } from "./enhanced-client.ts";

export const additionalAgentCommands = [
  new SlashCommandBuilder()
    .setName('agent-explain')
    .setDescription('Ask agent to explain code, concepts, or errors in detail')
    .addStringOption(option =>
      option.setName('content')
        .setDescription('Code, concept, or error to explain')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('detail_level')
        .setDescription('Level of detail for explanation')
        .setRequired(false)
        .addChoices(
          { name: 'Basic - Simple overview', value: 'basic' },
          { name: 'Detailed - In-depth explanation', value: 'detailed' },
          { name: 'Expert - Advanced technical details', value: 'expert' }
        ))
    .addBooleanOption(option =>
      option.setName('include_examples')
        .setDescription('Include code examples in explanation')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('agent-debug')
    .setDescription('Get help debugging code issues and errors')
    .addStringOption(option =>
      option.setName('error_or_code')
        .setDescription('Error message or problematic code')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('language')
        .setDescription('Programming language')
        .setRequired(false)
        .addChoices(
          { name: 'TypeScript', value: 'typescript' },
          { name: 'JavaScript', value: 'javascript' },
          { name: 'Python', value: 'python' },
          { name: 'Rust', value: 'rust' },
          { name: 'Go', value: 'go' },
          { name: 'Java', value: 'java' },
          { name: 'C++', value: 'cpp' },
          { name: 'Other', value: 'other' }
        ))
    .addStringOption(option =>
      option.setName('context_files')
        .setDescription('Related files for debugging context')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('agent-optimize')
    .setDescription('Get code optimization suggestions from agent')
    .addStringOption(option =>
      option.setName('code')
        .setDescription('Code to optimize')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('focus')
        .setDescription('Optimization focus area')
        .setRequired(false)
        .addChoices(
          { name: 'Performance - Speed and efficiency', value: 'performance' },
          { name: 'Readability - Code clarity and maintainability', value: 'readability' },
          { name: 'Memory - Memory usage optimization', value: 'memory' },
          { name: 'Security - Security best practices', value: 'security' },
          { name: 'All - Comprehensive optimization', value: 'all' }
        ))
    .addBooleanOption(option =>
      option.setName('preserve_functionality')
        .setDescription('Ensure functionality remains exactly the same')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('agent-review')
    .setDescription('Get comprehensive code review from agent')
    .addStringOption(option =>
      option.setName('code_or_file')
        .setDescription('Code to review or file path')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('review_type')
        .setDescription('Type of code review')
        .setRequired(false)
        .addChoices(
          { name: 'Quick - Basic issues and suggestions', value: 'quick' },
          { name: 'Standard - Thorough review with recommendations', value: 'standard' },
          { name: 'Deep - Comprehensive analysis with architecture review', value: 'deep' }
        ))
    .addBooleanOption(option =>
      option.setName('include_security')
        .setDescription('Include security vulnerability analysis')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('include_performance')
        .setDescription('Include performance analysis')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('agent-generate')
    .setDescription('Generate code, tests, or documentation with the agent')
    .addStringOption(option =>
      option.setName('request')
        .setDescription('What to generate (function, class, test, documentation, etc.)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of generation')
        .setRequired(false)
        .addChoices(
          { name: 'Function - Generate a function', value: 'function' },
          { name: 'Class - Generate a class', value: 'class' },
          { name: 'Test - Generate unit tests', value: 'test' },
          { name: 'Documentation - Generate docs', value: 'documentation' },
          { name: 'API - Generate API endpoints', value: 'api' },
          { name: 'Component - Generate UI component', value: 'component' }
        ))
    .addStringOption(option =>
      option.setName('style')
        .setDescription('Code style and conventions')
        .setRequired(false)
        .addChoices(
          { name: 'Clean Code - Focus on readability', value: 'clean' },
          { name: 'Performance - Focus on efficiency', value: 'performance' },
          { name: 'Functional - Functional programming style', value: 'functional' },
          { name: 'OOP - Object-oriented style', value: 'oop' }
        )),

  new SlashCommandBuilder()
    .setName('agent-refactor')
    .setDescription('Refactor existing code with the agent\'s assistance')
    .addStringOption(option =>
      option.setName('code')
        .setDescription('Code to refactor')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('goal')
        .setDescription('Refactoring goal')
        .setRequired(false)
        .addChoices(
          { name: 'Modernize - Update to modern patterns', value: 'modernize' },
          { name: 'Simplify - Reduce complexity', value: 'simplify' },
          { name: 'Extract - Extract reusable components', value: 'extract' },
          { name: 'TypeScript - Convert to TypeScript', value: 'typescript' },
          { name: 'Performance - Improve performance', value: 'performance' }
        ))
    .addBooleanOption(option =>
      option.setName('preserve_behavior')
        .setDescription('Preserve exact behavior (default: true)')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('add_tests')
        .setDescription('Generate tests for refactored code')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('agent-learn')
    .setDescription('Learn programming concepts with the agent as your tutor')
    .addStringOption(option =>
      option.setName('topic')
        .setDescription('Programming topic or concept to learn')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('level')
        .setDescription('Your experience level')
        .setRequired(false)
        .addChoices(
          { name: 'Beginner - New to programming', value: 'beginner' },
          { name: 'Intermediate - Some experience', value: 'intermediate' },
          { name: 'Advanced - Experienced developer', value: 'advanced' }
        ))
    .addBooleanOption(option =>
      option.setName('include_exercises')
        .setDescription('Include practical exercises')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('step_by_step')
        .setDescription('Break down into step-by-step guide')
        .setRequired(false))
];

// Alias for backward compatibility
export const additionalOneAgentCommands = additionalAgentCommands;

export interface AdditionalOneAgentHandlerDeps {
  workDir: string;
  agentController: AbortController | null;
  setAgentController: (controller: AbortController | null) => void;
  sendAgentMessages: (messages: any[]) => Promise<void>;
  sessionManager: any;
  crashHandler: any;
  settings: any;
}

export function createAdditionalOneAgentHandlers(deps: AdditionalOneAgentHandlerDeps) {
  const { workDir, sessionManager, crashHandler, sendAgentMessages, settings } = deps;

  return {
    async onOneAgentExplain(
      ctx: any,
      content: string,
      detailLevel?: string,
      includeExamples?: boolean
    ) {
      try {
        await ctx.deferReply();
        
        let prompt = `Please explain the following in ${detailLevel || 'detailed'} terms`;
        
        if (includeExamples) {
          prompt += `, and include practical code examples`;
        }
        
        prompt += `:\n\n${content}`;

        const { enhancedAgentQuery } = await import("./enhanced-client.ts");
        
        const controller = new AbortController();
        deps.setAgentController(controller);

        const result = await enhancedAgentQuery(
          prompt,
          {
            workDir,
            model: settings.defaultModel,
            temperature: settings.defaultTemperature,
            includeSystemInfo: false,
            includeGitContext: false
          },
          controller,
          undefined,
          undefined,
          async (jsonData) => {
            const { convertToAgentMessages } = await import("./message-converter.ts");
            const agentMessages = convertToAgentMessages(jsonData);
            if (agentMessages.length > 0) {
              sendAgentMessages(agentMessages).catch(() => {});
            }
          },
          false
        );

        deps.setAgentController(null);
        return result;
      } catch (error) {
        await crashHandler.reportCrash('agent', error instanceof Error ? error : new Error(String(error)), 'explain', 'One Agent explain command');
        throw error;
      }
    },

    async onOneAgentDebug(
      ctx: any,
      errorOrCode: string,
      language?: string,
      contextFiles?: string
    ) {
      try {
        await ctx.deferReply();
        
        let prompt = `Please help me debug this ${language ? `${language} ` : ''}issue:\n\n${errorOrCode}`;
        
        if (contextFiles) {
          prompt += `\n\nRelated files: ${contextFiles}`;
        }
        
        prompt += '\n\nPlease provide:\n1. Root cause analysis\n2. Step-by-step solution\n3. Prevention tips\n4. Code examples if applicable';

        const { enhancedAgentQuery } = await import("./enhanced-client.ts");
        
        const controller = new AbortController();
        deps.setAgentController(controller);

        const contextFilesList = contextFiles ? 
          contextFiles.split(',').map(f => f.trim()).filter(f => f.length > 0) : 
          undefined;

        const result = await enhancedAgentQuery(
          prompt,
          {
            workDir,
            model: settings.defaultModel,
            temperature: settings.defaultTemperature,
            includeSystemInfo: settings.autoIncludeSystemInfo,
            includeGitContext: settings.autoIncludeGitContext,
            contextFiles: contextFilesList
          },
          controller,
          undefined,
          undefined,
          async (jsonData) => {
            const { convertToAgentMessages } = await import("./message-converter.ts");
            const agentMessages = convertToAgentMessages(jsonData);
            if (agentMessages.length > 0) {
              sendAgentMessages(agentMessages).catch(() => {});
            }
          },
          false
        );

        deps.setAgentController(null);
        return result;
      } catch (error) {
        await crashHandler.reportCrash('agent', error instanceof Error ? error : new Error(String(error)), 'debug', 'One Agent debug command');
        throw error;
      }
    },

    async onOneAgentOptimize(
      ctx: any,
      code: string,
      focus?: string,
      preserveFunctionality?: boolean
    ) {
      try {
        await ctx.deferReply();
        
        let prompt = `Please optimize this code`;
        
        if (focus) {
          prompt += ` with focus on ${focus}`;
        }
        
        if (preserveFunctionality !== false) {
          prompt += `, ensuring functionality remains exactly the same`;
        }
        
        prompt += `:\n\n${code}\n\nPlease provide:\n1. Optimized version\n2. Explanation of changes\n3. Performance impact\n4. Any trade-offs`;

        const { enhancedAgentQuery } = await import("./enhanced-client.ts");
        
        const controller = new AbortController();
        deps.setAgentController(controller);

        const result = await enhancedAgentQuery(
          prompt,
          {
            workDir,
            model: settings.defaultModel,
            temperature: settings.defaultTemperature,
            includeSystemInfo: false,
            includeGitContext: settings.autoIncludeGitContext
          },
          controller,
          undefined,
          undefined,
          async (jsonData) => {
            const { convertToAgentMessages } = await import("./message-converter.ts");
            const agentMessages = convertToAgentMessages(jsonData);
            if (agentMessages.length > 0) {
              sendAgentMessages(agentMessages).catch(() => {});
            }
          },
          false
        );

        deps.setAgentController(null);
        return result;
      } catch (error) {
        await crashHandler.reportCrash('agent', error instanceof Error ? error : new Error(String(error)), 'optimize', 'One Agent optimize command');
        throw error;
      }
    },

    async onOneAgentReview(
      ctx: any,
      codeOrFile: string,
      reviewType?: string,
      includeSecurity?: boolean,
      includePerformance?: boolean
    ) {
      try {
        await ctx.deferReply();
        
        let prompt = `Please perform a ${reviewType || 'standard'} code review of:\n\n${codeOrFile}\n\nPlease analyze:`;
        
        const analysisPoints = [
          '• Code quality and maintainability',
          '• Best practices adherence',
          '• Potential bugs and issues',
          '• Code structure and organization'
        ];
        
        if (includeSecurity) {
          analysisPoints.push('• Security vulnerabilities');
        }
        
        if (includePerformance) {
          analysisPoints.push('• Performance optimizations');
        }
        
        prompt += `\n${analysisPoints.join('\n')}\n\nProvide specific recommendations with examples where applicable.`;

        const { enhancedAgentQuery } = await import("./enhanced-client.ts");
        
        const controller = new AbortController();
        deps.setAgentController(controller);

        // Check if codeOrFile is a file path
        const isFilePath = codeOrFile.includes('/') || codeOrFile.includes('\\') || codeOrFile.includes('.');
        const contextFiles = isFilePath ? [codeOrFile] : undefined;

        const result = await enhancedAgentQuery(
          prompt,
          {
            workDir,
            model: settings.defaultModel,
            temperature: settings.defaultTemperature,
            includeSystemInfo: false,
            includeGitContext: settings.autoIncludeGitContext,
            contextFiles
          },
          controller,
          undefined,
          undefined,
          async (jsonData) => {
            const { convertToAgentMessages } = await import("./message-converter.ts");
            const agentMessages = convertToAgentMessages(jsonData);
            if (agentMessages.length > 0) {
              sendAgentMessages(agentMessages).catch(() => {});
            }
          },
          false
        );

        deps.setAgentController(null);
        return result;
      } catch (error) {
        await crashHandler.reportCrash('agent', error instanceof Error ? error : new Error(String(error)), 'review', 'One Agent review command');
        throw error;
      }
    },

    async onOneAgentGenerate(
      ctx: any,
      request: string,
      type?: string,
      style?: string
    ) {
      try {
        await ctx.deferReply();
        
        let prompt = `Please generate ${type ? `a ${type}` : 'code'} based on this request: ${request}`;
        
        if (style) {
          prompt += `\n\nPlease use ${style} programming style and follow best practices for that approach.`;
        }
        
        prompt += '\n\nPlease include:\n• Well-commented code\n• Error handling where appropriate\n• Type annotations (if applicable)\n• Brief explanation of the implementation';

        const { enhancedAgentQuery } = await import("./enhanced-client.ts");
        
        const controller = new AbortController();
        deps.setAgentController(controller);

        const result = await enhancedAgentQuery(
          prompt,
          {
            workDir,
            model: settings.defaultModel,
            temperature: settings.defaultTemperature,
            includeSystemInfo: settings.autoIncludeSystemInfo,
            includeGitContext: settings.autoIncludeGitContext
          },
          controller,
          undefined,
          undefined,
          async (jsonData) => {
            const { convertToAgentMessages } = await import("./message-converter.ts");
            const agentMessages = convertToAgentMessages(jsonData);
            if (agentMessages.length > 0) {
              sendAgentMessages(agentMessages).catch(() => {});
            }
          },
          false
        );

        deps.setAgentController(null);
        return result;
      } catch (error) {
        await crashHandler.reportCrash('agent', error instanceof Error ? error : new Error(String(error)), 'generate', 'One Agent generate command');
        throw error;
      }
    },

    async onOneAgentRefactor(
      ctx: any,
      code: string,
      goal?: string,
      preserveBehavior?: boolean,
      addTests?: boolean
    ) {
      try {
        await ctx.deferReply();
        
        let prompt = `Please refactor this code`;
        
        if (goal) {
          prompt += ` to ${goal}`;
        }
        
        if (preserveBehavior !== false) {
          prompt += `, while preserving the exact behavior`;
        }
        
        prompt += `:\n\n${code}\n\nPlease provide:\n• Refactored code with explanations\n• Summary of changes made\n• Benefits of the refactoring`;
        
        if (addTests) {
          prompt += '\n• Unit tests for the refactored code';
        }

        const { enhancedAgentQuery } = await import("./enhanced-client.ts");
        
        const controller = new AbortController();
        deps.setAgentController(controller);

        const result = await enhancedAgentQuery(
          prompt,
          {
            workDir,
            model: settings.defaultModel,
            temperature: settings.defaultTemperature,
            includeSystemInfo: false,
            includeGitContext: settings.autoIncludeGitContext
          },
          controller,
          undefined,
          undefined,
          async (jsonData) => {
            const { convertToAgentMessages } = await import("./message-converter.ts");
            const agentMessages = convertToAgentMessages(jsonData);
            if (agentMessages.length > 0) {
              sendAgentMessages(agentMessages).catch(() => {});
            }
          },
          false
        );

        deps.setAgentController(null);
        return result;
      } catch (error) {
        await crashHandler.reportCrash('agent', error instanceof Error ? error : new Error(String(error)), 'refactor', 'One Agent refactor command');
        throw error;
      }
    },

    async onOneAgentLearn(
      ctx: any,
      topic: string,
      level?: string,
      includeExercises?: boolean,
      stepByStep?: boolean
    ) {
      try {
        await ctx.deferReply();
        
        let prompt = `Please teach me about "${topic}" at ${level || 'intermediate'} level.`;
        
        if (stepByStep) {
          prompt += ' Break it down into easy-to-follow steps.';
        }
        
        prompt += '\n\nPlease include:\n• Clear explanations with examples\n• Key concepts and terminology\n• Common use cases and applications\n• Best practices and tips';
        
        if (includeExercises) {
          prompt += '\n• Practical exercises to reinforce learning';
        }

        const { enhancedAgentQuery } = await import("./enhanced-client.ts");
        
        const controller = new AbortController();
        deps.setAgentController(controller);

        const result = await enhancedAgentQuery(
          prompt,
          {
            workDir,
            model: settings.defaultModel,
            temperature: 0.8, // Slightly higher temperature for teaching
            includeSystemInfo: false,
            includeGitContext: false
          },
          controller,
          undefined,
          undefined,
          async (jsonData) => {
            const { convertToAgentMessages } = await import("./message-converter.ts");
            const agentMessages = convertToAgentMessages(jsonData);
            if (agentMessages.length > 0) {
              sendAgentMessages(agentMessages).catch(() => {});
            }
          },
          false
        );

        deps.setAgentController(null);
        return result;
      } catch (error) {
        await crashHandler.reportCrash('agent', error instanceof Error ? error : new Error(String(error)), 'learn', 'One Agent learn command');
        throw error;
      }
    }
  };
}