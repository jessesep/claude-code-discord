import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";
import { relative, join, dirname } from "https://deno.land/std@0.224.0/path/mod.ts";

/**
 * Configuration for major functional directories.
 * We'll scan first-level directories except those in EXCLUDE_DIRS.
 */
const EXCLUDE_DIRS = [
    ".git",
    ".github",
    "node_modules",
    ".handoffs",
    "test-reports",
    "dist",
    "build",
    ".agent",
    ".gemini",
];

const STALE_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours

type ContextStatus = "OK" | "MISSING" | "STALE" | "BROKEN_LINKS";

interface DirectoryHealth {
    directory: string;
    status: ContextStatus;
    lastUpdated: string;
    details: string[];
}

async function getDirectoryHealth(dir: string): Promise<DirectoryHealth> {
    const contextPath = join(dir, ".agent-context.md");
    const health: DirectoryHealth = {
        directory: relative(Deno.cwd(), dir) || ".",
        status: "OK",
        lastUpdated: "-",
        details: [],
    };

    let contextExists = false;
    let contextMtime = 0;

    try {
        const stat = await Deno.stat(contextPath);
        contextExists = true;
        contextMtime = stat.mtime?.getTime() || 0;
        health.lastUpdated = stat.mtime?.toLocaleString() || "Unknown";
    } catch {
        contextExists = false;
    }

    if (!contextExists) {
        // Only report missing if there are code files in the directory
        let hasCode = false;
        for await (const entry of Deno.readDir(dir)) {
            if (entry.isFile && (entry.name.endsWith(".ts") || entry.name.endsWith(".js") || entry.name.endsWith(".sh"))) {
                hasCode = true;
                break;
            }
        }

        if (hasCode) {
            health.status = "MISSING";
        } else {
            // If no code, we don't strictly require context (e.g., data/ or empty dirs)
            health.status = "OK";
        }
        return health;
    }

    // 1. Validate Filepaths Referenced in Context
    const contextContent = await Deno.readTextFile(contextPath);
    // Match `path/to/file` or [text](path/to/file)
    const backtickMatches = contextContent.matchAll(/`([^`\n]+)`/g);
    const linkMatches = contextContent.matchAll(/\[[^\]]+\]\(([^)]+)\)/g);

    const extractedPaths = new Set<string>();
    for (const match of backtickMatches) extractedPaths.add(match[1]);
    for (const match of linkMatches) {
        const path = match[1].split('#')[0]; // Remove anchors
        if (path && !path.startsWith('http')) extractedPaths.add(path);
    }

    for (const path of extractedPaths) {
        // Heuristic filters to avoid false positives
        if (path.startsWith('npm:')) continue;
        if (path.startsWith('gemini-')) continue;
        if (path.startsWith('claude-')) continue;
        if (path.startsWith('Deno.')) continue;
        if (path.includes(' ')) continue; // Paths shouldn't have spaces in this repo usually
        if (!path.includes('.') && !path.includes('/')) continue; // Likely just a word/command
        if (path.includes('*') || path.includes('..') || path.startsWith('/')) continue; // Skip globs or absolute/parent paths for now

        // Check relative to repo root if it looks like a repo path, or relative to current dir
        const potentialPaths = [
            join(Deno.cwd(), path),
            join(dir, path),
        ];

        let found = false;
        for (const p of potentialPaths) {
            try {
                await Deno.stat(p);
                found = true;
                break;
            } catch { /* continue */ }
        }

        if (!found) {
            health.status = "BROKEN_LINKS";
            health.details.push(`Broken link: \`${path}\``);
        }
    }

    // 2. Check for Staleness
    let newestCodeMtime = 0;
    let newestFile = "";

    for await (const entry of walk(dir, {
        includeDirs: false,
        exts: [".ts", ".js", ".sh", ".md"],
        skip: [/\.agent-context\.md$/],
    })) {
        const stat = await Deno.stat(entry.path);
        const mtime = stat.mtime?.getTime() || 0;
        if (mtime > newestCodeMtime) {
            newestCodeMtime = mtime;
            newestFile = relative(dir, entry.path);
        }
    }

    if (newestCodeMtime > contextMtime + STALE_THRESHOLD_MS) {
        health.details.push(`Newer code: \`${newestFile}\` (${new Date(newestCodeMtime).toLocaleString()})`);
        if (health.status === "OK") health.status = "STALE";
    }

    return health;
}

async function main() {
    const rootDir = Deno.cwd();
    const results: DirectoryHealth[] = [];

    // Check root context
    results.push(await getDirectoryHealth(rootDir));

    // Check subdirectories
    for await (const entry of Deno.readDir(rootDir)) {
        if (entry.isDirectory && !EXCLUDE_DIRS.includes(entry.name)) {
            results.push(await getDirectoryHealth(join(rootDir, entry.name)));
        }
    }

    // Sort results: Root first, then alphabetically
    results.sort((a, b) => {
        if (a.directory === ".") return -1;
        if (b.directory === ".") return 1;
        return a.directory.localeCompare(b.directory);
    });

    console.log("\n--- Context Tree Health Summary ---");
    console.table(
        results.map((r) => ({
            Directory: r.directory,
            Status: r.status,
            "Last Updated": r.lastUpdated,
            Details: r.details.slice(0, 1).join(", ") + (r.details.length > 1 ? ` (+${r.details.length - 1} more)` : ""),
        }))
    );

    const broken = results.filter(r => r.status === "BROKEN_LINKS" || r.status === "MISSING").length;
    const stale = results.filter(r => r.status === "STALE").length;

    if (broken > 0 || stale > 0) {
        console.log(`\n⚠️  Found ${broken} critical issues and ${stale} stale context files.`);
    } else {
        console.log("\n✅ All context files are healthy and up to date.");
    }
}

if (import.meta.main) {
    main();
}
