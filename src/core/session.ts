/**
 * PolyPlan MCP — Session Manager
 *
 * Manages project session state via .polyplan/config.json.
 * Handles project initialization and config read/write.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { POLYPLAN_DIR, CONFIG_FILE, PLANS_DIR, type PolyPlanConfig } from "../types.js";

/**
 * Ensure the .polyplan/ directory exists.
 */
export async function ensurePolyPlanDir(projectRoot: string): Promise<string> {
  const polyplanPath = path.join(projectRoot, POLYPLAN_DIR);
  await fs.mkdir(polyplanPath, { recursive: true });
  return polyplanPath;
}

/**
 * Read the project config from .polyplan/config.json.
 * Returns null if config doesn't exist.
 */
export async function readConfig(projectRoot: string): Promise<PolyPlanConfig | null> {
  const configPath = path.join(projectRoot, CONFIG_FILE);

  try {
    const raw = await fs.readFile(configPath, "utf-8");
    return JSON.parse(raw) as PolyPlanConfig;
  } catch {
    return null;
  }
}

/**
 * Write the project config to .polyplan/config.json.
 */
export async function writeConfig(
  projectRoot: string,
  config: PolyPlanConfig
): Promise<void> {
  await ensurePolyPlanDir(projectRoot);
  const configPath = path.join(projectRoot, CONFIG_FILE);
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Update specific fields in the project config.
 * Creates config if it doesn't exist.
 */
export async function updateConfig(
  projectRoot: string,
  updates: Partial<PolyPlanConfig>
): Promise<PolyPlanConfig> {
  const existing = await readConfig(projectRoot);

  const config: PolyPlanConfig = {
    projectName: existing?.projectName ?? path.basename(projectRoot),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    ...existing,
    ...updates,
  };

  await writeConfig(projectRoot, config);
  return config;
}

/**
 * Initialize a new PolyPlan project.
 * Creates .plans/ and .polyplan/config.json directories and files.
 * Also appends entries to .gitignore if they aren't already there.
 */
export async function initProject(projectRoot: string): Promise<PolyPlanConfig> {
  // Create directories
  const plansPath = path.join(projectRoot, PLANS_DIR);
  await fs.mkdir(plansPath, { recursive: true });
  await ensurePolyPlanDir(projectRoot);

  // Create config
  const projectName = path.basename(projectRoot);
  const config: PolyPlanConfig = {
    projectName,
    createdAt: new Date().toISOString(),
  };
  await writeConfig(projectRoot, config);

  // Update .gitignore
  await updateGitignore(projectRoot);

  return config;
}

/**
 * Check if a project has been initialized with PolyPlan.
 */
export async function isInitialized(projectRoot: string): Promise<boolean> {
  const config = await readConfig(projectRoot);
  return config !== null;
}

/**
 * Append .plans/ and .polyplan/ to .gitignore if not already present.
 */
async function updateGitignore(projectRoot: string): Promise<void> {
  const gitignorePath = path.join(projectRoot, ".gitignore");
  let content = "";

  try {
    content = await fs.readFile(gitignorePath, "utf-8");
  } catch {
    // .gitignore doesn't exist, that's fine
  }

  const lines = content.split("\n");
  const additions: string[] = [];

  if (!lines.some((line) => line.trim() === ".plans/")) {
    additions.push(".plans/");
  }
  if (!lines.some((line) => line.trim() === ".polyplan/")) {
    additions.push(".polyplan/");
  }

  if (additions.length > 0) {
    const newContent = content.trimEnd() + "\n" + additions.join("\n") + "\n";
    await fs.writeFile(gitignorePath, newContent, "utf-8");
  }
}
