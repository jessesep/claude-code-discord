/**
 * MCP (Model Context Protocol) Client
 * Handles calling MCP tools and resources
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * List available MCP tools
 */
export async function listMCPTools(): Promise<MCPTool[]> {
  try {
    // This would call the MCP server to list tools
    // For now, return empty array - will be implemented when MCP server is configured
    return [];
  } catch (error) {
    console.error('[MCP] Error listing tools:', error);
    return [];
  }
}

/**
 * List available MCP resources
 */
export async function listMCPResources(): Promise<MCPResource[]> {
  try {
    // Use the MCP resource listing function if available
    // This is a placeholder - actual implementation would call MCP servers
    return [];
  } catch (error) {
    console.error('[MCP] Error listing resources:', error);
    return [];
  }
}

/**
 * Call an MCP tool
 */
export async function callMCPTool(
  toolName: string,
  arguments_: Record<string, any>
): Promise<any> {
  try {
    // This would call the MCP server to execute the tool
    // For now, throw error - will be implemented when MCP server is configured
    throw new Error(`MCP tool calling not yet implemented. Tool: ${toolName}`);
  } catch (error) {
    console.error(`[MCP] Error calling tool ${toolName}:`, error);
    throw error;
  }
}

/**
 * Get MCP tool information for agent prompts
 */
export async function getMCPToolsInfo(): Promise<string> {
  try {
    const tools = await listMCPTools();
    const resources = await listMCPResources();
    
    let info = '\n\n=== AVAILABLE TOOLS ===\n';
    
    if (tools.length > 0) {
      info += 'MCP Tools:\n';
      for (const tool of tools) {
        info += `- ${tool.name}: ${tool.description}\n`;
      }
    }
    
    if (resources.length > 0) {
      info += '\nMCP Resources:\n';
      for (const resource of resources) {
        info += `- ${resource.name} (${resource.uri}): ${resource.description || 'No description'}\n`;
      }
    }
    
    // Add fallback tools info
    info += '\nFallback Tools (available if MCP is not configured):\n';
    info += '- GitHub Issue Creation: Use the GitHub issue creation action format:\n';
    info += '  ```json\n';
    info += '  {\n';
    info += '    "action": "create_github_issue",\n';
    info += '    "title": "Issue title",\n';
    info += '    "body": "Issue description",\n';
    info += '    "labels": ["bug", "enhancement"]  // Optional\n';
    info += '  }\n';
    info += '  ```\n';
    info += '  The system will automatically execute this and create the issue using GitHub CLI (gh).\n';
    
    info += '\nTo use an MCP tool, ask the system to call it with the appropriate parameters.\n';
    info += 'If MCP is not available, use the action format above instead of generating scripts.\n';
    info += '=== END TOOLS ===\n';
    
    return info;
  } catch (error) {
    console.error('[MCP] Error getting tools info:', error);
    return '';
  }
}
