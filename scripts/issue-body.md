## Summary

A stale duplicate repository clone (`claude-code-discord-investigate`) was discovered alongside the main `claude-code-discord` repo. This issue documents how it happened, the root cause, and prevention strategies.

## What Happened

Two identical clones of the same repository existed in `/Users/jessesep/repos/`:
- `claude-code-discord` (active, with uncommitted work)
- `claude-code-discord-investigate` (stale, clean git state)

Both pointed to the same GitHub remote (`jessesep/claude-code-discord`) and were on the `investigate-slash-commands` branch at the same commit (`5aae92a`).

## Why This Likely Happened

1. **Investigation/debugging workflow**: The folder name suggests it was created to investigate an issue (possibly slash commands based on the branch name) without risking changes to the main working copy.

2. **Forgot to delete after investigation**: Once the investigation was complete, the clone was not cleaned up.

3. **No clear workspace organization**: Without a convention for temporary/investigation clones, it's easy to lose track of them.

4. **Similar modification times**: Both were modified on the same day, suggesting parallel work at some point that diverged.

## Impact

- **Disk space waste**: ~50MB+ of duplicate files
- **Potential confusion**: Risk of making changes in wrong repo
- **Stale code**: The investigate repo had old file organization (scripts/tests in root) vs cleaned up structure in main

## Resolution

The `claude-code-discord-investigate` folder was deleted after confirming:
- ✅ No unique uncommitted changes
- ✅ No stash entries
- ✅ Main repo had all the latest work
- ✅ Both repos pointed to same remote

## Prevention Strategies

### 1. Use Git Worktrees Instead of Clones
```bash
# Instead of cloning again, use worktrees for parallel work
git worktree add ../investigate-branch investigate-slash-commands
# When done:
git worktree remove ../investigate-branch
```

### 2. Naming Convention for Temporary Clones
If cloning is necessary, use a prefix that makes cleanup obvious:
- `_tmp-claude-code-discord-investigate` (underscore prefix)
- `TEMP-claude-code-discord-investigate` (TEMP prefix)

### 3. Periodic Cleanup Script
Add a script to check for duplicate repos:
```bash
# Find repos with same remote
find ~/repos -name ".git" -exec sh -c '
  remote=$(git -C "$(dirname {})" remote get-url origin 2>/dev/null)
  echo "$remote $(dirname {})"
' \; | sort | uniq -d -f1
```

### 4. Document in CONTRIBUTING.md
Add a section about workspace organization and avoiding duplicate clones.

## Checklist

- [x] Identified the duplicate repo
- [x] Verified no unique changes would be lost
- [x] Deleted the stale clone
- [ ] Consider adding worktree guidance to CONTRIBUTING.md
- [ ] Consider adding a cleanup script to `scripts/`

## Related

- Branch: `investigate-slash-commands`
- The investigation this clone was likely created for has been resolved (branch exists with commits)
