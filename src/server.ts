/**
 * PolyPlan MCP — Server Setup & Tool Registration
 *
 * Creates the MCP server instance and registers all tools.
 * Each tool maps to a /polyplan command from the master plan.
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
import type { Round } from "./types.js";

/**
 * Create and configure the PolyPlan MCP server with all tools registered.
 */
export function createServer(projectRoot: string): McpServer {
  const server = new McpServer({
    name: "polyplan",
    version: "0.1.0",
  });

  // ─── polyplan_init ────────────────────────────────────────────────
  server.tool(
    "polyplan_init",
    "Initialize PolyPlan in the current project. Creates .plans/ and .polyplan/ directories.",
    {},
    async () => {
      const alreadyInit = await isInitialized(projectRoot);
      if (alreadyInit) {
        return { content: [{ type: "text", text: "PolyPlan is already initialized in this project." }] };
      }
      const config = await initProject(projectRoot);
      return {
        content: [{
          type: "text",
          text: `✅ PolyPlan initialized!\n📁 Project: ${config.projectName}\n📂 Created .plans/ and .polyplan/\n🕐 Session started: ${config.createdAt}`,
        }],
      };
    }
  );

  // ─── polyplan_round1 ──────────────────────────────────────────────
  server.tool(
    "polyplan_round1",
    "Start Round 1: Create an individual implementation plan for the given problem. Each model creates its own plan independently.",
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

  // ─── polyplan_round1_context ──────────────────────────────────────
  server.tool(
    "polyplan_round1_context",
    "Get the Round 1 prompt/context to use when creating a plan. Call this before generating your plan.",
    {
      problemDescription: z.string().describe("The problem or requirement to plan for"),
    },
    async (params) => {
      const prompt = await getRound1Context(projectRoot, params.problemDescription);
      return { content: [{ type: "text", text: prompt }] };
    }
  );

  // ─── polyplan_round2 ──────────────────────────────────────────────
  server.tool(
    "polyplan_round2",
    "Start Round 2: Create a revised master plan after reviewing all other models' Round 1 plans. Requires at least 2 Round 1 plans.",
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

  // ─── polyplan_round2_context ──────────────────────────────────────
  server.tool(
    "polyplan_round2_context",
    "Get the Round 2 prompt/context with all other models' Round 1 plans injected. Call this before generating your Round 2 plan.",
    {
      modelName: z.string().optional().describe("Explicit model name override"),
    },
    async (params, extra) => {
      const identity = detectCaller(server.server.getClientVersion(), params.modelName);
      const result = await getRound2Context(projectRoot, identity);

      if (result.error) return { content: [{ type: "text", text: `❌ ${result.error}` }] };
      return { content: [{ type: "text", text: result.prompt }] };
    }
  );

  // ─── polyplan_final ───────────────────────────────────────────────
  server.tool(
    "polyplan_final",
    "Start Final round: Synthesize ALL Round 1 + Round 2 plans into one implementable plan. Requires at least 1 Round 2 plan.",
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

  // ─── polyplan_final_context ───────────────────────────────────────
  server.tool(
    "polyplan_final_context",
    "Get the Final round prompt/context with ALL Round 1 + Round 2 plans injected. Call this before generating your final plan.",
    {},
    async () => {
      const result = await getFinalContext(projectRoot);
      if (result.error) return { content: [{ type: "text", text: `❌ ${result.error}` }] };
      return { content: [{ type: "text", text: result.prompt }] };
    }
  );

  // ─── polyplan_status ──────────────────────────────────────────────
  server.tool(
    "polyplan_status",
    "Show full session state — which models have completed each round, open questions, and conflicts.",
    {
      modelName: z.string().optional().describe("Explicit model name override"),
    },
    async (params, extra) => {
      const identity = detectCaller(server.server.getClientVersion(), params.modelName);
      const formatted = await executeStatus(projectRoot, identity.cliTool, identity.modelName);
      return { content: [{ type: "text", text: formatted }] };
    }
  );

  // ─── polyplan_clear ───────────────────────────────────────────────
  server.tool(
    "polyplan_clear",
    "Clear plan files. Specify target: 'all', 'round1', 'round2', or 'final'. Requires confirmation.",
    {
      target: z.enum(["all", "round1", "round2", "final"]).describe("What to clear"),
      confirm: z.boolean().describe("Must be true to actually delete files"),
      modelName: z.string().optional().describe("Explicit model name override"),
    },
    async (params, extra) => {
      const identity = detectCaller(server.server.getClientVersion(), params.modelName);
      const result = await executeClear(projectRoot, identity, {
        target: params.target as Round | "all",
        confirm: params.confirm,
      });
      return { content: [{ type: "text", text: result.message }] };
    }
  );

  // ─── polyplan_conflicts ───────────────────────────────────────────
  server.tool(
    "polyplan_conflicts",
    "Show all points where models disagreed in Round 1 — technology, approach, and assumption conflicts.",
    {
      modelName: z.string().optional().describe("Explicit model name override"),
    },
    async (params, extra) => {
      const identity = detectCaller(server.server.getClientVersion(), params.modelName);
      const formatted = await executeConflicts(projectRoot, identity);
      return { content: [{ type: "text", text: formatted }] };
    }
  );

  // ─── polyplan_questions ───────────────────────────────────────────
  server.tool(
    "polyplan_questions",
    "Show all open questions raised by any model, and whether they were answered by others.",
    {
      modelName: z.string().optional().describe("Explicit model name override"),
    },
    async (params, extra) => {
      const identity = detectCaller(server.server.getClientVersion(), params.modelName);
      const formatted = await executeQuestions(projectRoot, identity);
      return { content: [{ type: "text", text: formatted }] };
    }
  );

  // ─── polyplan_diff ────────────────────────────────────────────────
  server.tool(
    "polyplan_diff",
    "Show what changed for a specific model between Round 1 and Round 2.",
    {
      model: z.string().describe("Model identifier (e.g., 'copilot-sonnet4.6')"),
      modelName: z.string().optional().describe("Explicit model name override for the caller"),
    },
    async (params, extra) => {
      const identity = detectCaller(server.server.getClientVersion(), params.modelName);
      const formatted = await executeDiff(projectRoot, identity, params.model);
      return { content: [{ type: "text", text: formatted }] };
    }
  );

  // ─── polyplan_agree ───────────────────────────────────────────────
  server.tool(
    "polyplan_agree",
    "Show what ALL models agreed on in Round 1 — highest confidence decisions.",
    {
      modelName: z.string().optional().describe("Explicit model name override"),
    },
    async (params, extra) => {
      const identity = detectCaller(server.server.getClientVersion(), params.modelName);
      const formatted = await executeAgree(projectRoot, identity);
      return { content: [{ type: "text", text: formatted }] };
    }
  );

  // ─── polyplan_summary ─────────────────────────────────────────────
  server.tool(
    "polyplan_summary",
    "One-paragraph summary of each model's plan. Quick overview.",
    {
      round: z.enum(["round1", "round2", "final"]).optional().describe("Which round to summarize (defaults to latest)"),
      modelName: z.string().optional().describe("Explicit model name override"),
    },
    async (params, extra) => {
      const identity = detectCaller(server.server.getClientVersion(), params.modelName);
      const formatted = await executeSummary(projectRoot, identity, params.round as Round | undefined);
      return { content: [{ type: "text", text: formatted }] };
    }
  );

  // ─── polyplan_export ──────────────────────────────────────────────
  server.tool(
    "polyplan_export",
    "Bundle entire .plans/ session into one readable markdown file for sharing or archiving.",
    {
      modelName: z.string().optional().describe("Explicit model name override"),
    },
    async (params, extra) => {
      const identity = detectCaller(server.server.getClientVersion(), params.modelName);
      const formatted = await executeExport(projectRoot, identity);
      return { content: [{ type: "text", text: formatted }] };
    }
  );

  // ─── polyplan_history ─────────────────────────────────────────────
  server.tool(
    "polyplan_history",
    "Full audit log — which model, which CLI, which round, what time, what action.",
    {
      modelName: z.string().optional().describe("Explicit model name override"),
    },
    async (params, extra) => {
      const identity = detectCaller(server.server.getClientVersion(), params.modelName);
      const formatted = await executeHistory(projectRoot, identity);
      return { content: [{ type: "text", text: formatted }] };
    }
  );

  return server;
}
