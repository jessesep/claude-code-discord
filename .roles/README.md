# Agent Role System

This folder contains role definitions that are automatically loaded when you use `/run-adv` and select a role.

## How It Works

1. **Select Provider**: Choose your AI provider (Cursor, Claude CLI, Ollama, Antigravity, Gemini API)
2. **Select Role**: Choose a role that matches your task
3. **Select Model**: Pick a specific model or auto-select
4. **Start Chatting**: The role context is automatically injected into the agent's system prompt

## Available Roles

### 🔨 Builder (`builder.md`)
- **Focus**: Implementing features, writing code
- **Best for**: Creating new functionality, building features
- **Skills**: Code implementation, testing, documentation

### 🧪 Tester (`tester.md`)
- **Focus**: Testing, quality assurance, bug finding
- **Best for**: Writing tests, finding bugs, ensuring quality
- **Skills**: Test coverage, bug reporting, QA processes

### 🔍 Investigator (`investigator.md`)
- **Focus**: Investigation, security analysis, debugging
- **Best for**: Finding root causes, security audits, complex debugging
- **Skills**: Root cause analysis, security checks, system analysis

### 🏗️ Architect (`architect.md`)
- **Focus**: System design, architecture planning
- **Best for**: Designing systems, making tech decisions, planning
- **Skills**: System design, patterns, technology selection

### 👁️ Reviewer (`reviewer.md`)
- **Focus**: Code review, providing feedback
- **Best for**: Reviewing PRs, improving code quality
- **Skills**: Code review, constructive feedback, mentoring

## Customizing Roles

You can customize these role documents to match your project's needs:

1. Edit the `.md` files in this folder
2. Add project-specific guidelines
3. Include links to your team's documentation
4. Add examples from your codebase

## Role Document Structure

Each role document typically includes:

- **Purpose**: What this role focuses on
- **Responsibilities**: Key responsibilities
- **Best Practices**: Guidelines and patterns
- **Checklists**: Verification steps
- **Templates**: Useful templates
- **Communication**: How to interact

## Creating Custom Roles

To create a new role:

1. Create a new `.md` file in this folder (e.g., `.roles/devops.md`)
2. Add the role definition to `agent/index.ts`:

```typescript
'devops': {
  name: 'DevOps',
  description: 'Deploy, monitor, and maintain systems',
  emoji: '🚀',
  documentPath: '.roles/devops.md',
  systemPromptAddition: `...`
}
```

3. Update the role selection menu in `discord/bot.ts`

## Tips

- **Keep roles focused**: Each role should have a clear purpose
- **Make them actionable**: Include specific guidelines and checklists
- **Update regularly**: Keep role documents up-to-date with your team's practices
- **Use examples**: Include code examples and templates
- **Link to resources**: Reference your team's wiki, style guides, etc.

## Role Independence

Roles are **independent of providers**. This means:
- The same role can be used with any AI provider (Cursor, Claude, Ollama, etc.)
- Role documents are loaded from the repository, not hardcoded per provider
- You can update role definitions without changing agent code
- Roles reflect your team's practices, not the AI's capabilities

---

*For more information, see the agent system documentation in `/docs/CURSOR-DISCORD-USAGE.md`*
