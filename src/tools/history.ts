/**
 * PolyPlan MCP — History Tool
 *
 * Full audit log — which model, CLI, round, time, action.
 */

import type { CallerIdentity } from "../types.js";
import { readHistoryRaw } from "../core/historyLogger.js";
import { logAction } from "../core/historyLogger.js";

export async function executeHistory(
  projectRoot: string,
  identity: CallerIdentity
): Promise<string> {
  const raw = await readHistoryRaw(projectRoot);

  await logAction(projectRoot, identity.cliTool, identity.modelName, "history", "Viewed history log");

  if (raw === "No history yet." || raw.trim().length === 0) {
    return "📜 No history entries yet. Actions will be logged as you use PolyPlan.";
  }

  return `📜 POLYPLAN HISTORY LOG\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${raw}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}
