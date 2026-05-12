/**
 * PolyPlan MCP — Clear Tool
 *
 * Wipes plan files. Can clear all plans, or just a specific round.
 * Always requires confirmation before destructive action.
 */

import type { CallerIdentity, ClearInput, Round } from "../types.js";
import { clearAllPlans, clearRound, listPlans, listPlansByRound } from "../core/plansManager.js";
import { logAction } from "../core/historyLogger.js";

/**
 * Execute the clear tool.
 */
export async function executeClear(
  projectRoot: string,
  identity: CallerIdentity,
  input: ClearInput
): Promise<{ message: string; error?: string }> {
  // Require confirmation
  if (!input.confirm) {
    if (input.target === "all") {
      const plans = await listPlans(projectRoot);
      return {
        message: `⚠ This will delete ALL ${plans.length} plan file(s) across all rounds.\nPass confirm: true to proceed.`,
      };
    } else {
      const plans = await listPlansByRound(projectRoot, input.target);
      return {
        message: `⚠ This will delete ${plans.length} plan file(s) from ${input.target}.\nPass confirm: true to proceed.`,
      };
    }
  }

  // Execute the clear
  let deleted: number;
  let target: string;

  if (input.target === "all") {
    deleted = await clearAllPlans(projectRoot);
    target = "all rounds";
  } else {
    deleted = await clearRound(projectRoot, input.target);
    target = input.target;
  }

  await logAction(
    projectRoot,
    identity.cliTool,
    identity.modelName,
    "clear",
    `Cleared ${deleted} plan(s) from ${target}`
  );

  return {
    message: `🗑 Cleared ${deleted} plan file(s) from ${target}.`,
  };
}
