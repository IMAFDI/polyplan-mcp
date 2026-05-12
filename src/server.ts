/**
 * PolyPlan MCP — Server Setup & Tool Registration
 *
 * Creates the MCP server instance and registers all tools.
 * Tool names use underscore_format so Claude Code exposes them as /slash commands.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { detectCaller } from "./core/modelDetector.js";
import { executeRound1, getRound1Context } from "./tools/round1.js";
import { executeRound2, getRound2Context } from "./tools/round2.js";
import { executeFinal, getFinalContext } from "./tools/final.js";
import { executeStatus } from "./tools/status.js";
import { executeClear } from "./tools/clear.js";
import { executeConflicts } from "./tools/conflicts.js";
import { executeQuestions } from "./tools/questions.js";
import { executeDiff } from "./tools/diff.js";
import { executeAgree } from "./tools/agree.js";
import { executeSummary } from "./tools/summary.js";
import { executeExport } from "./tools/export.js";
import { executeHistory } from "./tools/history.js";
import { initProject, isInitialized } from "./core/session.js";
import { ensureClientCompatibility } from "./compat/clientSetup.js";
import { registerPolyPlanPrompts, registerPolyPlanResources } from "./compat/mcpPrompts.js";
import type { Round } from "./types.js";

/**
 * Create and configure the PolyPlan MCP server with all tools registered.
 */
export function createServer(projectRoot: string): McpServer {
  const server = new McpServer({
    name: "polyplan",
    version: "0.1.0",
  });

  registerPolyPlanPrompts(server);
  registerPolyPlanResources(server);

  // ─── init ─────────────────────────────────────────────────────────
  server.tool(
    "init",
    "Initialize PolyPlan in this project — creates .plans/ and .polyplan/ directories",
    {},
    async () => {
      const alreadyInit = await isInitialized(projectRoot);
      if (alreadyInit) {
        const setup = await ensureClientCompatibility(projectRoot);
        return {
          content: [{
            type: "text",
            text: `PolyPlan is already initialized in this project.\nCompatibility files ensured: ${setup.created.length} created, ${setup.updated.length} updated.`,
          }],
        };
      }
      const config = await initProject(projectRoot);
      await ensureClientCompatibility(projectRoot);
      return {
        content: [{
          type: "text",
          text: `✅ PolyPlan initialized!\n📁 Project: ${config.projectName}\n📂 Created .plans/ and .polyplan/\n🕐 Session started: ${config.createdAt}`,
        }],
      };
    }
  );

  // ─── round_1 ──────────────────────────────────────────────────────
  server.tool(
    "round_1",
    "Start Round 1 — create an independent plan for this model/CLI (no other models seen)",
    {
      problemDescription: z.string().describe("The problem or requirement to plan for"),
      modelName: z.string().optional().describe("Your model name — ALWAYS pass this (e.g., 'sonnet4.6', 'gpt-4o', 'gemini2.5'). Without it the plan file will be named 'unknown'."),
      plan: z.string().describe("The implementation plan content created by the model"),
    },
    async (params, extra) => {
      const identity = detectCaller(server.server.getClientVersion(), params.modelName);
      const result = await executeRound1(projectRoot, identity, {
        problemDescription: params.problemDescription,
        plan: params.plan,
        modelName: params.modelName,
      });

      let text = "";
      if (identity.modelWarning) text += identity.modelWarning + "\n\n";
      if (result.switchWarning) text += result.switchWarning + "\n\n";
      if (result.saved) text += `✅ Round 1 plan saved: ${result.saved}`;
      if (result.prompt) text += result.prompt;

      return { content: [{ type: "text", text }] };
    }
  );

  // ─── round_1_context ──────────────────────────────────────────────
  server.tool(
    "round_1_context",
    "Get the Round 1 prompt — call this first, then generate your plan, then call round_1 to save",
    {
      problemDescription: z.string().describe("The problem or requirement to plan for"),
    },
    async (params) => {
      const prompt = await getRound1Context(projectRoot, params.problemDescription);
      return { content: [{ type: "text", text: prompt }] };
    }
  );

  // ─── round_2 ──────────────────────────────────────────────────────
  server.tool(
    "round_2",
    "Start Round 2 — peer-review all Round 1 plans and write a revised master plan (requires ≥2 Round 1 plans)",
    {
      modelName: z.string().optional().describe("Your model name — ALWAYS pass this (e.g., 'sonnet4.6', 'gpt-4o', 'gemini2.5'). Without it the plan file will be named 'unknown'."),
      plan: z.string().describe("The revised master plan content"),
    },
    async (params, extra) => {
      const identity = detectCaller(server.server.getClientVersion(), params.modelName);
      const result = await executeRound2(projectRoot, identity, {
        plan: params.plan,
        modelName: params.modelName,
      });

      if (result.error) return { content: [{ type: "text", text: `❌ ${result.error}` }] };

      let text = "";
      if (identity.modelWarning) text += identity.modelWarning + "\n\n";
      text += `✅ Round 2 plan saved: ${result.saved}`;
      return { content: [{ type: "text", text }] };
    }
  );

  // ─── round_2_context ──────────────────────────────────────────────
  server.tool(
    "round_2_context",
    "Get the Round 2 prompt with all other models' Round 1 plans injected — call this before generating your Round 2 plan",
    {
      modelName: z.string().optional().describe("Your model name (e.g., 'sonnet4.6') — used to exclude your own Round 1 plan from the injected context"),
    },
    async (params, extra) => {
      const identity = detectCaller(server.server.getClientVersion(), params.modelName);
      const result = await getRound2Context(projectRoot, identity);

      if (result.error) return { content: [{ type: "text", text: `❌ ${result.error}` }] };
      return { content: [{ type: "text", text: result.prompt }] };
    }
  );

  // ─── final_plan ───────────────────────────────────────────────────
  server.tool(
    "final_plan",
    "Start Final round — synthesize ALL Round 1 + Round 2 plans into one implementable plan (requires ≥1 Round 2 plan)",
    {
      modelName: z.string().optional().describe("Your model name — ALWAYS pass this (e.g., 'opus4.6', 'gpt-4o'). Without it the plan file will be named 'unknown'."),
      plan: z.string().describe("The final synthesized plan content"),
    },
    async (params, extra) => {
      const identity = detectCaller(server.server.getClientVersion(), params.modelName);
      const result = await executeFinal(projectRoot, identity, {
        plan: params.plan,
        modelName: params.modelName,
      });

      if (result.error) return { content: [{ type: "text", text: `❌ ${result.error}` }] };

      let text = "";
      if (identity.modelWarning) text += identity.modelWarning + "\n\n";
      text += `✅ Final plan saved: ${result.saved}`;
      return { content: [{ type: "text", text }] };
    }
  );

  // ─── final_plan_context ───────────────────────────────────────────
  server.tool(
    "final_plan_context",
    "Get the Final round prompt with ALL Round 1 + Round 2 plans injected — call this before generating the final plan",
    {},
    async () => {
      const result = await getFinalContext(projectRoot);
      if (result.error) return { content: [{ type: "text", text: `❌ ${result.error}` }] };
      return { content: [{ type: "text", text: result.prompt }] };
    }
  );

  // ─── show_status ──────────────────────────────────────────────────
  server.tool(
    "show_status",
    "Show full session state — which models completed each round, open questions, and conflicts",
    {
      modelName: z.string().optional().describe("Your model name (optional)"),
    },
    async (params, extra) => {
      const identity = detectCaller(server.server.getClientVersion(), params.modelName);
      const formatted = await executeStatus(projectRoot, identity.cliTool, identity.modelName);
      return { content: [{ type: "text", text: formatted }] };
    }
  );

  // ─── clear_plans ──────────────────────────────────────────────────
  server.tool(
    "clear_plans",
    "Delete ALL plan files across all rounds. Must set confirm=true.",
    {
      confirm: z.boolean().describe("Must be true to actually delete — safety gate"),
      modelName: z.string().optional().describe("Your model name (optional)"),
    },
    async (params, extra) => {
      const identity = detectCaller(server.server.getClientVersion(), params.modelName);
      const result = await executeClear(projectRoot, identity, {
        target: "all",
        confirm: params.confirm,
      });
      return { content: [{ type: "text", text: result.message }] };
    }
  );

  // ─── clear_round_1 ────────────────────────────────────────────────
  server.tool(
    "clear_round_1",
    "Delete only Round 1 plan files — leaves Round 2 and Final intact. Must set confirm=true.",
    {
      confirm: z.boolean().describe("Must be true to actually delete — safety gate"),
      modelName: z.string().optional().describe("Your model name (optional)"),
    },
    async (params, extra) => {
      const identity = detectCaller(server.server.getClientVersion(), params.modelName);
      const result = await executeClear(projectRoot, identity, {
        target: "round1",
        confirm: params.confirm,
      });
      return { content: [{ type: "text", text: result.message }] };
    }
  );

  // ─── clear_round_2 ────────────────────────────────────────────────
  server.tool(
    "clear_round_2",
    "Delete only Round 2 plan files — leaves Round 1 and Final intact. Must set confirm=true.",
    {
      confirm: z.boolean().describe("Must be true to actually delete — safety gate"),
      modelName: z.string().optional().describe("Your model name (optional)"),
    },
    async (params, extra) => {
      const identity = detectCaller(server.server.getClientVersion(), params.modelName);
      const result = await executeClear(projectRoot, identity, {
        target: "round2",
        confirm: params.confirm,
      });
      return { content: [{ type: "text", text: result.message }] };
    }
  );

  // ─── show_conflicts ───────────────────────────────────────────────
  server.tool(
    "show_conflicts",
    "Show all points where models disagreed in Round 1 — technology choices, approach, and assumption conflicts",
    {
      modelName: z.string().optional().describe("Your model name (optional)"),
    },
    async (params, extra) => {
      const identity = detectCaller(server.server.getClientVersion(), params.modelName);
      const formatted = await executeConflicts(projectRoot, identity);
      return { content: [{ type: "text", text: formatted }] };
    }
  );

  // ─── show_questions ───────────────────────────────────────────────
  server.tool(
    "show_questions",
    "Show all open questions raised by any model in Round 1, and whether other models answered them",
    {
      modelName: z.string().optional().describe("Your model name (optional)"),
    },
    async (params, extra) => {
      const identity = detectCaller(server.server.getClientVersion(), params.modelName);
      const formatted = await executeQuestions(projectRoot, identity);
      return { content: [{ type: "text", text: formatted }] };
    }
  );

  // ─── show_diff ────────────────────────────────────────────────────
  server.tool(
    "show_diff",
    "Show what changed for a specific model between their Round 1 and Round 2 plans",
    {
      model: z.string().describe("Model identifier to diff (e.g., 'copilot-sonnet4.6')"),
      modelName: z.string().optional().describe("Your model name (optional)"),
    },
    async (params, extra) => {
      const identity = detectCaller(server.server.getClientVersion(), params.modelName);
      const formatted = await executeDiff(projectRoot, identity, params.model);
      return { content: [{ type: "text", text: formatted }] };
    }
  );

  // ─── show_agree ───────────────────────────────────────────────────
  server.tool(
    "show_agree",
    "Show what ALL models agreed on independently in Round 1 — highest-confidence decisions",
    {
      modelName: z.string().optional().describe("Your model name (optional)"),
    },
    async (params, extra) => {
      const identity = detectCaller(server.server.getClientVersion(), params.modelName);
      const formatted = await executeAgree(projectRoot, identity);
      return { content: [{ type: "text", text: formatted }] };
    }
  );

  // ─── show_summary ─────────────────────────────────────────────────
  server.tool(
    "show_summary",
    "One-paragraph summary of each model's plan — quick overview of all positions",
    {
      round: z.enum(["round1", "round2", "final"]).optional().describe("Which round to summarize (defaults to latest round with plans)"),
      modelName: z.string().optional().describe("Your model name (optional)"),
    },
    async (params, extra) => {
      const identity = detectCaller(server.server.getClientVersion(), params.modelName);
      const formatted = await executeSummary(projectRoot, identity, params.round as Round | undefined);
      return { content: [{ type: "text", text: formatted }] };
    }
  );

  // ─── export_plans ─────────────────────────────────────────────────
  server.tool(
    "export_plans",
    "Bundle the entire .plans/ session into one readable markdown file for sharing or archiving",
    {
      modelName: z.string().optional().describe("Your model name (optional)"),
    },
    async (params, extra) => {
      const identity = detectCaller(server.server.getClientVersion(), params.modelName);
      const formatted = await executeExport(projectRoot, identity);
      return { content: [{ type: "text", text: formatted }] };
    }
  );

  // ─── show_history ─────────────────────────────────────────────────
  server.tool(
    "show_history",
    "Full audit log — which model, which CLI tool, which round, what time, what action",
    {
      modelName: z.string().optional().describe("Your model name (optional)"),
    },
    async (params, extra) => {
      const identity = detectCaller(server.server.getClientVersion(), params.modelName);
      const formatted = await executeHistory(projectRoot, identity);
      return { content: [{ type: "text", text: formatted }] };
    }
  );

  return server;
}
