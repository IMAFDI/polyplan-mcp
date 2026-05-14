/**
 * PolyPlan MCP — Prompt & Resource Registration
 *
 * Exposes PolyPlan workflows as MCP-native prompts and resources.
 * CLI tools that support MCP will discover these automatically
 * without any filesystem wrapper files.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { PLANS_DIR, POLYPLAN_DIR, type PlanFileInfo, PLAN_FILENAME_REGEX, type Round } from "../types.js";

// ─── Prompt Definitions ──────────────────────────────────────────────────────

const MODEL_NAME_NOTE =
  "Pass modelName when the active model name is known. If it is not exposed by the client, omit it and let PolyPlan save the plan with modelName='unknown'.";

interface PromptDef {
  name: string;
  title: string;
  description: string;
  hasArgs: boolean;
  prompt: (args: string) => string;
}

const PROMPTS: PromptDef[] = [
  {
    name: "round_1",
    title: "PolyPlan Round 1",
    description: "Create and save an independent Round 1 plan.",
    hasArgs: true,
    prompt: (args) => `Start PolyPlan Round 1 for this problem: ${args}

Use the PolyPlan MCP tools, not shell commands.

Steps:
1. Call round_1_context with problemDescription set to the user's arguments.
2. Use the returned context to create an independent implementation plan.
3. Call round_1 with problemDescription, the generated plan, and modelName if known.

${MODEL_NAME_NOTE}`,
  },
  {
    name: "round_2",
    title: "PolyPlan Round 2",
    description: "Create and save a peer-review Round 2 plan.",
    hasArgs: true,
    prompt: (args) => `Start PolyPlan Round 2. Optional user focus: ${args}

Use the PolyPlan MCP tools, not shell commands.

Steps:
1. Call round_2_context with modelName if known.
2. Use the returned peer-review context to create a revised master plan.
3. Call round_2 with the generated plan and modelName if known.

${MODEL_NAME_NOTE}`,
  },
  {
    name: "final_plan",
    title: "PolyPlan Final Plan",
    description: "Create and save the final synthesized plan.",
    hasArgs: true,
    prompt: (args) => `Start PolyPlan final synthesis. Optional user focus: ${args}

Use the PolyPlan MCP tools, not shell commands.

Steps:
1. Call final_plan_context.
2. Use the returned context to synthesize one final implementable plan.
3. Call final_plan with the generated plan and modelName if known.

${MODEL_NAME_NOTE}`,
  },
  {
    name: "show_status",
    title: "PolyPlan Status",
    description: "Show PolyPlan session status — which models completed each round.",
    hasArgs: false,
    prompt: () => `Call the PolyPlan show_status MCP tool.`,
  },
  {
    name: "show_conflicts",
    title: "PolyPlan Conflicts",
    description: "Show detected Round 1 conflicts between models.",
    hasArgs: false,
    prompt: () => `Call the PolyPlan show_conflicts MCP tool.`,
  },
  {
    name: "show_questions",
    title: "PolyPlan Questions",
    description: "Show open questions raised by plans.",
    hasArgs: false,
    prompt: () => `Call the PolyPlan show_questions MCP tool.`,
  },
  {
    name: "show_diff",
    title: "PolyPlan Diff",
    description: "Show what changed for one model between rounds.",
    hasArgs: true,
    prompt: (args) => `Call the PolyPlan show_diff MCP tool with model set to: ${args}`,
  },
  {
    name: "show_agree",
    title: "PolyPlan Agreement",
    description: "Show Round 1 points all models agreed on.",
    hasArgs: false,
    prompt: () => `Call the PolyPlan show_agree MCP tool.`,
  },
  {
    name: "show_summary",
    title: "PolyPlan Summary",
    description: "Summarize existing plans for a given round.",
    hasArgs: true,
    prompt: (args) => `Call the PolyPlan show_summary MCP tool. If the user supplied one of round1, round2, or final, pass it as the round argument. User arguments: ${args}`,
  },
  {
    name: "export_plans",
    title: "PolyPlan Export",
    description: "Export the current PolyPlan session as markdown.",
    hasArgs: false,
    prompt: () => `Call the PolyPlan export_plans MCP tool.`,
  },
  {
    name: "show_history",
    title: "PolyPlan History",
    description: "Show the PolyPlan audit log.",
    hasArgs: false,
    prompt: () => `Call the PolyPlan show_history MCP tool.`,
  },
];

function promptResult(description: string, text: string) {
  return {
    description,
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text,
        },
      },
    ],
  };
}

/**
 * Register MCP prompts for all PolyPlan workflows.
 * CLI tools that support MCP prompts will surface these automatically.
 */
export function registerPolyPlanPrompts(server: McpServer): void {
  for (const def of PROMPTS) {
    server.registerPrompt(
      def.name,
      {
        title: def.title,
        description: def.description,
        argsSchema: def.hasArgs
          ? {
              arguments: z
                .string()
                .optional()
                .describe("Optional command arguments"),
            }
          : {},
      },
      (incoming) => {
        const args = (incoming as Record<string, string | undefined>).arguments?.trim() || "(none)";
        return promptResult(def.description, def.prompt(args));
      }
    );
  }
}

// ─── Resource Helpers ────────────────────────────────────────────────────────

async function listPlanFiles(projectRoot: string): Promise<PlanFileInfo[]> {
  const plansPath = path.join(projectRoot, PLANS_DIR);
  try {
    const files = await fs.readdir(plansPath);
    return files
      .map((f) => {
        const m = f.match(PLAN_FILENAME_REGEX);
        if (!m) return null;
        return { round: m[1] as Round, cliTool: m[2], modelName: m[3], filename: f };
      })
      .filter((x): x is PlanFileInfo => x !== null);
  } catch {
    return [];
  }
}

async function readConfigJson(projectRoot: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(path.join(projectRoot, POLYPLAN_DIR, "config.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Register MCP resources for session state, plans, and workflows.
 * CLI tools that support MCP resources will surface these automatically.
 */
export function registerPolyPlanResources(server: McpServer, projectRoot?: string): void {
  // polyplan://status — current session state
  server.registerResource(
    "polyplan_status",
    "polyplan://status",
    {
      title: "PolyPlan Session Status",
      description: "Current session state: project name, rounds completed, plan counts.",
      mimeType: "text/markdown",
    },
    async (uri) => {
      const root = projectRoot || process.cwd();
      const config = await readConfigJson(root);
      const plans = await listPlanFiles(root);

      const round1 = plans.filter((p) => p.round === "round1");
      const round2 = plans.filter((p) => p.round === "round2");
      const final = plans.filter((p) => p.round === "final");

      const text = [
        `# PolyPlan Session Status`,
        ``,
        `**Project:** ${config?.projectName ?? "unknown"}`,
        `**Created:** ${config?.createdAt ?? "unknown"}`,
        ``,
        `## Rounds`,
        `| Round | Plans |`,
        `|-------|-------|`,
        `| Round 1 | ${round1.length} plan(s): ${round1.map((p) => `${p.cliTool}-${p.modelName}`).join(", ") || "none"} |`,
        `| Round 2 | ${round2.length} plan(s): ${round2.map((p) => `${p.cliTool}-${p.modelName}`).join(", ") || "none"} |`,
        `| Final   | ${final.length} plan(s): ${final.map((p) => `${p.cliTool}-${p.modelName}`).join(", ") || "none"} |`,
        ``,
      ].join("\n");

      return { contents: [{ uri: uri.href, mimeType: "text/markdown", text }] };
    }
  );

  // polyplan://plans — list of all plans
  server.registerResource(
    "polyplan_plans",
    "polyplan://plans",
    {
      title: "PolyPlan Plans",
      description: "List of all plan files in .plans/ with round, CLI tool, and model info.",
      mimeType: "text/markdown",
    },
    async (uri) => {
      const root = projectRoot || process.cwd();
      const plans = await listPlanFiles(root);

      if (plans.length === 0) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "text/markdown",
            text: "# PolyPlan Plans\n\nNo plans found. Run `round_1` to create your first plan.\n",
          }],
        };
      }

      const lines = [
        "# PolyPlan Plans",
        "",
        "| Filename | Round | CLI Tool | Model |",
        "|----------|-------|----------|-------|",
        ...plans.map(
          (p) => `| ${p.filename} | ${p.round} | ${p.cliTool} | ${p.modelName} |`
        ),
        "",
      ];

      return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: lines.join("\n") }] };
    }
  );

  // polyplan://workflows — available workflows and descriptions
  server.registerResource(
    "polyplan_workflows",
    "polyplan://workflows",
    {
      title: "PolyPlan Workflows",
      description: "Available PolyPlan MCP tools and workflows with descriptions.",
      mimeType: "text/markdown",
    },
    async (uri) => {
      const text = [
        "# PolyPlan Workflows",
        "",
        "## Planning Rounds",
        "- **round_1** / **round_1_context** — Create an independent Round 1 plan",
        "- **round_2** / **round_2_context** — Peer-review all Round 1 plans and write a revised plan",
        "- **final_plan** / **final_plan_context** — Synthesize all plans into one implementable plan",
        "",
        "## Status & Analysis",
        "- **show_status** — Session state: which models completed each round",
        "- **show_conflicts** — Points where models disagreed in Round 1",
        "- **show_questions** — Open questions raised by any model",
        "- **show_agree** — Points all models agreed on independently",
        "- **show_diff** — What changed for a model between rounds",
        "- **show_summary** — One-paragraph summary of each model's plan",
        "",
        "## Management",
        "- **clear_plans** / **clear_round_1** / **clear_round_2** — Delete plan files",
        "- **export_plans** — Bundle session into one markdown file",
        "- **show_history** — Full audit log",
        "- **init** — Initialize PolyPlan in a project",
        "",
      ].join("\n");

      return { contents: [{ uri: uri.href, mimeType: "text/markdown", text }] };
    }
  );
}
