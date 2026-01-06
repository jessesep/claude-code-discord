# Security Patch Example: Command Injection Fix

## Issue
Command injection vulnerability in `shell/handler.ts` allows arbitrary command execution.

## Patch

### File: `shell/handler.ts`

```typescript
// Add validation function at top of file
/**
 * Validates shell command for security
 * @param command - Command to validate
 * @returns Validation result with reason if invalid
 */
function validateShellCommand(command: string): { valid: boolean; reason?: string } {
  // Check for empty or whitespace-only commands
  if (!command || !command.trim()) {
    return { valid: false, reason: "Command cannot be empty" };
  }

  // Block command chaining (; & | ` $ ( ) { })
  if (/[;&|`$(){}]/.test(command)) {
    return { valid: false, reason: "Command chaining not allowed for security" };
  }

  // Block dangerous commands
  const dangerousPatterns = [
    /rm\s+-rf/i,      // Force delete
    /dd\s+if=/i,      // Disk operations
    /mkfs/i,          // Format operations
    /fdisk/i,         // Partition operations
    /\bsudo\b/i,      // Privilege escalation
    /\bsu\s+/i,       // User switching
    /chmod\s+777/i,   // Dangerous permissions
    />\s*\/etc/i,     // Writing to system dirs
    />\s*\/sys/i,     // Writing to system dirs
    />\s*\/proc/i,    // Writing to system dirs
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return { valid: false, reason: "Dangerous command pattern detected" };
    }
  }

  // Block path traversal attempts
  if (command.includes('..')) {
    return { valid: false, reason: "Path traversal not allowed" };
  }

  // Block output redirection to system paths
  const outputRedirect = command.match(/>\s*(.+)/);
  if (outputRedirect) {
    const outputPath = outputRedirect[1].trim();
    // Check if redirecting to system directories
    if (/^\/etc|\/sys|\/proc|\/dev/.test(outputPath)) {
      return { valid: false, reason: "Cannot redirect output to system directories" };
    }
  }

  return { valid: true };
}

// Modify execute method
async execute(command: string, input?: string, discordContext?: any): Promise<ShellExecutionResult> {
  // ✅ ADD VALIDATION
  const validation = validateShellCommand(command);
  if (!validation.valid) {
    throw new Error(`Invalid command: ${validation.reason}`);
  }

  const processId = ++this.processIdCounter;
  let output = '';
  const outputCallbacks: ((data: string) => void)[] = [];
  const completeCallbacks: ((code: number, output: string) => void)[] = [];
  const errorCallbacks: ((error: Error) => void)[] = [];

  // ... rest of existing code remains the same
```

### File: `shell/command.ts` (Handler wrapper)

```typescript
export function createShellHandlers(deps: ShellHandlerDeps) {
  return {
    async onShell(ctx: InteractionContext, command: string, input?: string): Promise<void> {
      await ctx.deferReply();
      
      // ✅ ADD VALIDATION AT HANDLER LEVEL TOO
      if (!command || !command.trim()) {
        await ctx.editReply({
          embeds: [{
            color: 0xff0000,
            title: '❌ Invalid Command',
            description: 'Shell command cannot be empty.',
            timestamp: true
          }]
        });
        return;
      }

      try {
        const executionResult = await deps.shellManager.execute(command.trim(), input, ctx);
        // ... rest of existing code
      } catch (error) {
        // ✅ IMPROVED ERROR HANDLING
        const errorMessage = error instanceof Error ? error.message : String(error);
        await ctx.editReply({
          embeds: [{
            color: 0xff0000,
            title: '❌ Command Execution Error',
            description: `\`${command}\``,
            fields: [
              { name: 'Error', value: `\`\`\`\n${errorMessage}\n\`\`\``, inline: false }
            ],
            timestamp: true
          }]
        });
      }
    },
    // ... rest of handlers
  };
}
```

## Testing

### Test Cases

```typescript
// tests/shell-security.test.ts
Deno.test("Shell handler rejects command chaining", async () => {
  const handler = createShellHandlers({ shellManager });
  await assertThrowsAsync(
    () => handler.onShell(ctx, "ls; rm -rf /"),
    Error,
    "Command chaining not allowed"
  );
});

Deno.test("Shell handler rejects dangerous commands", async () => {
  await assertThrowsAsync(
    () => handler.onShell(ctx, "rm -rf /important"),
    Error,
    "Dangerous command pattern"
  );
});

Deno.test("Shell handler rejects path traversal", async () => {
  await assertThrowsAsync(
    () => handler.onShell(ctx, "cat ../../etc/passwd"),
    Error,
    "Path traversal not allowed"
  );
});

Deno.test("Shell handler accepts valid commands", async () => {
  // Should not throw
  await handler.onShell(ctx, "ls -la");
  await handler.onShell(ctx, "git status");
  await handler.onShell(ctx, "echo hello");
});
```

## Impact Assessment

**Before Fix:**
- ❌ Any user with `/shell` access can execute arbitrary commands
- ❌ System compromise possible
- ❌ Data exfiltration risk

**After Fix:**
- ✅ Commands validated before execution
- ✅ Dangerous patterns blocked
- ✅ Clear error messages for rejected commands
- ⚠️ Still requires role-based access control (Discord permissions)

## Additional Recommendations

1. **Role-Based Access Control:** Ensure `/shell` command is restricted to trusted roles
2. **Command Whitelist:** Consider implementing a whitelist of allowed commands for production
3. **Audit Logging:** Log all shell commands for security auditing
4. **Sandboxing:** Consider running commands in a sandboxed environment

## Estimated Effort

- **Development:** 2-3 hours
- **Testing:** 1-2 hours
- **Review:** 1 hour
- **Total:** 4-6 hours

---

**Priority:** 🔴 CRITICAL - Fix immediately before production deployment
