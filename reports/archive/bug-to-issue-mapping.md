# Bug ID to GitHub Issue Mapping

Quick reference for tracking original bug IDs from test reports to their corresponding GitHub issues.

## Agent 2 - Conversation Flow Bugs

| Bug ID | GitHub Issue | Title | Severity |
|--------|--------------|-------|----------|
| BUG-A2-001 | [#19](https://github.com/jessesep/claude-code-discord/issues/19) | Session persistence not implemented | CRITICAL |
| BUG-A2-002 | [#20](https://github.com/jessesep/claude-code-discord/issues/20) | Message length validation missing | CRITICAL |
| BUG-A2-003 | [#22](https://github.com/jessesep/claude-code-discord/issues/22) | Natural message routing unclear | MEDIUM |
| BUG-A2-004 | [#23](https://github.com/jessesep/claude-code-discord/issues/23) | No session timeout mechanism | MEDIUM |
| BUG-A2-005 | [#24](https://github.com/jessesep/claude-code-discord/issues/24) | Cursor conversation ID not tracked | MEDIUM |

## Agent 3 - Session Management Bugs

| Bug ID | GitHub Issue | Title | Severity |
|--------|--------------|-------|----------|
| BUG-A3-001 | [#21](https://github.com/jessesep/claude-code-discord/issues/21) | Orphaned sessions - memory leak | HIGH |
| BUG-A3-002 | [#25](https://github.com/jessesep/claude-code-discord/issues/25) | Session metrics never updated | MEDIUM |
| BUG-A3-003 | [#26](https://github.com/jessesep/claude-code-discord/issues/26) | Status shows global session count | MEDIUM |
| BUG-A3-004 | **DUPLICATE** | Consolidated into #19 | MEDIUM |
| BUG-A3-005 | [#30](https://github.com/jessesep/claude-code-discord/issues/30) | No per-channel agent isolation | LOW |

## Agent 4 - Error Handling Bugs

| Bug ID | GitHub Issue | Title | Severity |
|--------|--------------|-------|----------|
| BUG-A4-001 | [#27](https://github.com/jessesep/claude-code-discord/issues/27) | Empty prompt validation missing | MEDIUM |
| BUG-A4-002 | [#18](https://github.com/jessesep/claude-code-discord/issues/18) | No rate limiting - spam attacks | HIGH (Security) |
| BUG-A4-003 | [#28](https://github.com/jessesep/claude-code-discord/issues/28) | Silent session abort on errors | MEDIUM |
| BUG-A4-004 | [#29](https://github.com/jessesep/claude-code-discord/issues/29) | No token limit validation | MEDIUM |
| BUG-A4-005 | [#17](https://github.com/jessesep/claude-code-discord/issues/17) | Path traversal vulnerability | HIGH (Security) |
| BUG-A4-006 | [#31](https://github.com/jessesep/claude-code-discord/issues/31) | Empty shell command validation | LOW |
| BUG-A4-007 | [#32](https://github.com/jessesep/claude-code-discord/issues/32) | Missing error context | LOW |

## Summary

- **Total Bugs Identified:** 17
- **Duplicates Removed:** 1 (BUG-A3-004)
- **GitHub Issues Created:** 16
- **Issue Number Range:** #17 - #32

## Priority Distribution

| Priority | Count | Issue Numbers |
|----------|-------|---------------|
| Security | 2 | #17, #18 |
| Critical | 2 | #19, #20 |
| High | 1 | #21 |
| Medium | 8 | #22-#29 |
| Low | 3 | #30-#32 |

---

**Note:** Issue numbers #13-16 were created in a previous run and appear to be duplicates. The canonical issues are #17-32 created on 2026-01-06.
