/**
 * PolyPlan MCP — Questions Tool
 *
 * MCP tool wrapper for the question tracker.
 * Surfaces open questions raised by any model, and which were answered.
 */

import type { CallerIdentity } from "../types.js";
import { readPlansByRound } from "../core/plansManager.js";
import { trackQuestions, formatQuestions } from "../core/questionTracker.js";
import { logAction } from "../core/historyLogger.js";

/**
 * Execute the questions tool.
 */
export async function executeQuestions(
  projectRoot: string,
  identity: CallerIdentity
): Promise<string> {
  const round1Plans = await readPlansByRound(projectRoot, "round1");

  if (round1Plans.length === 0) {
    return "No Round 1 plans found. Run /polyplan round1 first.";
  }

  const questions = trackQuestions(round1Plans);
  const formatted = formatQuestions(questions, "Round 1");

  await logAction(
    projectRoot,
    identity.cliTool,
    identity.modelName,
    "questions",
    `Tracked questions: ${questions.length} found, ${questions.filter((q) => q.answered).length} answered`
  );

  return formatted;
}
