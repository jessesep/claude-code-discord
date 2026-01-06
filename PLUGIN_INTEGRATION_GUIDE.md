# Claude Code Plugin Integration Guide
**Date:** 2025-01-27  
**Project:** claude-code-discord

---

## Overview

This guide shows how to integrate Claude Code marketplace plugins into your Cursor workflow. Plugins extend Claude Code with custom commands, agents, hooks, and MCP servers.

---

## Quick Start

### 1. Add the Official Anthropic Marketplace

The official marketplace is automatically available. To verify and browse:

```bash
# In Claude Code, run:
/plugin
```

This opens the plugin manager with tabs:
- **Discover**: Browse available plugins
- **Installed**: View installed plugins
- **Marketplaces**: Manage marketplaces
- **Errors**: View plugin errors

### 2. Add Community Marketplaces

#### Claude Code Marketplace (Community)
```bash
/plugin marketplace add https://claudecodemarketplace.net/api/marketplace.json
```

#### Anthropics Demo Marketplace
```bash
/plugin marketplace add anthropics/claude-code
```

#### Claude Plugins Community Registry
```bash
# Using npx (alternative method)
npx claude-plugins install <plugin-name>
```

#### Claude-Mem Marketplace (Long-term Memory)
```bash
/plugin marketplace add thedotmack/claude-mem
```

**What is claude-mem?**
- Automatically captures everything Claude does during coding sessions
- Compresses session data with AI (using Claude's agent-sdk)
- Injects relevant context back into future sessions
- Provides long-term memory across sessions
- Perfect for maintaining project context and avoiding re-explaining architecture

**Installation:**
```bash
# After adding marketplace
/plugin install claude-mem@thedotmack-claude-mem
```

**Documentation:** https://docs.claude-mem.ai/

---

## Recommended Plugins for This Project

### 1. Code Review Plugin ✅ **HIGHLY RECOMMENDED**

**Why:** We just completed a comprehensive code review. This plugin can automate future reviews.

**Install:**
```bash
/plugin install code-review@claude-plugins-official
```

**Or from Anthropics demo:**
```bash
/plugin marketplace add anthropics/claude-code
/plugin install code-review@anthropics-claude-code
```

**Features:**
- Automated code review
- Security vulnerability detection
- Style and best practices checking
- Integration with PR workflows

**Usage:**
```bash
/code-review:review <file-or-directory>
```

---

### 2. Commit Commands Plugin ✅ **RECOMMENDED**

**Why:** Streamlines git workflows for the Discord bot project.

**Install:**
```bash
/plugin install commit-commands@anthropics-claude-code
```

**Features:**
- Automated commit message generation
- Git workflow commands
- PR creation automation

**Usage:**
```bash
/commit-commands:commit
/commit-commands:push
/commit-commands:pr
```

---

### 3. PR Review Toolkit ✅ **RECOMMENDED**

**Why:** Helps review pull requests and manage code quality.

**Install:**
```bash
/plugin install pr-review-toolkit@anthropics-claude-code
```

**Features:**
- Specialized PR review agents
- Diff analysis
- Code quality checks

---

### 4. Security Review Plugin ✅ **HIGHLY RECOMMENDED**

**Why:** We identified security vulnerabilities. This can help prevent future issues.

**Install:**
```bash
# Check if available in official marketplace
/plugin install security-review@claude-plugins-official
```

**Features:**
- Automated security scanning
- Vulnerability detection
- Security best practices

**Usage:**
```bash
/security-review <path>
```

---

### 5. Claude-Mem Plugin ✅ **HIGHLY RECOMMENDED**

**Why:** Provides long-term memory across sessions. Perfect for maintaining context about this Discord bot project's architecture, decisions, and history.

**Install:**
```bash
# First add the marketplace
/plugin marketplace add thedotmack/claude-mem

# Then install the plugin
/plugin install claude-mem@thedotmack-claude-mem
```

**Features:**
- Automatic session capture and compression
- Long-term memory across sessions
- Context injection for future sessions
- Remembers architectural decisions
- Tracks file changes and reasons
- Maintains conversation history

**Documentation:** https://docs.claude-mem.ai/

### 6. GitHub Integration Plugin

**Why:** This project uses GitHub. Integration can streamline workflows.

**Install:**
```bash
/plugin install github@claude-plugins-official
```

**Features:**
- GitHub API integration
- Issue management
- PR management
- Repository operations

---

## Installation Steps

### Step 1: Add Marketplace

```bash
# Add Anthropics demo marketplace (has code-review plugin)
/plugin marketplace add anthropics/claude-code
```

### Step 2: Browse Available Plugins

```bash
# Open plugin manager
/plugin

# Navigate to "Discover" tab
# Browse available plugins
```

### Step 3: Install Plugin

**Option A: Interactive UI**
```bash
/plugin
# Navigate to Discover tab
# Select plugin
# Press Enter
# Choose installation scope:
#   - User scope (all projects)
#   - Project scope (this repo)
#   - Local scope (this repo, user only)
```

**Option B: CLI Command**
```bash
# Install to user scope (default)
/plugin install code-review@anthropics-claude-code

# Install to project scope
/plugin install code-review@anthropics-claude-code --scope project

# Install to local scope
/plugin install code-review@anthropics-claude-code --scope local
```

---

## Plugin Installation Scopes

1. **User Scope** (default)
   - Installed for you across all projects
   - Stored in: `~/.claude/plugins/`
   - Best for: Personal tools you use everywhere

2. **Project Scope**
   - Installed for all collaborators
   - Stored in: `.claude/plugins/` (committed to repo)
   - Best for: Team-wide tools

3. **Local Scope**
   - Installed only for you in this repo
   - Stored in: `.claude/plugins.local/` (gitignored)
   - Best for: Personal experimentation

---

## Recommended Setup for This Project

### Initial Setup

```bash
# 1. Add Anthropics demo marketplace
/plugin marketplace add anthropics/claude-code

# 2. Install code review plugin (project scope - team benefit)
/plugin install code-review@anthropics-claude-code --scope project

# 3. Install commit commands (user scope - personal workflow)
/plugin install commit-commands@anthropics-claude-code

# 4. Install PR review toolkit (project scope)
/plugin install pr-review-toolkit@anthropics-claude-code
```

### Verify Installation

```bash
# List installed plugins
/plugin

# Navigate to "Installed" tab
# Should see your installed plugins
```

---

## Using Plugins

### Code Review Plugin

```bash
# Review a specific file
/code-review:review agent/index.ts

# Review entire directory
/code-review:review agent/

# Review with specific focus
/code-review:review shell/handler.ts --focus security
```

### Commit Commands Plugin

```bash
# Stage changes and create commit
/commit-commands:commit

# Push to remote
/commit-commands:push

# Create PR
/commit-commands:pr
```

---

## Managing Plugins

### List Installed Plugins
```bash
/plugin
# Navigate to "Installed" tab
```

### Update Plugins
```bash
/plugin update <plugin-name>
```

### Remove Plugins
```bash
/plugin remove <plugin-name>
```

### List Marketplaces
```bash
/plugin
# Navigate to "Marketplaces" tab
```

### Remove Marketplace
```bash
/plugin marketplace remove <marketplace-name>
```

---

## Project-Specific Configuration

### Recommended Project Scope Plugins

For this Discord bot project, install these to project scope (`.claude/plugins/`):

1. **code-review** - Automated code reviews
2. **pr-review-toolkit** - PR review automation
3. **security-review** - Security scanning (if available)

### User Scope Plugins

Install these to user scope for personal workflow:

1. **commit-commands** - Git workflow automation
2. **github** - GitHub integration (if you use GitHub)

---

## Troubleshooting

### Plugin Not Found

```bash
# Verify marketplace is added
/plugin marketplace list

# Update marketplace
/plugin marketplace update <marketplace-name>

# Check for errors
/plugin
# Navigate to "Errors" tab
```

### Plugin Not Working

1. Check plugin errors:
   ```bash
   /plugin
   # Navigate to "Errors" tab
   ```

2. Verify plugin is enabled:
   ```bash
   /plugin
   # Navigate to "Installed" tab
   # Check if plugin is enabled
   ```

3. Check plugin documentation:
   - Plugin README in `.claude/plugins/<plugin-name>/`
   - Marketplace plugin page

### Executable Not Found

Some plugins require binaries (e.g., LSP plugins):
- Install required binaries
- Add to PATH
- Restart Claude Code

---

## Security Considerations

⚠️ **Important Security Notes:**

1. **Only install from trusted marketplaces**
   - Official Anthropic marketplace: `claude-plugins-official`
   - Verified community marketplaces
   - GitHub repositories you trust

2. **Review plugin code before installing**
   - Plugins can execute code
   - Check plugin source code
   - Review plugin permissions

3. **Use project scope carefully**
   - Project scope plugins are committed to repo
   - All collaborators will have access
   - Only install trusted plugins to project scope

4. **Monitor plugin behavior**
   - Check plugin logs
   - Review plugin file access
   - Monitor network activity

---

## Next Steps

1. **Add marketplace:**
   ```bash
   /plugin marketplace add anthropics/claude-code
   ```

2. **Browse available plugins:**
   ```bash
   /plugin
   # Navigate to "Discover" tab
   ```

3. **Install recommended plugins:**
   - Code review plugin
   - Commit commands
   - PR review toolkit

4. **Test plugins:**
   - Try code review on a file
   - Test commit commands
   - Verify everything works

5. **Document team usage:**
   - Update project README
   - Document plugin usage
   - Share with team

---

## Resources

- **Official Documentation:** https://code.claude.com/docs/en/discover-plugins
- **Anthropics Demo Marketplace:** https://github.com/anthropics/claude-code
- **Community Marketplace:** https://claudecodemarketplace.net/
- **Claude Plugins Registry:** https://claude-plugins.dev/

---

## Summary

✅ **Quick Commands:**

```bash
# Add marketplace
/plugin marketplace add anthropics/claude-code

# Install code review plugin
/plugin install code-review@anthropics-claude-code --scope project

# List installed plugins
/plugin

# Use code review
/code-review:review <file>
```

**Recommended First Plugin:** `code-review` from `anthropics/claude-code` marketplace

This plugin will help automate code reviews similar to the comprehensive review we just completed, making it perfect for maintaining code quality in this Discord bot project.
