/**
 * PolyPlan MCP — Plans Manager
 *
 * Handles all read/write/list operations on the .plans/ directory.
 * This is the single source of truth for all plan files.
 */

import fs from "node:fs/promises";
import path from "node:path";
import {
  PLANS_DIR,
  PLAN_FILENAME_REGEX,
  type PlanFile,
  type PlanFileInfo,
  type Round,
} from "../types.js";

/**
 * Ensure the .plans/ directory exists.
 */
export async function ensurePlansDir(projectRoot: string): Promise<string> {
  const plansPath = path.join(projectRoot, PLANS_DIR);
  await fs.mkdir(plansPath, { recursive: true });
  return plansPath;
}

/**
 * Build a plan filename from components.
 * Format: {round}-{cliTool}-{modelName}.md
 */
export function buildPlanFilename(
  round: Round,
  cliTool: string,
  modelName: string
): string {
  // CLI segment: strip to [a-z0-9] (no hyphens) so it can't span the
  // CLI↔model boundary. Model segment: preserve hyphens and dots
  // (e.g., sonnet-4.6, gpt-4o, claude-sonnet-4-5).
  const safeCli = cliTool.toLowerCase().replace(/[^a-z0-9]/g, "");
  const safeModel = modelName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9.-]/g, "");
  return `${round}-${safeCli}-${safeModel}.md`;
}

/**
 * Parse a plan filename into its components.
 * Returns null if the filename doesn't match the expected pattern.
 */
export function parsePlanFilename(filename: string): PlanFileInfo | null {
  const match = filename.match(PLAN_FILENAME_REGEX);
  if (!match) return null;

  return {
    round: match[1] as Round,
    cliTool: match[2],
    modelName: match[3],
    filename,
  };
}

/**
 * List all plan files in the .plans/ directory.
 */
export async function listPlans(projectRoot: string): Promise<PlanFileInfo[]> {
  const plansPath = path.join(projectRoot, PLANS_DIR);

  try {
    const files = await fs.readdir(plansPath);
    return files
      .map(parsePlanFilename)
      .filter((info): info is PlanFileInfo => info !== null);
  } catch {
    // Directory doesn't exist yet
    return [];
  }
}

/**
 * List plans filtered by round.
 */
export async function listPlansByRound(
  projectRoot: string,
  round: Round
): Promise<PlanFileInfo[]> {
  const all = await listPlans(projectRoot);
  return all.filter((p) => p.round === round);
}

/**
 * Read a single plan file and return its content.
 */
export async function readPlan(
  projectRoot: string,
  filename: string
): Promise<PlanFile | null> {
  const filePath = path.join(projectRoot, PLANS_DIR, filename);

  try {
    const content = await fs.readFile(filePath, "utf-8");
    const stat = await fs.stat(filePath);
    const info = parsePlanFilename(filename);
    if (!info) return null;

    return {
      ...info,
      content,
      timestamp: stat.mtime,
    };
  } catch {
    return null;
  }
}

/**
 * Read all plan files for a given round, with content.
 */
export async function readPlansByRound(
  projectRoot: string,
  round: Round
): Promise<PlanFile[]> {
  const infos = await listPlansByRound(projectRoot, round);
  const plans: PlanFile[] = [];

  for (const info of infos) {
    const plan = await readPlan(projectRoot, info.filename);
    if (plan) plans.push(plan);
  }

  return plans;
}

/**
 * Read all plan files across all rounds, with content.
 */
export async function readAllPlans(projectRoot: string): Promise<PlanFile[]> {
  const infos = await listPlans(projectRoot);
  const plans: PlanFile[] = [];

  for (const info of infos) {
    const plan = await readPlan(projectRoot, info.filename);
    if (plan) plans.push(plan);
  }

  return plans;
}

/**
 * Write a plan file to the .plans/ directory.
 */
export async function writePlan(
  projectRoot: string,
  round: Round,
  cliTool: string,
  modelName: string,
  content: string
): Promise<string> {
  const plansPath = await ensurePlansDir(projectRoot);
  const filename = buildPlanFilename(round, cliTool, modelName);
  const filePath = path.join(plansPath, filename);

  await fs.writeFile(filePath, content, "utf-8");
  return filename;
}

/**
 * Check if a plan file exists for a given round/cli/model combination.
 */
export async function planExists(
  projectRoot: string,
  round: Round,
  cliTool: string,
  modelName: string
): Promise<boolean> {
  const filename = buildPlanFilename(round, cliTool, modelName);
  const filePath = path.join(projectRoot, PLANS_DIR, filename);

  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find existing plans for a CLI tool in a given round (any model).
 * Used for model switch detection.
 */
export async function findPlansForCli(
  projectRoot: string,
  round: Round,
  cliTool: string
): Promise<PlanFileInfo[]> {
  const plans = await listPlansByRound(projectRoot, round);
  return plans.filter((p) => p.cliTool === cliTool);
}

/**
 * Delete a specific plan file.
 */
export async function deletePlan(
  projectRoot: string,
  filename: string
): Promise<boolean> {
  const filePath = path.join(projectRoot, PLANS_DIR, filename);

  try {
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear all plans for a given round.
 */
export async function clearRound(
  projectRoot: string,
  round: Round
): Promise<number> {
  const plans = await listPlansByRound(projectRoot, round);
  let deleted = 0;

  for (const plan of plans) {
    if (await deletePlan(projectRoot, plan.filename)) {
      deleted++;
    }
  }

  return deleted;
}

/**
 * Clear all plans across all rounds.
 */
export async function clearAllPlans(projectRoot: string): Promise<number> {
  const plans = await listPlans(projectRoot);
  let deleted = 0;

  for (const plan of plans) {
    if (await deletePlan(projectRoot, plan.filename)) {
      deleted++;
    }
  }

  return deleted;
}

/**
 * Get a human-readable time-ago string from a date.
 */
export function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
