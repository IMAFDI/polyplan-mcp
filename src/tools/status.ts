/**
 * PolyPlan MCP — Status Tool
 *
 * Shows the full session state: which models have completed each round,
 * open questions count, and conflict count.
 */

import type { SessionStatus, RoundStatus, Round, PlanFile } from "../types.js";
import { readConfig } from "../core/session.js";
import { readPlansByRound, timeAgo } from "../core/plansManager.js";
import { logAction } from "../core/historyLogger.js";
import { detectConflicts } from "../core/conflictEngine.js";
import { trackQuestions } from "../core/questionTracker.js";

/**
 * Get the full session status.
 */
export async function getStatus(projectRoot: string): Promise<{
  status?: SessionStatus;
  formatted: string;
  error?: string;
}> {
  const config = await readConfig(projectRoot);
  if (!config) {
    return {
      formatted: "⚠ Project not initialized. Run `polyplan-mcp init` first.",
      error: "Project not initialized.",
    };
  }

  const rounds: Round[] = ["round1", "round2", "final"];
  const roundStatuses: Record<Round, RoundStatus> = {
    round1: { plans: [], hasPlans: false },
    round2: { plans: [], hasPlans: false },
    final: { plans: [], hasPlans: false },
  };
  const plansWithTimestamps: Record<Round, PlanFile[]> = {
    round1: [],
    round2: [],
    final: [],
  };

  for (const round of rounds) {
    const plans = await readPlansByRound(projectRoot, round);
    plansWithTimestamps[round] = plans;
    roundStatuses[round] = {
      plans: plans.map((p) => ({ round: p.round, cliTool: p.cliTool, modelName: p.modelName, filename: p.filename })),
      hasPlans: plans.length > 0,
    };
  }

  let openQuestionCount = 0;
  let conflictCount = 0;

  try {
    const round1Plans = await readPlansByRound(projectRoot, "round1");
    if (round1Plans.length > 0) {
      const conflicts = detectConflicts(round1Plans);
      conflictCount = conflicts.length;
      const questions = trackQuestions(round1Plans);
      openQuestionCount = questions.filter((q) => !q.answered).length;
    }
  } catch {
    // Conflict/question detection failed — not critical
  }

  const status: SessionStatus = {
    projectName: config.projectName,
    sessionStarted: config.createdAt,
    rounds: roundStatuses,
    openQuestionCount,
    conflictCount,
  };

  const formatted = await formatStatus(status, plansWithTimestamps);

  return { status, formatted };
}

/**
 * Format the session status as a human-readable string matching the spec.
 */
async function formatStatus(
  status: SessionStatus,
  plansWithTimestamps: Record<Round, PlanFile[]>
): Promise<string> {
  const lines: string[] = [];

  lines.push(`📁 Project: ${status.projectName}`);
  lines.push(`Session started: ${new Date(status.sessionStarted).toLocaleString()}`);
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");

  // Round 1
  lines.push("ROUND 1 — Individual Plans");
  if (status.rounds.round1.plans.length === 0) {
    lines.push("  ✗ not started");
  } else {
    for (const plan of plansWithTimestamps.round1) {
      lines.push(`  ✓ ${plan.cliTool}-${plan.modelName}  ${timeAgo(plan.timestamp)}`);
    }
  }
  lines.push("");

  // Round 2
  lines.push("ROUND 2 — Peer Review Plans");
  if (status.rounds.round2.plans.length === 0) {
    lines.push("  ✗ not started");
  } else {
    for (const plan of plansWithTimestamps.round2) {
      lines.push(`  ✓ ${plan.cliTool}-${plan.modelName}  ${timeAgo(plan.timestamp)}`);
    }
  }
  lines.push("");

  // Final
  lines.push("FINAL — Synthesis");
  if (status.rounds.final.plans.length === 0) {
    lines.push("  ✗ not started");
  } else {
    for (const plan of plansWithTimestamps.final) {
      lines.push(`  ✓ ${plan.cliTool}-${plan.modelName}  ${timeAgo(plan.timestamp)}`);
    }
  }
  lines.push("");

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (status.openQuestionCount > 0) {
    lines.push(`⚠  ${status.openQuestionCount} open question(s) detected across Round 1 plans`);
  }
  if (status.conflictCount > 0) {
    lines.push(`⚠  ${status.conflictCount} conflict(s) detected across Round 1 plans`);
  }

  if (!status.rounds.round1.hasPlans) {
    lines.push("ℹ  Run /polyplan round1 in CLI tools to start planning");
  } else if (!status.rounds.round2.hasPlans) {
    lines.push("ℹ  When satisfied with Round 1, run /polyplan round2 to begin peer review");
  } else if (!status.rounds.final.hasPlans) {
    lines.push("ℹ  When satisfied with Round 2, run /polyplan final to synthesize");
  } else {
    lines.push("✅ All rounds complete! Check your final plan in .plans/");
  }

  return lines.join("\n");
}

/**
 * Execute the status tool (with history logging).
 */
export async function executeStatus(
  projectRoot: string,
  cliTool: string,
  modelName: string
): Promise<string> {
  const result = await getStatus(projectRoot);

  await logAction(projectRoot, cliTool, modelName, "status", "Viewed session status");

  return result.formatted;
}
