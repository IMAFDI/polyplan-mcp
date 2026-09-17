# PolyPlan MCP

> A multi-model AI planning MCP server for CLI coding tools

[![npm version](https://img.shields.io/npm/v/polyplan-mcp.svg)](https://npmjs.org/package/polyplan-mcp)
[![npm downloads](https://img.shields.io/npm/dm/polyplan-mcp.svg)](https://npmjs.org/package/polyplan-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/polyplan-mcp.svg)](https://nodejs.org)

## What is PolyPlan?

PolyPlan is an MCP (Model Context Protocol) server that enables structured, multi-model AI planning sessions across multiple CLI coding tools simultaneously.

When you use multiple AI models (Claude Code, Copilot, OpenCode, Codex, Cursor, Windsurf) for planning, PolyPlan provides a structured workflow to collect, cross-review, and synthesize plans from all models into one final implementable master plan.

## How It Works

PolyPlan orchestrates a 3-round planning workflow:

- **Round 1:** Each model creates an independent plan saved to `.plans/` without seeing what any other model thinks.
- **Round 2:** Each model reads all other models' Round 1 plans (except its own) and creates a revised master plan informed by peer review.
- **Final:** One chosen model (e.g., Opus 4.6 or GPT-4o) reads ALL Round 1 + Round 2 plans and produces the final, synthesized, implementable plan.

## Installation

```bash
npm install -g polyplan-mcp
```

On install, a postinstall script runs best-effort user-level MCP registration for every supported CLI tool it finds on your machine (Claude Code `~/.claude.json`, Cursor `~/.cursor/mcp.json`, Windsurf, OpenCode, VS Code Copilot settings, and Codex CLI `~/.codex/config.toml`). Restart your CLI tools after install so they pick up the new MCP server.

## Quick Start

1. **Initialize in your project** (creates planning directories)
   ```bash
   polyplan-mcp init
   ```
   This creates `.plans/`, `.polyplan/config.json`, `.polyplan/WORKFLOWS.md`, and updates `.gitignore`. Nothing else.

2. **Restart your AI coding tool** if you have not already.

3. **Open the PolyPlan menu** — in Claude Code:
   ```
   /mcp__polyplan__polyplan
   ```
   In any other MCP-capable client, invoke the `polyplan` MCP prompt or call the `init` tool to confirm the connection.

4. **Start Round 1** — tell your model:
   ```
   Call the round_1_context tool with problemDescription="add OAuth login", then generate a plan, then call round_1 to save it with modelName="sonnet4.6"
   ```

---

## The `/polyplan` Menu

The `polyplan` MCP prompt is the primary entry point. With no argument it shows a capability menu; with a subcommand it routes directly to the right tool(s).

**In Claude Code** the prompt is namespaced:
```
/mcp__polyplan__polyplan
/mcp__polyplan__polyplan round1 add OAuth login
```

**In other MCP clients**, invoke it through the client's prompt/slash UI as `polyplan` or `polyplan <subcommand>`.

When invoked with no subcommand, PolyPlan displays:

```
PolyPlan — structured multi-model planning. Here's everything it can do:

PLANNING
  round1 <problem>   Create an independent Round 1 plan (no other models seen)
  round2             Peer-review all Round 1 plans, then write a revised plan
  final              Synthesize ALL plans into one implementable plan

REVIEW
  status             Which models completed each round
  conflicts          Where Round 1 plans disagree
  questions          Open questions raised across plans
  agree              What every model independently agreed on
  diff <model>       What changed for one model between rounds
  summary [round]    One-paragraph summary of each plan

MANAGE
  export             Bundle the whole session into one markdown file
  history            Full audit log
  clear              Delete plan files (requires confirmation)

Run one with:  /polyplan <command>   e.g.  /polyplan round1 add OAuth login
```

Each subcommand routes to the matching MCP tool(s):

| Subcommand | Routes to |
|---|---|
| `round1 <problem>` | `round_1_context` → generate plan → `round_1` |
| `round2` | `round_2_context` → generate plan → `round_2` |
| `final` | `final_plan_context` → generate plan → `final_plan` |
| `status` | `show_status` |
| `conflicts` | `show_conflicts` |
| `questions` | `show_questions` |
| `agree` | `show_agree` |
| `diff <model>` | `show_diff` |
| `summary [round]` | `show_summary` |
| `export` | `export_plans` |
| `history` | `show_history` |
| `clear` | `clear_plans` (asks for confirmation first) |

---

## MCP Tools Reference

PolyPlan registers 18 MCP tools. These are the execution layer — invoke them directly or through the `polyplan` menu prompt above.

### How to invoke

**Claude Code** — MCP tools are available as slash commands under their tool names. Because PolyPlan uses a separate MCP server, address tools explicitly:
```
Call the round_1_context tool with problemDescription="add OAuth login"
```
MCP prompts are namespaced: `/mcp__polyplan__round_1`, `/mcp__polyplan__show_status`, etc.

**All other MCP clients** — invoke through the client's tool/prompt UI by tool name, or use natural-language tool calls:
```
Call the round_1 tool with modelName="gpt-4o", problemDescription="...", and plan="..."
```

### Tool list

| Tool | Description |
|---|---|
| `init` | Initialize PolyPlan — creates `.plans/` and `.polyplan/` directories |
| `round_1_context` | Get the Round 1 prompt; call this first, then generate your plan |
| `round_1` | Save a Round 1 plan |
| `round_2_context` | Get the Round 2 prompt with all other models' Round 1 plans injected |
| `round_2` | Save a Round 2 plan (requires ≥2 Round 1 plans) |
| `final_plan_context` | Get the Final prompt with ALL Round 1 + Round 2 plans injected |
| `final_plan` | Save the final synthesized plan (requires ≥1 Round 2 plan) |
| `show_status` | Full session state — which models completed each round |
| `show_conflicts` | Points where models disagreed in Round 1 |
| `show_questions` | Open questions raised by any model, with cross-model answers |
| `show_agree` | Points all models independently agreed on in Round 1 |
| `show_diff` | What changed for one model between Round 1 and Round 2 |
| `show_summary` | One-paragraph summary of each model's plan |
| `export_plans` | Bundle the entire `.plans/` session into one markdown file |
| `show_history` | Full audit log — model, CLI tool, round, time, action |
| `clear_plans` | Delete ALL plan files (requires `confirm=true`) |
| `clear_round_1` | Delete only Round 1 plan files (requires `confirm=true`) |
| `clear_round_2` | Delete only Round 2 plan files (requires `confirm=true`) |

PolyPlan also exposes 12 MCP prompts (`polyplan`, `round_1`, `round_2`, `final_plan`, `show_status`, `show_conflicts`, `show_questions`, `show_diff`, `show_agree`, `show_summary`, `export_plans`, `show_history`) and 3 MCP resources (`polyplan://status`, `polyplan://plans`, `polyplan://workflows`). Clients that support MCP prompts and resources will surface these automatically.

---

## Always Pass Your Model Name

PolyPlan saves plans using the model name in the filename (e.g., `round1-claudecode-sonnet4.6.md`). Auto-detection is not always possible, so **always pass `modelName` explicitly**:

```
Call the round_1 tool with modelName="sonnet4.6", problemDescription="...", plan="..."
```

If `modelName` is omitted, the plan file will be named with `unknown` and a warning will appear in the tool response.

### OpenCode / Gemini

OpenCode with Gemini models requires explicit tool invocation syntax. Use **"Call the tool"** instead of natural language:

| May not invoke the tool | Always invokes the tool |
|---|---|
| `Use polyplan round1 for this problem` | `Call the round_1_context tool, then call round_1` |
| `Use polyplan to show status` | `Call the show_status tool` |

The word **"Call"** forces direct MCP tool invocation in OpenCode/Gemini.

---

## File Naming Convention

All plans are stored locally in `.plans/`:

```
.plans/
  round1-copilot-sonnet4.6.md
  round1-claudecode-kimik2.md
  round2-opencode-gemini2.5.md
  final-antigravity-opus4.6.md
```

Format: `{round}-{cliTool}-{modelName}.md`

---

## Why Multi-Model Planning?

Different models have different strengths, blind spots, and reasoning styles. Some excel at architectural structure; others are better at catching security edge cases. By using multiple models independently and then cross-reviewing, you catch more issues, resolve conflicts early, and produce a significantly more robust plan than any single model could produce alone.

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to get started, run tests, and submit Pull Requests.

## License

[MIT](LICENSE) © 2026 PolyPlan Contributors
