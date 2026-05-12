/**
 * PolyPlan MCP — Agree Tool
 *
 * Shows what ALL models agreed on in Round 1 without seeing each other.
 * These are the highest-confidence decisions since they emerged independently.
 */

import type { CallerIdentity } from "../types.js";
import { readPlansByRound } from "../core/plansManager.js";
import { logAction } from "../core/historyLogger.js";

/** Technology categories to check for agreement (mirrors conflictEngine) */
const AGREEMENT_CATEGORIES = [
  {
    name: "Database",
    keywords: [
      { label: "PostgreSQL", terms: ["postgresql", "postgres", "pg"] },
      { label: "MongoDB", terms: ["mongodb", "mongo"] },
      { label: "MySQL", terms: ["mysql", "mariadb"] },
      { label: "SQLite", terms: ["sqlite"] },
      { label: "Redis", terms: ["redis"] },
    ],
  },
  {
    name: "Auth Strategy",
    keywords: [
      { label: "JWT", terms: ["jwt", "json web token"] },
      { label: "Session-based", terms: ["session-based", "session based", "stateful auth"] },
      { label: "OAuth", terms: ["oauth", "oauth2"] },
    ],
  },
  {
    name: "API Style",
    keywords: [
      { label: "REST", terms: ["rest", "restful"] },
      { label: "GraphQL", terms: ["graphql"] },
      { label: "gRPC", terms: ["grpc"] },
      { label: "tRPC", terms: ["trpc"] },
    ],
  },
  {
    name: "Architecture",
    keywords: [
      { label: "Monolith", terms: ["monolith", "monolithic"] },
      { label: "Microservices", terms: ["microservice", "microservices"] },
      { label: "Serverless", terms: ["serverless", "lambda"] },
    ],
  },
  {
    name: "Language",
    keywords: [
      { label: "TypeScript", terms: ["typescript"] },
      { label: "JavaScript", terms: ["javascript"] },
      { label: "Python", terms: ["python"] },
      { label: "Go", terms: ["golang", "\\bgo\\b"] },
      { label: "Rust", terms: ["rust"] },
    ],
  },
];

/**
 * Execute the agree tool.
 */
export async function executeAgree(
  projectRoot: string,
  identity: CallerIdentity
): Promise<string> {
  const round1Plans = await readPlansByRound(projectRoot, "round1");

  if (round1Plans.length < 2) {
    return `Need at least 2 Round 1 plans to find agreements. Currently have ${round1Plans.length}.`;
  }

  const agreements: Array<{ category: string; choice: string; models: string[] }> = [];

  for (const category of AGREEMENT_CATEGORIES) {
    // For each keyword group, check if ALL plans mention the same choice
    const planChoices: Array<{ model: string; choices: string[] }> = [];

    for (const plan of round1Plans) {
      const lowerContent = plan.content.toLowerCase();
      const modelId = `${plan.cliTool}-${plan.modelName}`;
      const foundChoices: string[] = [];

      for (const kw of category.keywords) {
        const found = kw.terms.some((term) => {
          const regex = new RegExp(`\\b${term}\\b`, "i");
          return regex.test(lowerContent);
        });
        if (found) {
          foundChoices.push(kw.label);
        }
      }

      if (foundChoices.length > 0) {
        planChoices.push({ model: modelId, choices: foundChoices });
      }
    }

    // Check if all models that mentioned this category agree
    if (planChoices.length >= 2) {
      // Find choices common to ALL plans that mentioned the category
      const choiceSets = planChoices.map((pc) => new Set(pc.choices));
      const commonChoices = [...choiceSets[0]].filter((choice) =>
        choiceSets.every((set) => set.has(choice))
      );

      // Only count if ALL plans agree on at least one choice
      if (commonChoices.length > 0 && planChoices.length === round1Plans.length) {
        agreements.push({
          category: category.name,
          choice: commonChoices.join(", "),
          models: planChoices.map((pc) => pc.model),
        });
      }
    }
  }

  // Also look for common section headings
  const headingSets = round1Plans.map((plan) => {
    return new Set(
      plan.content
        .split("\n")
        .filter((line) => /^#{1,3}\s/.test(line))
        .map((line) => line.replace(/^#+\s*/, "").trim().toLowerCase())
    );
  });

  const commonHeadings =
    headingSets.length > 0
      ? [...headingSets[0]].filter((heading) =>
          headingSets.every((set) => set.has(heading))
        )
      : [];

  // Format output
  const lines: string[] = [];
  lines.push(`AGREEMENTS — Round 1 (${round1Plans.length} models)`);
  lines.push("These decisions emerged independently without models seeing each other.");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");

  if (agreements.length > 0) {
    lines.push("🤝 Technology Agreements:");
    for (const agreement of agreements) {
      lines.push(
        `  ✓ ${agreement.category}: ${agreement.choice} (all ${agreement.models.length} models agree)`
      );
    }
    lines.push("");
  } else {
    lines.push("⚠ No unanimous technology agreements found across all models.");
    lines.push("");
  }

  if (commonHeadings.length > 0) {
    lines.push("📋 Common Plan Sections (all models covered these topics):");
    for (const heading of commonHeadings.slice(0, 10)) {
      lines.push(`  • ${heading}`);
    }
    lines.push("");
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(
    "💡 Agreements are high-confidence decisions — strongly consider keeping them in the Final plan."
  );

  await logAction(
    projectRoot,
    identity.cliTool,
    identity.modelName,
    "agree",
    `Found ${agreements.length} agreements across ${round1Plans.length} models`
  );

  return lines.join("\n");
}
