/**
 * PolyPlan command catalog.
 *
 * MCP tools remain the execution layer. These command definitions are used to
 * expose lightweight prompts/slash wrappers in clients that support them.
 */

export interface PolyPlanCommand {
  name: string;
  title: string;
  description: string;
  argumentHint?: string;
  toolNames: string[];
  prompt: (argsExpression: string) => string;
}

const MODEL_NAME_NOTE =
  "Pass modelName when the active model name is known. If it is not exposed by the client, omit it and let PolyPlan save the plan with modelName='unknown'.";

function quotedArgs(argsExpression: string): string {
  return argsExpression;
}

export const POLYPLAN_COMMANDS: PolyPlanCommand[] = [
  {
    name: "round_1",
    title: "PolyPlan Round 1",
    description: "Create and save an independent Round 1 plan.",
    argumentHint: "[problem description]",
    toolNames: ["round_1_context", "round_1"],
    prompt: (args) => `Start PolyPlan Round 1 for this problem: ${quotedArgs(args)}

Use the PolyPlan MCP tools, not shell commands.

Steps:
1. Call round_1_context with problemDescription set to the user's arguments.
2. Use the returned context to create an independent implementation plan.
3. Call round_1 with problemDescription, the generated plan, and modelName if known.

${MODEL_NAME_NOTE}`,
  },
  {
    name: "round_1_context",
    title: "PolyPlan Round 1 Context",
    description: "Get the Round 1 planning prompt.",
    argumentHint: "[problem description]",
    toolNames: ["round_1_context"],
    prompt: (args) => `Call the PolyPlan round_1_context MCP tool with problemDescription set to: ${quotedArgs(args)}`,
  },
  {
    name: "round_2",
    title: "PolyPlan Round 2",
    description: "Create and save a peer-review Round 2 plan.",
    argumentHint: "[optional focus]",
    toolNames: ["round_2_context", "round_2"],
    prompt: (args) => `Start PolyPlan Round 2. Optional user focus: ${quotedArgs(args)}

Use the PolyPlan MCP tools, not shell commands.

Steps:
1. Call round_2_context with modelName if known.
2. Use the returned peer-review context to create a revised master plan.
3. Call round_2 with the generated plan and modelName if known.

${MODEL_NAME_NOTE}`,
  },
  {
    name: "round_2_context",
    title: "PolyPlan Round 2 Context",
    description: "Get the Round 2 peer-review prompt.",
    argumentHint: "[optional modelName]",
    toolNames: ["round_2_context"],
    prompt: () => `Call the PolyPlan round_2_context MCP tool. Pass modelName if known.`,
  },
  {
    name: "final_plan",
    title: "PolyPlan Final Plan",
    description: "Create and save the final synthesized plan.",
    argumentHint: "[optional focus]",
    toolNames: ["final_plan_context", "final_plan"],
    prompt: (args) => `Start PolyPlan final synthesis. Optional user focus: ${quotedArgs(args)}

Use the PolyPlan MCP tools, not shell commands.

Steps:
1. Call final_plan_context.
2. Use the returned context to synthesize one final implementable plan.
3. Call final_plan with the generated plan and modelName if known.

${MODEL_NAME_NOTE}`,
  },
  {
    name: "final_plan_context",
    title: "PolyPlan Final Context",
    description: "Get the final synthesis prompt.",
    toolNames: ["final_plan_context"],
    prompt: () => `Call the PolyPlan final_plan_context MCP tool.`,
  },
  {
    name: "show_status",
    title: "PolyPlan Status",
    description: "Show PolyPlan session status.",
    toolNames: ["show_status"],
    prompt: () => `Call the PolyPlan show_status MCP tool.`,
  },
  {
    name: "clear_plans",
    title: "PolyPlan Clear Plans",
    description: "Clear all PolyPlan plans after explicit confirmation.",
    argumentHint: "confirm=true",
    toolNames: ["clear_plans"],
    prompt: (args) => `The user requested PolyPlan clear_plans with arguments: ${quotedArgs(args)}

This is destructive. Only call clear_plans with confirm=true if the user explicitly supplied confirm=true. Otherwise call clear_plans with confirm=false so PolyPlan can show the safety warning.`,
  },
  {
    name: "show_conflicts",
    title: "PolyPlan Conflicts",
    description: "Show detected Round 1 conflicts.",
    toolNames: ["show_conflicts"],
    prompt: () => `Call the PolyPlan show_conflicts MCP tool.`,
  },
  {
    name: "show_questions",
    title: "PolyPlan Questions",
    description: "Show open questions raised by plans.",
    toolNames: ["show_questions"],
    prompt: () => `Call the PolyPlan show_questions MCP tool.`,
  },
  {
    name: "show_diff",
    title: "PolyPlan Diff",
    description: "Show what changed for one model between rounds.",
    argumentHint: "[model identifier]",
    toolNames: ["show_diff"],
    prompt: (args) => `Call the PolyPlan show_diff MCP tool with model set to: ${quotedArgs(args)}`,
  },
  {
    name: "show_agree",
    title: "PolyPlan Agreement",
    description: "Show Round 1 points all models agreed on.",
    toolNames: ["show_agree"],
    prompt: () => `Call the PolyPlan show_agree MCP tool.`,
  },
  {
    name: "show_summary",
    title: "PolyPlan Summary",
    description: "Summarize existing plans.",
    argumentHint: "[round1|round2|final]",
    toolNames: ["show_summary"],
    prompt: (args) => `Call the PolyPlan show_summary MCP tool. If the user supplied one of round1, round2, or final, pass it as the round argument. User arguments: ${quotedArgs(args)}`,
  },
  {
    name: "export_plans",
    title: "PolyPlan Export",
    description: "Export the current PolyPlan session.",
    toolNames: ["export_plans"],
    prompt: () => `Call the PolyPlan export_plans MCP tool.`,
  },
  {
    name: "show_history",
    title: "PolyPlan History",
    description: "Show the PolyPlan audit log.",
    toolNames: ["show_history"],
    prompt: () => `Call the PolyPlan show_history MCP tool.`,
  },
  {
    name: "polyplan",
    title: "PolyPlan",
    description: "Route natural PolyPlan subcommands such as status, round1, round2, and final.",
    argumentHint: "[status|round1|round2|final|summary|conflicts|questions|diff|export|history]",
    toolNames: [
      "round_1_context",
      "round_1",
      "round_2_context",
      "round_2",
      "final_plan_context",
      "final_plan",
      "show_status",
      "show_conflicts",
      "show_questions",
      "show_diff",
      "show_agree",
      "show_summary",
      "export_plans",
      "show_history",
    ],
    prompt: (args) => `Route this PolyPlan request: ${quotedArgs(args)}

Use PolyPlan MCP tools, not shell commands.

Routing:
- status -> show_status
- round1 or round_1 -> round_1_context, then round_1
- round2 or round_2 -> round_2_context, then round_2
- final -> final_plan_context, then final_plan
- conflicts -> show_conflicts
- questions -> show_questions
- diff -> show_diff
- agree -> show_agree
- summary -> show_summary
- export -> export_plans
- history -> show_history

For planning rounds, generate the requested plan from the context tool result before calling the save tool. ${MODEL_NAME_NOTE}`,
  },
];

export function getCommandByName(name: string): PolyPlanCommand | undefined {
  return POLYPLAN_COMMANDS.find((command) => command.name === name);
}

export function commandCatalogMarkdown(): string {
  return POLYPLAN_COMMANDS
    .map((command) => `- ${command.name}: ${command.description}`)
    .join("\n");
}
