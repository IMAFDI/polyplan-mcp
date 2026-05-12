/**
 * PolyPlan MCP — Conflicts Tool
 *
 * MCP tool wrapper for the conflict engine.
 * Shows all points where models disagreed in Round 1.
 */

import type { CallerIdentity } from "../types.js";
import { readPlansByRound } from "../core/plansManager.js";
import { detectConflicts, formatConflicts } from "../core/conflictEngine.js";
import { logAction } from "../core/historyLogger.js";

/**
 * Execute the conflicts tool.
 */
export async function executeConflicts(
  projectRoot: string,
  identity: CallerIdentity
): Promise<string> {
  const round1Plans = await readPlansByRound(projectRoot, "round1");

  if (round1Plans.length < 2) {
    return `Need at least 2 Round 1 plans to detect conflicts. Currently have ${round1Plans.length}.`;
  }

  const conflicts = detectConflicts(round1Plans);
  const formatted = formatConflicts(conflicts, "Round 1");

  await logAction(
    projectRoot,
    identity.cliTool,
    identity.modelName,
    "conflicts",
    `Analyzed conflicts: ${conflicts.length} found across ${round1Plans.length} plans`
  );

  return formatted;
}
