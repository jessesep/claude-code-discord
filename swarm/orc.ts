
import { runAgentTask } from "../agent/index.ts";

/**
 * Subagent Swarm Orchestrator
 * 
 * Coordinates a multi-agent workflow to complete a complex task.
 * 
 * Roles:
 * - Architect: Breaks down the task.
 * - Coder: Implements the solution.
 */

async function main() {
    const task = Deno.args[0] || "Create a simple HTTP server in Deno that returns 'Hello Swarm'.";

    console.log("🐝 initializing Swarm...");
    console.log(`🎯 Mission: "${task}"\n`);

    // 1. Planning Phase
    console.log("🧠 [Hive Mind] Architect is planning...");
    const plan = await runAgentTask("ag-architect",
        `Analyze this request and output a concise, step-by-step implementation plan: ${task}`,
        (chunk) => Deno.stdout.write(new TextEncoder().encode(chunk))
    );
    console.log("\n\n✅ Plan Created.\n");

    // 2. Execution Phase
    console.log("🔨 [Drone] Coder is implementing...");
    const code = await runAgentTask("ag-coder",
        `Here is the plan:\n${plan}\n\nImplement the solution in a single file. Return ONLY the code block.`,
        (chunk) => Deno.stdout.write(new TextEncoder().encode(chunk))
    );
    console.log("\n\n✅ Implementation Complete.\n");

    // 3. Review (Optional - could be another agent)

    console.log("🏁 Swarm Mission Accomplished.");
    console.log("---------------------------------------------------");
    console.log(code);
    console.log("---------------------------------------------------");
}

if (import.meta.main) {
    main();
}
