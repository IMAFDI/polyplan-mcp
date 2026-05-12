/**
 * PolyPlan MCP — Conflict Engine
 *
 * Detects conflicts across Round 1 plans using keyword clustering
 * and text analysis. No LLM calls — pure text analysis.
 *
 * Detects:
 * - Technology conflicts (databases, frameworks, libraries)
 * - Approach conflicts (REST vs GraphQL, monolith vs microservices)
 * - Assumption conflicts (different assumptions about requirements)
 */

import type { PlanFile, Conflict } from "../types.js";

interface TechCategory {
  name: string;
  keywords: string[][];
}

const TECH_CATEGORIES: TechCategory[] = [
  {
    name: "Database Choice",
    keywords: [
      ["postgresql", "postgres", "pg"],
      ["mongodb", "mongo"],
      ["mysql", "mariadb"],
      ["sqlite"],
      ["redis"],
      ["dynamodb", "dynamo"],
      ["cassandra"],
      ["cockroachdb", "cockroach"],
      ["supabase"],
      ["firebase", "firestore"],
    ],
  },
  {
    name: "Auth Strategy",
    keywords: [
      ["jwt", "json web token", "stateless auth"],
      ["session", "session-based", "stateful auth", "cookie-based"],
      ["oauth", "oauth2"],
      ["api key", "api-key"],
      ["passkey", "webauthn"],
    ],
  },
  {
    name: "API Style",
    keywords: [
      ["rest", "restful", "rest api"],
      ["graphql", "graph ql"],
      ["grpc", "g-rpc"],
      ["trpc", "t-rpc"],
      ["websocket", "ws://", "socket.io"],
    ],
  },
  {
    name: "Architecture",
    keywords: [
      ["monolith", "monolithic"],
      ["microservice", "micro-service", "microservices"],
      ["serverless", "lambda", "cloud function"],
      ["event-driven", "event driven", "event sourcing"],
    ],
  },
  {
    name: "Frontend Framework",
    keywords: [
      ["react", "reactjs", "react.js"],
      ["vue", "vuejs", "vue.js"],
      ["angular", "angularjs"],
      ["svelte", "sveltekit"],
      ["next", "nextjs", "next.js"],
      ["nuxt", "nuxtjs", "nuxt.js"],
      ["astro"],
      ["solid", "solidjs"],
    ],
  },
  {
    name: "Backend Framework",
    keywords: [
      ["express", "expressjs"],
      ["fastify"],
      ["nestjs", "nest.js"],
      ["hono"],
      ["koa"],
      ["django"],
      ["flask"],
      ["fastapi"],
      ["spring", "spring boot"],
      ["rails", "ruby on rails"],
    ],
  },
  {
    name: "Language Choice",
    keywords: [
      ["typescript", "ts"],
      ["javascript", "js"],
      ["python", "py"],
      ["go", "golang"],
      ["rust"],
      ["java"],
      ["c#", "csharp", "dotnet", ".net"],
      ["ruby"],
    ],
  },
  {
    name: "Hosting/Deployment",
    keywords: [
      ["docker", "container"],
      ["kubernetes", "k8s"],
      ["vercel"],
      ["netlify"],
      ["aws", "amazon web services"],
      ["gcp", "google cloud"],
      ["azure"],
      ["heroku"],
      ["fly.io", "flyio"],
      ["railway"],
    ],
  },
  {
    name: "Testing Strategy",
    keywords: [
      ["jest"],
      ["vitest"],
      ["mocha"],
      ["playwright"],
      ["cypress"],
      ["testing library", "react testing library"],
      ["pytest"],
    ],
  },
];

/**
 * Detect which keyword groups are mentioned in the plan content.
 * Returns a map of category → matched group labels.
 */
function detectMentions(
  content: string,
  categories: TechCategory[]
): Map<string, string[]> {
  const lowerContent = content.toLowerCase();
  const result = new Map<string, string[]>();

  for (const category of categories) {
    const matches: string[] = [];
    for (const group of category.keywords) {
      // Use the first keyword as the label for the group
      const label = group[0];
      const found = group.some((keyword) => {
        // Word boundary matching to avoid false positives
        const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "i");
        return regex.test(lowerContent);
      });
      if (found) {
        matches.push(label);
      }
    }
    if (matches.length > 0) {
      result.set(category.name, matches);
    }
  }

  return result;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Detect conflicts across plans.
 * A conflict exists when different models recommend different technologies
 * or approaches for the same category.
 */
export function detectConflicts(plans: PlanFile[]): Conflict[] {
  if (plans.length < 2) return [];

  const conflicts: Conflict[] = [];

  // Collect mentions per plan
  const planMentions = plans.map((plan) => ({
    identifier: `${plan.cliTool}-${plan.modelName}`,
    mentions: detectMentions(plan.content, TECH_CATEGORIES),
  }));

  // Check each category for disagreement
  for (const category of TECH_CATEGORIES) {
    const positions: Record<string, string> = {};
    const allChoices = new Set<string>();

    for (const pm of planMentions) {
      const mentions = pm.mentions.get(category.name);
      if (mentions && mentions.length > 0) {
        const choice = mentions.join(" + ");
        positions[pm.identifier] = choice;
        allChoices.add(choice);
      }
    }

    // Conflict only if 2+ models mentioned this category AND they disagree
    const modelsThatMentioned = Object.keys(positions);
    if (modelsThatMentioned.length >= 2 && allChoices.size >= 2) {
      // Count votes per choice
      const voteCounts = new Map<string, number>();
      for (const choice of Object.values(positions)) {
        voteCounts.set(choice, (voteCounts.get(choice) ?? 0) + 1);
      }

      // Build summary
      const sortedChoices = [...voteCounts.entries()].sort((a, b) => b[1] - a[1]);
      const summary = sortedChoices
        .map(([choice, count]) => `${count} model(s) prefer ${choice}`)
        .join(", ");

      conflicts.push({
        category: category.name,
        positions,
        summary,
      });
    }
  }

  return conflicts;
}

/**
 * Format conflicts as a human-readable string.
 */
export function formatConflicts(conflicts: Conflict[], round: string): string {
  if (conflicts.length === 0) {
    return `✅ No conflicts detected across ${round} plans. All models are in agreement on technology choices.`;
  }

  const lines: string[] = [];
  lines.push(`CONFLICTS DETECTED — ${round}`);
  lines.push("");

  conflicts.forEach((conflict, index) => {
    lines.push(`[CONFLICT ${index + 1}] ${conflict.category}`);
    for (const [model, position] of Object.entries(conflict.positions)) {
      lines.push(`  ${model.padEnd(28)} ${position}`);
    }
    lines.push(`  → ${conflict.summary}`);
    lines.push("");
  });

  lines.push("These conflicts will be surfaced to the Final round model for resolution.");

  return lines.join("\n");
}
