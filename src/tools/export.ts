/**
 * PolyPlan MCP — Export Tool
 *
 * Bundles the entire .plans/ session into one readable markdown file.
 */

import type { CallerIdentity } from "../types.js";
import { readConfig } from "../core/session.js";
import { readAllPlans } from "../core/plansManager.js";
import { logAction } from "../core/historyLogger.js";

export async function executeExport(
  projectRoot: string,
  identity: CallerIdentity
): Promise<string> {
  const config = await readConfig(projectRoot);
  if (!config) return "Project not initialized. Run `polyplan-mcp init` first.";

  const allPlans = await readAllPlans(projectRoot);
  if (allPlans.length === 0) return "No plans to export.";

  const round1 = allPlans.filter((p) => p.round === "round1");
  const round2 = allPlans.filter((p) => p.round === "round2");
  const final = allPlans.filter((p) => p.round === "final");

  const lines: string[] = [];
  lines.push(`# PolyPlan Session Export — ${config.projectName}`);
  lines.push("", `**Exported:** ${new Date().toISOString()}`, `**Session started:** ${config.createdAt}`);
  if (config.problemDescription) lines.push(`**Problem:** ${config.problemDescription}`);
  lines.push(`**Total plans:** ${allPlans.length}`, "", "---", "");

  const renderGroup = (title: string, plans: typeof allPlans) => {
    if (plans.length === 0) return;
    lines.push(`## ${title}`, "");
    for (const plan of plans) {
      lines.push(`### ${plan.cliTool}-${plan.modelName}`, `*File: ${plan.filename}*`, "", plan.content, "", "---", "");
    }
  };

  renderGroup("Round 1 — Individual Plans", round1);
  renderGroup("Round 2 — Peer Review Plans", round2);
  renderGroup("Final — Synthesis", final);

  await logAction(projectRoot, identity.cliTool, identity.modelName, "export", `Exported ${allPlans.length} plans`);
  return lines.join("\n");
}
