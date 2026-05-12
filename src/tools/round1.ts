/**
 * PolyPlan MCP — Round 1 Tool
 *
 * Handles the first round of planning: each model independently
 * creates its own plan without seeing what other models think.
 *
 * Responsibilities:
 * - Inject the Round 1 prompt with project name + problem description
 * - Detect model switches (same CLI, different model in same round)
 * - Save the plan to .plans/round1-{cli}-{model}.md
 * - Log the action to history
 */

import type { CallerIdentity, Round1Input, ModelSwitchResult } from "../types.js";
import { readConfig, updateConfig } from "../core/session.js";
import { writePlan, findPlansForCli, buildPlanFilename } from "../core/plansManager.js";
import { logAction } from "../core/historyLogger.js";

/**
 * Generate the Round 1 prompt that gets injected before the model's thinking.
 */
export function generateRound1Prompt(
  projectName: string,
  problemDescription: string
): string {
  return `You are participating in a multi-model planning session using PolyPlan.

PROJECT: ${projectName}
ROUND: 1 of 3 — Individual Plan

PROBLEM/REQUIREMENT:
${problemDescription}

Your task: Create a detailed implementation plan for this problem. 
Be thorough. Cover architecture, file structure, edge cases, dependencies, 
open questions you have, and any risks you foresee.

This plan will be reviewed by other AI models in the next round.
Save your plan with clear section headers.`;
}

/**
 * Check for model switch: same CLI tool already has a plan from a different model.
 */
export async function checkModelSwitch(
  projectRoot: string,
  identity: CallerIdentity
): Promise<ModelSwitchResult> {
  const existingPlans = await findPlansForCli(projectRoot, "round1", identity.cliTool);

  // Filter out plans from the same model (not a switch)
  const differentModelPlans = existingPlans.filter(
    (p) => p.modelName !== identity.modelName
  );

  if (differentModelPlans.length > 0) {
    const existing = differentModelPlans[0];
    return {
      switchDetected: true,
      previousModel: existing.modelName,
      currentModel: identity.modelName,
      cliTool: identity.cliTool,
      existingFile: existing.filename,
    };
  }

  return {
    switchDetected: false,
    currentModel: identity.modelName,
    cliTool: identity.cliTool,
  };
}

/**
 * Execute the Round 1 tool.
 *
 * @returns Object with the prompt to inject and instructions, or the saved filename
 */
export async function executeRound1(
  projectRoot: string,
  identity: CallerIdentity,
  input: Round1Input
): Promise<{ prompt?: string; saved?: string; switchWarning?: string }> {
  if (!input.plan || input.plan.trim().length === 0) {
    return { switchWarning: "❌ Plan content is empty. Please provide a valid plan." };
  }
  // Ensure config exists; update problem description
  const config = await updateConfig(projectRoot, {
    problemDescription: input.problemDescription,
  });

  // Check for model switch
  const switchResult = await checkModelSwitch(projectRoot, identity);

  if (switchResult.switchDetected) {
    const newFile = buildPlanFilename("round1", identity.cliTool, identity.modelName);
    const switchWarning = `⚠ Model switch detected in ${identity.cliTool}:
   Previous: ${switchResult.previousModel}
   Current:  ${identity.modelName}

Options:
  [1] Save as separate plan  →  ${newFile}  (both kept)
  [2] Replace existing plan  →  overwrites ${switchResult.existingFile}
  [3] Cancel

Recommendation: [1] — keep both. More perspectives = better Final round.
Proceeding with [1] — saving as separate plan.`;

    // Default: save as separate (option 1)
    const filename = await writePlan(
      projectRoot,
      "round1",
      identity.cliTool,
      identity.modelName,
      input.plan
    );

    await logAction(
      projectRoot,
      identity.cliTool,
      identity.modelName,
      "round1",
      `Saved Round 1 plan (model switch from ${switchResult.previousModel}): ${filename}`
    );

    return { saved: filename, switchWarning };
  }

  // No switch — save normally
  const filename = await writePlan(
    projectRoot,
    "round1",
    identity.cliTool,
    identity.modelName,
    input.plan
  );

  await logAction(
    projectRoot,
    identity.cliTool,
    identity.modelName,
    "round1",
    `Saved Round 1 plan: ${filename}`
  );

  return { saved: filename };
}

/**
 * Get the Round 1 prompt for a given project and problem.
 * This is called to provide context to the model before it generates its plan.
 */
export async function getRound1Context(
  projectRoot: string,
  problemDescription: string
): Promise<string> {
  const config = await readConfig(projectRoot);
  const projectName = config?.projectName ?? "Unknown Project";
  return generateRound1Prompt(projectName, problemDescription);
}
