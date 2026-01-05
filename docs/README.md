# Cursor IDE Integration Documentation

This directory contains comprehensive documentation for programmatically spawning and controlling Cursor IDE instances, with specific focus on integrating Cursor Agent with the Claude Code Discord bot.

---

## Documents

### 1. [CURSOR-QUICK-REFERENCE.md](./CURSOR-QUICK-REFERENCE.md) ⭐ Start Here
**Quick reference guide** with practical examples and code snippets.

- Installation and basic usage
- Node.js integration examples
- Real-time streaming for Discord
- CLI flags reference
- Hooks configuration
- Cloud API endpoints
- Security checklist

**Best for**: Getting started quickly, copy-paste examples

---

### 2. [CURSOR-INTEGRATION.md](./CURSOR-INTEGRATION.md) 📚 Comprehensive Reference
**Complete research document** with detailed findings and architectural analysis.

15 major sections covering:
1. Executive Summary
2. Cursor CLI Capabilities (with version info)
3. Cursor Agent CLI Interface
4. Non-Interactive / Headless Mode
5. Bidirectional Communication: Process Hooks
6. Cloud Agents API (REST)
7. Stdin/Stdout Limitations
8. Recommended Integration Approaches (4 patterns)
9. Integration with Discord Bot
10. Challenges & Limitations
11. Code Examples & Templates
12. Cursor vs. Claude CLI Comparison
13. Security Considerations
14. Resources & References
15. Implementation Checklist

**Best for**: Deep understanding, architectural decisions, security planning

---

## Key Findings Summary

### 1. CLI Capabilities
✓ Yes - Cursor has a full CLI agent interface  
✓ Can spawn as subprocess  
✓ Non-interactive mode via `--print` flag  
✓ Multiple output formats (text, json, stream-json)

### 2. Stdin/Stdout Communication
✗ Cannot pipe prompts directly via stdin  
✓ Workaround: Use command substitution  
✓ Hooks system provides true bidirectional stdin/stdout  
✓ Stream JSON format for real-time events

### 3. Recommended Integration Approach

**Phase 1 (Simplest - Recommended First)**
```bash
cursor agent --print --output-format json "your task"
```
- Easy to implement
- Works locally
- Good for simple Discord commands

**Phase 2 (Real-time - Recommended for Discord)**
```bash
cursor agent --print --output-format stream-json --stream-partial-output "task"
```
- Real-time updates
- Perfect for Discord message streaming
- More complex parsing

**Phase 3 (Advanced - Future)**
- Hooks system for security gates
- Approval workflows
- Audit logging

**Phase 4 (Enterprise - Optional)**
- Cloud Agents REST API
- Remote execution
- Requires API key

---

## Quick Start

### 1. Install Cursor Agent CLI
```bash
curl https://cursor.com/install -fsSL | bash
cursor agent --version
```

### 2. Test Non-Interactive Mode
```bash
cursor agent --print --output-format json "list the current directory"
```

### 3. Implement Node.js Wrapper
See [CURSOR-QUICK-REFERENCE.md](./CURSOR-QUICK-REFERENCE.md#nodejs-wrapper-simplest-integration)

### 4. Integrate with Discord
See [CURSOR-QUICK-REFERENCE.md](./CURSOR-QUICK-REFERENCE.md#discord-bot-integration-example)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│              Discord Bot (Node.js)                  │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ Discord Slash Command
                   ↓
        ┌─────────────────────┐
        │  Cursor Wrapper     │
        │  (Node.js/spawn)    │
        └──────────┬──────────┘
                   │
                   ├─→ Simple CLI (Phase 1)
                   │   cursor agent --print --output-format json
                   │   └─ Output: JSON (complete)
                   │
                   ├─→ Stream JSON (Phase 2)
                   │   cursor agent --print --output-format stream-json
                   │   └─ Output: JSON objects (real-time)
                   │
                   ├─→ Hooks (Phase 3)
                   │   ~/.cursor/hooks.json
                   │   └─ Control: stdin/stdout JSON
                   │
                   └─→ Cloud API (Phase 4)
                       https://api.cursor.com/v0/agents
                       └─ REST-based remote execution

        ┌─────────────────────────────────────────┐
        │         Cursor Agent Process            │
        │  (spawned subprocess)                   │
        │                                         │
        │  - File operations                      │
        │  - Shell commands                       │
        │  - Code analysis                        │
        │  - MCP tools                            │
        └─────────────────────────────────────────┘
```

---

## Security Considerations

### For Discord Bot Integration

1. **Input Sanitization**
   - Sanitize Discord user input before passing to Cursor
   - Prevent command injection
   - Use allowlists for safe operations

2. **File Access Control**
   - Use `--workspace` to restrict directory access
   - Consider `--sandbox enabled` for untrusted prompts
   - Use hooks for fine-grained file access control

3. **Command Execution**
   - Use hooks to block dangerous commands (rm -rf, sudo, etc.)
   - Require approval for sensitive operations
   - Log all operations for audit

4. **API Key Security**
   - Never log API keys
   - Store in environment variables only
   - Rotate regularly if exposed

---

## Performance Characteristics

| Approach | Startup | First Response | Real-time | Local | Setup |
|----------|---------|---|---|---|---|
| **Non-Interactive CLI** | ~1-2s | ~5-30s | ✗ | ✓ | Easy |
| **Stream JSON** | ~1-2s | ~2-5s (first chunk) | ✓ | ✓ | Medium |
| **Hooks** | Existing | Real-time | ✓ | ✓ | Hard |
| **Cloud API** | Network | ~5-10s | ~ | ✗ | Medium |

---

## Known Limitations

1. **No native stdin prompt input** - Use `$(cat file)` workaround
2. **Cursor installation required** - Unless using Cloud API
3. **Full write access in non-interactive mode** - Use hooks for approval
4. **Synchronous hook execution** - Can slow down operations
5. **First invocation slow** - Agent CLI installs dependencies

---

## Next Steps

### For Implementation Team

1. ✓ Research Complete (this documentation)
2. → Implement Phase 1 CLI wrapper
3. → Test with Discord command
4. → Evaluate output quality and speed
5. → Plan Phase 2 streaming integration
6. → Implement security gates via hooks
7. → Set up audit logging

### For Discord Bot Users

1. Ensure Cursor is installed: `curl https://cursor.com/install | bash`
2. Set any required environment variables
3. Use `/cursor-agent` command to execute tasks
4. Review output for quality and formatting
5. Provide feedback on integration

---

## Resources

### Official Documentation
- [Cursor CLI Docs](https://cursor.com/docs/cli/overview)
- [Using Agent in CLI](https://cursor.com/docs/cli/using)
- [Hooks System](https://cursor.com/docs/agent/hooks)
- [Cloud Agents API](https://cursor.com/docs/cloud-agent/api/endpoints)

### Community Examples
- [cursor-hooks examples (hamzafer)](https://github.com/hamzafer/cursor-hooks)
- [cursor-hooks library (johnlindquist)](https://github.com/johnlindquist/cursor-hooks)

### Blog Posts & Guides
- [Cursor Agent CLI Announcement](https://cursor.com/blog/cli)
- [Cursor Hooks Deep Dive (GitButler Blog)](https://blog.gitbutler.com/cursor-hooks-deep-dive)
- [How to Use Cursor Hooks (Skywork.ai)](https://skywork.ai/blog/how-to-cursor-1-7-hooks-guide/)

---

## Document Information

- **Research Date**: January 6, 2026
- **Cursor Version Tested**: 2.2.27 (CLI: 2026.01.02-80e4d9b)
- **Status**: Complete and ready for implementation
- **Last Updated**: January 6, 2026
- **Next Review**: Q2 2026

---

## Questions?

Refer to the relevant document:
- **Getting started?** → [CURSOR-QUICK-REFERENCE.md](./CURSOR-QUICK-REFERENCE.md)
- **Need details?** → [CURSOR-INTEGRATION.md](./CURSOR-INTEGRATION.md)
- **Want code examples?** → See both documents
