/**
 * PolyPlan MCP — Config Manager
 *
 * Handles reading/writing .polyplan/config.json.
 * Extracted as a standalone module to keep config I/O separate from session logic.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { POLYPLAN_DIR, CONFIG_FILE, type PolyPlanConfig } from "../types.js";

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
