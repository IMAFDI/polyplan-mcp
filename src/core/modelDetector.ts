/**
 * PolyPlan MCP — Model Detector
 *
 * Detects the calling CLI tool and model name from MCP client context.
 * Falls back to explicit user-provided values when auto-detection isn't possible.
 */

import type { CallerIdentity } from "../types.js";

/**
 * Known CLI tool client names and their canonical identifiers.
 * Maps MCP clientInfo.name values to our internal names.
 */
const CLI_NAME_MAP: Record<string, string> = {
  "claude-code": "claudecode",
  "claude": "claudecode",
  "claudecode": "claudecode",
  "copilot": "copilot",
  "github-copilot": "copilot",
  "copilot-cli": "copilot",
  "cursor": "cursor",
  "opencode": "opencode",
  "open-code": "opencode",
  "codex": "codex",
  "codex-cli": "codex",
  "antigravity": "antigravity",
  "anti-gravity": "antigravity",
  "aider": "aider",
  "continue": "continue",
  "cline": "cline",
  "roo": "roo",
  "windsurf": "windsurf",
};

/**
 * Sanitize a model name for use in filenames.
 * Removes special characters but keeps dots and numbers.
 */
export function sanitizeModelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9.-]/g, "");
}

/**
 * Sanitize a CLI tool name for use in filenames.
 */
export function sanitizeCliName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/**
 * Detect the caller identity from MCP client info and optional explicit overrides.
 *
 * @param clientInfo - The MCP client info object from the protocol handshake
 * @param explicitModel - Optional model name explicitly provided by the user
 * @returns The detected caller identity, plus an optional warning string to surface in the tool response
 */
export function detectCaller(
  clientInfo?: { name?: string; version?: string },
  explicitModel?: string
): CallerIdentity & { modelWarning?: string } {
  // Detect CLI tool from client info
  let cliTool = "unknown";
  if (clientInfo?.name) {
    const normalized = clientInfo.name.toLowerCase().trim();
    cliTool = CLI_NAME_MAP[normalized] ?? sanitizeCliName(normalized);
  }

  // Model: use explicit if provided, otherwise "unknown"
  const modelName = explicitModel
    ? sanitizeModelName(explicitModel)
    : "unknown";

  // Surface as a tool-response warning (console.warn goes to stderr which the model never sees)
  const modelWarning = !explicitModel
    ? `⚠  Model name not detected. Your plan will be saved as "${cliTool}-unknown.md".\n` +
      `   To fix: pass the modelName parameter explicitly, e.g.:\n` +
      `   "Call polyplan_round1 with modelName='sonnet4.6' and problem='...'"`
    : undefined;

  return { cliTool, modelName, modelWarning };
}

/**
 * Build the model identifier string used in plan filenames.
 * Format: "{cliTool}-{modelName}"
 */
export function buildModelIdentifier(identity: CallerIdentity): string {
  return `${identity.cliTool}-${identity.modelName}`;
}
