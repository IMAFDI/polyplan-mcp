/**
 * MCP prompt/resource registration for PolyPlan command discovery.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { POLYPLAN_COMMANDS, commandCatalogMarkdown } from "./commands.js";

function promptResult(description: string, text: string) {
  return {
    description,
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text,
        },
      },
    ],
  };
}

/**
 * Register MCP prompts that clients can expose as slash commands.
 */
export function registerPolyPlanPrompts(server: McpServer): void {
  for (const command of POLYPLAN_COMMANDS) {
    server.registerPrompt(
      command.name,
      {
        title: command.title,
        description: command.description,
        argsSchema: {
          arguments: z
            .string()
            .optional()
            .describe(command.argumentHint ?? "Optional command arguments"),
        },
      },
      ({ arguments: commandArgs }) =>
        promptResult(command.description, command.prompt(commandArgs?.trim() || "(none)"))
    );
  }
}

/**
 * Register a small resource so clients with resource browsers can discover the
 * available PolyPlan workflow commands even when they do not expose prompts.
 */
export function registerPolyPlanResources(server: McpServer): void {
  server.registerResource(
    "polyplan_commands",
    "polyplan://commands",
    {
      title: "PolyPlan Commands",
      description: "Available PolyPlan MCP tools and slash-command wrappers.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: `# PolyPlan Commands\n\n${commandCatalogMarkdown()}\n`,
        },
      ],
    })
  );
}
