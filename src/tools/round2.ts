/**
 * PolyPlan MCP — Round 2 Tool
 *
 * Handles the second round: peer review + master plans.
 * Each model reads all Round 1 plans *except its own*, then creates
 * a revised master plan informed by every other model's thinking.
 *
 * Responsibilities:
 * - Validate that at least 2 Round 1 plans exist
 * - Inject all other models' Round 1 plans + own plan separately
 * - Save the plan to .plans/round2-{cli}-{model}.md
 * - Log the action to history
 */

import type { CallerIdentity, Round2Input } from "../types.js";
import { readConfig } from "../core/session.js";
import { readPlansByRound, writePlan, buildPlanFilename } from "../core/plansManager.js";
import { logAction } from "../core/historyLogger.js";

/**
 * Generate the Round 2 prompt with all peer plans injected.
 */
export function generateRound2Prompt(
  projectName: string,
  ownPlanContent: string | null,
  otherPlans: Array<{ identifier: string; content: string }>
): string {
  const ownSection = ownPlanContent
    ? `YOUR ROUND 1 PLAN:\n${ownPlanContent}`
    : "YOUR ROUND 1 PLAN:\n(No Round 1 plan found for this model — you are joining fresh in Round 2)";

  const othersSection = otherPlans
    .map((p) => `--- ${p.identifier} ---\n${p.content}`)
    .join("\n\n");

  return `You are participating in a multi-model planning session using PolyPlan.

PROJECT: ${projectName}
ROUND: 2 of 3 — Peer Review Master Plan

${ownSection}

OTHER MODELS' ROUND 1 PLANS:
${othersSection}

Your task:
1. Review all other models' plans
2. Note where you agree, disagree, or where they raised points you missed
3. If another model answered a question you had, incorporate that answer
4. Create your revised master plan informed by all the above
5. Explicitly note: what you changed from Round 1 and why`;
}

/**
 * Execute the Round 2 tool.
 */
export async function executeRound2(
  projectRoot: string,
  identity: CallerIdentity,
  input: Round2Input
): Promise<{ prompt?: string; saved?: string; error?: string }> {
  if (!input.plan || input.plan.trim().length === 0) {
    return { error: "Plan content is empty. Please provide a valid plan." };
  }

  const config = await readConfig(projectRoot);
  if (!config) {
    return { error: "Project not initialized. Run `polyplan-mcp init` first." };
  }

  // Read all Round 1 plans
  const round1Plans = await readPlansByRound(projectRoot, "round1");

  // Validate minimum plans
  if (round1Plans.length < 2) {
    return {
      error: `Round 2 requires at least 2 Round 1 plans. Currently have ${round1Plans.length}. Run /polyplan round1 in more CLI tools first.`,
    };
  }

  // Save the plan
  const filename = await writePlan(
    projectRoot,
    "round2",
    identity.cliTool,
    identity.modelName,
    input.plan
  );

  await logAction(
    projectRoot,
    identity.cliTool,
    identity.modelName,
    "round2",
    `Saved Round 2 plan: ${filename}`
  );

  return { saved: filename };
}

/**
 * Get the Round 2 context/prompt for a given model.
 * Feeds all Round 1 plans except the caller's own.
 */
export async function getRound2Context(
  projectRoot: string,
  identity: CallerIdentity
): Promise<{ prompt: string; error?: string }> {
  const config = await readConfig(projectRoot);
  if (!config) {
    return { prompt: "", error: "Project not initialized. Run `polyplan-mcp init` first." };
  }

  const round1Plans = await readPlansByRound(projectRoot, "round1");

  if (round1Plans.length < 2) {
    return {
      prompt: "",
      error: `Round 2 requires at least 2 Round 1 plans. Currently have ${round1Plans.length}.`,
    };
  }

  // Split into own plan and others
  const ownPlan = round1Plans.find(
    (p) => p.cliTool === identity.cliTool && p.modelName === identity.modelName
  );
  const otherPlans = round1Plans.filter(
    (p) => !(p.cliTool === identity.cliTool && p.modelName === identity.modelName)
  );

  const prompt = generateRound2Prompt(
    config.projectName,
    ownPlan?.content ?? null,
    otherPlans.map((p) => ({
      identifier: `${p.cliTool}-${p.modelName}`,
      content: p.content,
    }))
  );

  return { prompt };
}
