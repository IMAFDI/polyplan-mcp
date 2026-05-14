/**
 * PolyPlan MCP — Session Manager
 *
 * Manages project session state via .polyplan/config.json.
 * Handles project initialization.
 *
 * Init creates ONLY:
 *   .plans/                  — empty folder for plan files
 *   .polyplan/config.json    — session config
 *   .polyplan/WORKFLOWS.md   — human-readable usage guide
 *   .gitignore updates       — .plans/ and .polyplan/history.log
 *
 * Nothing else. No wrapper files. No compatibility folders.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { POLYPLAN_DIR, PLANS_DIR, type PolyPlanConfig } from "../types.js";
import { ensurePolyPlanDir, readConfig, writeConfig, updateConfig } from "./configManager.js";

// Re-export config functions for backward compat
export { ensurePolyPlanDir, readConfig, writeConfig, updateConfig } from "./configManager.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InitResult {
  config: PolyPlanConfig;
  wasAlreadyInitialized: boolean;
}

// ─── WORKFLOWS.md Content ────────────────────────────────────────────────────

const WORKFLOWS_CONTENT = `# PolyPlan — How To Use

PolyPlan is an MCP server. All workflows are exposed as MCP tools, prompts,
and resources. Every CLI tool that supports MCP can discover and use them
automatically — no wrapper files needed.

## Quick Start

1. Install globally: \`npm install -g polyplan-mcp\`
2. Initialize in your project: \`polyplan-mcp init\`
3. Open your favourite CLI tool and start planning.

## Available MCP Tools

### Planning Rounds
- **round_1** — Create an independent plan (call round_1_context first for the prompt)
- **round_2** — Peer-review all Round 1 plans and write a revised plan
- **final_plan** — Synthesize all plans into one implementable plan

### Status & Analysis
- **show_status** — Session state: which models completed each round
- **show_conflicts** — Points where models disagreed
- **show_questions** — Open questions raised by any model
- **show_agree** — Points all models agreed on
- **show_diff** — What changed for a model between rounds
- **show_summary** — One-paragraph summary of each model's plan

### Management
- **clear_plans** / **clear_round_1** / **clear_round_2** — Delete plan files
- **export_plans** — Bundle session into one markdown file
- **show_history** — Full audit log
- **init** — Initialize PolyPlan in a project

## Example Workflows

### Claude Code
\`\`\`
"Call the polyplan round_1 tool with problemDescription='your problem here'"
"Call the polyplan show_status tool"
"Call the polyplan round_2 tool"
"Call the polyplan final_plan tool"
\`\`\`

### Gemini CLI / Copilot / OpenCode / Cursor / Codex
\`\`\`
"Call the polyplan round_1 tool with: your problem"
"Call the polyplan show_status tool"
\`\`\`

## Plans Location
\`\`\`
.plans/round1-{cli}-{model}.md
.plans/round2-{cli}-{model}.md
.plans/final-{cli}-{model}.md
\`\`\`

## MCP Resources
- \`polyplan://status\` — Current session state
- \`polyplan://plans\` — List of all plans
- \`polyplan://workflows\` — Available workflows and descriptions
`;

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * Initialize PolyPlan in a project.
 *
 * Creates:
 *   .plans/
 *   .polyplan/config.json
 *   .polyplan/WORKFLOWS.md
 *   Updates .gitignore
 *
 * Nothing else. No client detection. No compatibility files.
 */
export async function initProject(projectRoot: string): Promise<InitResult> {
  const wasAlreadyInitialized = (await readConfig(projectRoot)) !== null;

  // Create .plans/ directory
  await fs.mkdir(path.join(projectRoot, PLANS_DIR), { recursive: true });

  // Create .polyplan/ directory
  await ensurePolyPlanDir(projectRoot);

  if (!wasAlreadyInitialized) {
    // First run: create config
    const projectName = path.basename(projectRoot);
    const config: PolyPlanConfig = {
      projectName,
      createdAt: new Date().toISOString(),
      contextProvider: "auto",
      maxContextTokens: 10000,
      includeFileTree: true,
    };
    await writeConfig(projectRoot, config);
  }

  // Always write/update WORKFLOWS.md
  await fs.writeFile(
    path.join(projectRoot, POLYPLAN_DIR, "WORKFLOWS.md"),
    WORKFLOWS_CONTENT,
    "utf-8"
  );

  // Always update .gitignore
  await updateGitignore(projectRoot);

  const config = (await readConfig(projectRoot))!;
  return { config, wasAlreadyInitialized };
}

/**
 * Check if a project has been initialized with PolyPlan.
 */
export async function isInitialized(projectRoot: string): Promise<boolean> {
  return (await readConfig(projectRoot)) !== null;
}

// ─── Gitignore ────────────────────────────────────────────────────────────────

async function updateGitignore(projectRoot: string): Promise<void> {
  const gitignorePath = path.join(projectRoot, ".gitignore");
  let content = "";

  try {
    content = await fs.readFile(gitignorePath, "utf-8");
  } catch { /* doesn't exist */ }

  const lines = content.split("\n");
  const additions: string[] = [];

  // Only two entries needed
  if (!lines.some((l) => l.trim() === ".plans/")) additions.push(".plans/");
  if (!lines.some((l) => l.trim() === ".polyplan/history.log")) additions.push(".polyplan/history.log");

  if (additions.length > 0) {
    await fs.writeFile(gitignorePath, content.trimEnd() + "\n" + additions.join("\n") + "\n", "utf-8");
  }
}
