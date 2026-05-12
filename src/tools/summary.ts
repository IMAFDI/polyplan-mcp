/**
 * PolyPlan MCP — Summary Tool
 *
 * One-paragraph summary of each model's plan.
 * Quick overview before moving to the next round.
 */

import type { CallerIdentity, Round } from "../types.js";
import { readPlansByRound } from "../core/plansManager.js";
import { logAction } from "../core/historyLogger.js";

/**
 * Extract a brief summary from plan content.
 * Takes the first meaningful paragraph (non-heading, non-empty).
 */
function extractSummary(content: string, maxLength: number = 300): string {
  const lines = content.split("\n");
  const paragraphs: string[] = [];
  let currentParagraph: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip headings and empty lines to find content paragraphs
    if (trimmed.startsWith("#") || trimmed === "") {
      if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph.join(" "));
        currentParagraph = [];
      }
      continue;
    }

    // Skip very short lines (likely list markers or metadata)
    if (trimmed.length < 10 && !trimmed.endsWith(".")) continue;

    currentParagraph.push(trimmed);
  }

  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph.join(" "));
  }

  // Find the first substantial paragraph
  const substantial = paragraphs.find((p) => p.length > 50);
  const summary = substantial ?? paragraphs[0] ?? "No summary available.";

  return summary.length > maxLength
    ? summary.substring(0, maxLength) + "..."
    : summary;
}

/**
 * Extract key sections/topics from the plan.
 */
function extractTopics(content: string): string[] {
  return content
    .split("\n")
    .filter((line) => /^#{1,3}\s/.test(line))
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .slice(0, 6); // Max 6 topics
}

/**
 * Execute the summary tool.
 */
export async function executeSummary(
  projectRoot: string,
  identity: CallerIdentity,
  round?: Round
): Promise<string> {
  // Default to the latest round that has plans
  const targetRound = round ?? (await findLatestRound(projectRoot));

  const plans = await readPlansByRound(projectRoot, targetRound);

  if (plans.length === 0) {
    return `No plans found for ${targetRound}. Run /polyplan ${targetRound} first.`;
  }

  const lines: string[] = [];
  lines.push(`SUMMARY — ${targetRound.toUpperCase()} (${plans.length} plans)`);
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");

  for (const plan of plans) {
    const modelId = `${plan.cliTool}-${plan.modelName}`;
    const summary = extractSummary(plan.content);
    const topics = extractTopics(plan.content);
    const wordCount = plan.content.split(/\s+/).length;

    lines.push(`📄 ${modelId} (${wordCount} words)`);
    if (topics.length > 0) {
      lines.push(`   Sections: ${topics.join(" → ")}`);
    }
    lines.push(`   Summary: ${summary}`);
    lines.push("");
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("💡 Read full plans in .plans/ for complete details.");

  await logAction(
    projectRoot,
    identity.cliTool,
    identity.modelName,
    "summary",
    `Viewed summary for ${targetRound}: ${plans.length} plans`
  );

  return lines.join("\n");
}

/**
 * Find the latest round that has plans.
 */
async function findLatestRound(projectRoot: string): Promise<Round> {
  const finalPlans = await readPlansByRound(projectRoot, "final");
  if (finalPlans.length > 0) return "final";

  const round2Plans = await readPlansByRound(projectRoot, "round2");
  if (round2Plans.length > 0) return "round2";

  return "round1";
}
