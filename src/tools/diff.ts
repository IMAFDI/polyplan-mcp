/**
 * PolyPlan MCP — Diff Tool
 *
 * Shows what changed for a specific model between Round 1 and Round 2.
 * Useful for understanding how peer review influenced each model's thinking.
 */

import type { CallerIdentity } from "../types.js";
import { readPlansByRound } from "../core/plansManager.js";
import { logAction } from "../core/historyLogger.js";

/**
 * Execute the diff tool.
 * Takes a model identifier like "copilot-sonnet4.6" and shows differences.
 */
export async function executeDiff(
  projectRoot: string,
  identity: CallerIdentity,
  model: string
): Promise<string> {
  const round1Plans = await readPlansByRound(projectRoot, "round1");
  const round2Plans = await readPlansByRound(projectRoot, "round2");

  // Find matching plans for the requested model
  const round1Match = round1Plans.find(
    (p) => `${p.cliTool}-${p.modelName}` === model
  );
  const round2Match = round2Plans.find(
    (p) => `${p.cliTool}-${p.modelName}` === model
  );

  if (!round1Match && !round2Match) {
    const availableModels = [
      ...new Set([
        ...round1Plans.map((p) => `${p.cliTool}-${p.modelName}`),
        ...round2Plans.map((p) => `${p.cliTool}-${p.modelName}`),
      ]),
    ];
    return `No plans found for model "${model}".\n\nAvailable models:\n${availableModels.map((m) => `  • ${m}`).join("\n")}`;
  }

  if (!round1Match) {
    return `No Round 1 plan found for "${model}". Only a Round 2 plan exists.`;
  }

  if (!round2Match) {
    return `No Round 2 plan found for "${model}". Only a Round 1 plan exists — this model hasn't completed peer review yet.`;
  }

  // Generate a textual diff summary
  const diff = generateTextualDiff(
    model,
    round1Match.content,
    round2Match.content
  );

  await logAction(
    projectRoot,
    identity.cliTool,
    identity.modelName,
    "diff",
    `Viewed diff for ${model}`
  );

  return diff;
}

/**
 * Generate a human-readable textual diff between Round 1 and Round 2 content.
 * Not a line-by-line diff — instead, compares section headings and content length.
 */
function generateTextualDiff(
  model: string,
  round1Content: string,
  round2Content: string
): string {
  const lines: string[] = [];

  lines.push(`DIFF — ${model}`);
  lines.push(`Round 1 → Round 2`);
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");

  // Compare basic metrics
  const r1Lines = round1Content.split("\n").length;
  const r2Lines = round2Content.split("\n").length;
  const r1Words = round1Content.split(/\s+/).length;
  const r2Words = round2Content.split(/\s+/).length;

  lines.push(`📏 Size Change:`);
  lines.push(`   Round 1: ${r1Lines} lines, ${r1Words} words`);
  lines.push(`   Round 2: ${r2Lines} lines, ${r2Words} words`);
  lines.push(`   Change: ${r2Lines - r1Lines > 0 ? "+" : ""}${r2Lines - r1Lines} lines, ${r2Words - r1Words > 0 ? "+" : ""}${r2Words - r1Words} words`);
  lines.push("");

  // Extract and compare section headings
  const r1Headings = extractHeadings(round1Content);
  const r2Headings = extractHeadings(round2Content);

  const newHeadings = r2Headings.filter((h) => !r1Headings.includes(h));
  const removedHeadings = r1Headings.filter((h) => !r2Headings.includes(h));
  const keptHeadings = r1Headings.filter((h) => r2Headings.includes(h));

  if (newHeadings.length > 0) {
    lines.push(`➕ New Sections in Round 2:`);
    for (const h of newHeadings) {
      lines.push(`   + ${h}`);
    }
    lines.push("");
  }

  if (removedHeadings.length > 0) {
    lines.push(`➖ Removed Sections from Round 1:`);
    for (const h of removedHeadings) {
      lines.push(`   - ${h}`);
    }
    lines.push("");
  }

  if (keptHeadings.length > 0) {
    lines.push(`📋 Unchanged Section Headings:`);
    for (const h of keptHeadings) {
      lines.push(`   = ${h}`);
    }
    lines.push("");
  }

  // Look for "changes from round 1" section in Round 2
  const changeSection = findChangeNotes(round2Content);
  if (changeSection) {
    lines.push(`📝 Model's Own Change Notes:`);
    lines.push(changeSection);
    lines.push("");
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("💡 Tip: Read the full Round 2 plan for detailed changes.");

  return lines.join("\n");
}

/**
 * Extract markdown headings from content.
 */
function extractHeadings(content: string): string[] {
  return content
    .split("\n")
    .filter((line) => /^#{1,4}\s/.test(line))
    .map((line) => line.replace(/^#+\s*/, "").trim());
}

/**
 * Look for a section where the model describes what it changed from Round 1.
 */
function findChangeNotes(content: string): string | null {
  const lowerContent = content.toLowerCase();
  const markers = [
    "changed from round 1",
    "changes from round 1",
    "what i changed",
    "what changed",
    "key changes",
    "revisions",
    "differences from",
  ];

  for (const marker of markers) {
    const idx = lowerContent.indexOf(marker);
    if (idx !== -1) {
      // Extract from marker to next heading or end (max 500 chars)
      const fromMarker = content.substring(idx);
      const nextHeading = fromMarker.indexOf("\n#", 10);
      const section = nextHeading !== -1
        ? fromMarker.substring(0, nextHeading)
        : fromMarker.substring(0, 500);
      return section.trim();
    }
  }

  return null;
}
