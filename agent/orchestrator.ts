import { AgentRegistry } from "./registry.ts";
import { ROLE_DEFINITIONS } from "./types.ts";

/**
 * Load role document from repository
 * Falls back to systemPromptAddition if document doesn't exist
 */
export async function loadRoleDocument(roleId: string, workDir: string): Promise<string> {
  const role = ROLE_DEFINITIONS[roleId];
  if (!role) {
    return '';
  }

  try {
    const rolePath = `${workDir}/${role.documentPath}`;
    const roleContent = await Deno.readTextFile(rolePath);
    return `\n\n=== ROLE CONTEXT ===\n${roleContent}\n=== END ROLE CONTEXT ===\n`;
  } catch (error) {
    // If document doesn't exist, use the built-in prompt addition
    console.debug(`[Role] Could not read ${role.documentPath}, using built-in prompt`);
    return role.systemPromptAddition;
  }
}

/**
 * Run an agent task headlessly (without Discord context)
 * Used by Swarm Orchestrator
 */
export async function runAgentTask(
  agentId: string,
  task: string,
  onChunk?: (text: string) => void,
  isAuthorized: boolean = false,
  workDir?: string
): Promise<string> {
  const agent = AgentRegistry.getInstance().getAgent(agentId);
  if (!agent) throw new Error(`Agent ${agentId} not found`);

  const controller = new AbortController(); // No external control for now in headless
  let resultText = "";

  const clientType = agent.client || 'claude';
  const effectiveWorkDir = workDir || agent.workspace;

  if (clientType === 'cursor') {
    const { sendToCursorCLI } = await import("../provider-clients/cursor-client.ts");
    const safeTask = task.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const prompt = `${agent.systemPrompt}\n\n<task>${safeTask}</task>`;
    const result = await sendToCursorCLI(
      prompt,
      controller,
      {
        workspace: effectiveWorkDir,
        force: agent.force,
        sandbox: agent.sandbox,
        streamJson: true,
      },
      onChunk
    );
    resultText = result.response;
  } else if (clientType === 'antigravity') {
    const { sendToAntigravityCLI } = await import("../provider-clients/antigravity-client.ts");
    const safeSystemPrompt = agent.systemPrompt.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeTask = task.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const prompt = `${safeSystemPrompt}\n\n<task>${safeTask}</task>`;
    // SECURITY: Default to authorized=true (gcloud OAuth) for all Antigravity agents
    const result = await sendToAntigravityCLI(
      prompt,
      controller,
      {
        model: agent.model,
        workspace: effectiveWorkDir,
        streamJson: true,
        force: agent.force,
        sandbox: agent.sandbox,
        authorized: true, // Always use gcloud OAuth for Antigravity agents
      },
      onChunk
    );
    resultText = result.response;
  } else {
    throw new Error("Primary CLI client headless not yet supported");
  }

  return resultText;
}
