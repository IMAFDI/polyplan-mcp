/**
 * PolyPlan MCP — Final Round Tool
 *
 * Handles the final synthesis round: one model reads ALL Round 1
 * and ALL Round 2 plans and produces a single, implementable plan.
 *
 * Responsibilities:
 * - Validate that at least 1 Round 2 plan exists
 * - Inject all Round 1 + Round 2 plans
 * - Save the plan to .plans/final-{cli}-{model}.md
 * - Log the action to history
 */

import type { CallerIdentity, FinalInput } from "../types.js";
import { readConfig } from "../core/session.js";
import { readPlansByRound, writePlan } from "../core/plansManager.js";
import { logAction } from "../core/historyLogger.js";

/**
 * Generate the Final round prompt with all plans injected.
 */
export function generateFinalPrompt(
  projectName: string,
  round1Plans: Array<{ identifier: string; content: string }>,
  round2Plans: Array<{ identifier: string; content: string }>
): string {
  const round1Section = round1Plans
    .map((p) => `--- ${p.identifier} ---\n${p.content}`)
    .join("\n\n");

  const round2Section = round2Plans
    .map((p) => `--- ${p.identifier} ---\n${p.content}`)
    .join("\n\n");

  return `You are participating in a multi-model planning session using PolyPlan.

PROJECT: ${projectName}
ROUND: 3 of 3 — Final Implementable Plan

ALL ROUND 1 PLANS:
${round1Section}

ALL ROUND 2 PLANS:
${round2Section}

Your task: Synthesize everything above into ONE final, complete, 
implementable plan. This plan will be handed directly to a coding agent 
for execution. It must be:
- Specific enough to implement without further clarification
- Include exact file structure, function names, dependencies
- Resolve all conflicts between models (state your decision and reason)
- Answer all open questions (if unanswerable, flag explicitly)
- Prioritized: what to build first, what can come later`;
}

/**
 * Execute the Final round tool.
 */
export async function executeFinal(
  projectRoot: string,
  identity: CallerIdentity,
  input: FinalInput
): Promise<{ saved?: string; error?: string }> {
  if (!input.plan || input.plan.trim().length === 0) {
    return { error: "Plan content is empty. Please provide a valid plan." };
  }

  const config = await readConfig(projectRoot);
  if (!config) {
    return { error: "Project not initialized. Run `polyplan-mcp init` first." };
  }

  // Validate Round 2 plans exist
  const round2Plans = await readPlansByRound(projectRoot, "round2");
  if (round2Plans.length < 1) {
    return {
      error: `Final round requires at least 1 Round 2 plan. Currently have ${round2Plans.length}. Run /polyplan round2 first.`,
    };
  }

  // Save the final plan
  const filename = await writePlan(
    projectRoot,
    "final",
    identity.cliTool,
    identity.modelName,
    input.plan
  );

  await logAction(
    projectRoot,
    identity.cliTool,
    identity.modelName,
    "final",
    `Saved Final plan: ${filename}`
  );

  return { saved: filename };
}

/**
 * Get the Final round context/prompt.
 * Feeds ALL Round 1 + ALL Round 2 plans.
 */
export async function getFinalContext(
  projectRoot: string
): Promise<{ prompt: string; error?: string }> {
  const config = await readConfig(projectRoot);
  if (!config) {
    return { prompt: "", error: "Project not initialized. Run `polyplan-mcp init` first." };
  }

  const round1Plans = await readPlansByRound(projectRoot, "round1");
  const round2Plans = await readPlansByRound(projectRoot, "round2");

  if (round2Plans.length < 1) {
    return {
      prompt: "",
      error: `Final round requires at least 1 Round 2 plan. Currently have ${round2Plans.length}.`,
    };
  }

  const prompt = generateFinalPrompt(
    config.projectName,
    round1Plans.map((p) => ({
      identifier: `${p.cliTool}-${p.modelName}`,
      content: p.content,
    })),
    round2Plans.map((p) => ({
      identifier: `${p.cliTool}-${p.modelName}`,
      content: p.content,
    }))
  );

  return { prompt };
}
