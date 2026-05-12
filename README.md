# PolyPlan MCP

> A multi-model AI planning MCP server for CLI coding tools

[![npm version](https://img.shields.io/npm/v/polyplan-mcp.svg)](https://npmjs.org/package/polyplan-mcp)
[![npm downloads](https://img.shields.io/npm/dm/polyplan-mcp.svg)](https://npmjs.org/package/polyplan-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/polyplan-mcp.svg)](https://nodejs.org)

## What is PolyPlan?
PolyPlan is a project-local MCP (Model Context Protocol) server that enables developers to run structured, multi-model AI planning sessions across multiple CLI coding tools simultaneously. 

When developers use multiple AI models (Claude Code, Copilot, OpenCode, Codex, Cursor, AntiGravity) for planning, PolyPlan provides a structured way to collect, cross-review, and synthesize plans from all models into one final implementable master plan.

## How It Works
PolyPlan orchestrates a 3-round planning workflow:
- **Round 1:** Each model creates an independent plan saved to `.plans/` without seeing what any other model thinks.
- **Round 2:** Each model reads all other models' Round 1 plans (except its own) and creates a revised master plan informed by peer review.
- **Final:** One chosen model (your strongest, e.g., Opus 4.6 or GPT-4o) reads ALL Round 1 + Round 2 plans and produces the final, synthesized, implementable plan.

## Installation
```bash
npm install -g polyplan-mcp
```
*Note: PolyPlan auto-registers in Claude Code, Cursor, Windsurf, OpenCode, and VS Code (Copilot) on install.*

## Quick Start
1. **Initialize in your project**
   ```bash
   polyplan-mcp init
   ```
2. **In any connected CLI tool, start Round 1**
   ```
   /round_1 Start Round 1 for this problem: [your problem]
   ```
3. **Check status anytime**
   ```
   /show_status
   ```

## All Commands

These are the MCP tool names. In Claude Code they appear directly as `/slash commands` in the `/` menu.

| Slash Command | Description |
|---|---|
| `/round_1` | Start Round 1 — create an independent plan (no other models seen). |
| `/round_1_context` | Get the Round 1 prompt — call before generating your plan. |
| `/round_2` | Start Round 2 — peer-review all Round 1 plans and write a revised master plan. Requires ≥2 Round 1 plans. |
| `/round_2_context` | Get the Round 2 prompt with all other models' plans injected. |
| `/final_plan` | Start Final round — synthesize ALL plans into one implementable plan. Requires ≥1 Round 2 plan. |
| `/final_plan_context` | Get the Final round prompt with all Round 1 + Round 2 plans injected. |
| `/show_status` | Show full session state — which models completed each round. |
| `/clear_plans` | Delete plan files. Specify `all`, `round1`, `round2`, or `final`. Requires `confirm=true`. |
| `/show_conflicts` | Show all points where models disagreed in Round 1. |
| `/show_questions` | Show all open questions raised by any model, and which were answered by others. |
| `/show_diff` | Show what changed for a specific model between Round 1 and Round 2. |
| `/show_agree` | Show what ALL models agreed on independently in Round 1. |
| `/show_summary` | One-paragraph summary of each model's plan. |
| `/export_plans` | Bundle entire `.plans/` session into one readable markdown file for sharing. |
| `/show_history` | Full audit log — model, CLI tool, round, time, action. |

## File Naming Convention
All plans are stored locally in the `.plans/` directory using the following convention:
```
.plans/
  round1-copilot-sonnet4.6.md
  round1-claudecode-kimik2.md
  round2-opencode-gemini2.5.md
  final-antigravity-opus4.6.md
```

## Supported CLI Tools
PolyPlan connects to any tool supporting the Model Context Protocol (MCP):
- **Claude Code** (`~/.claude/claude_mcp_config.json`)
- **GitHub Copilot / VS Code** (`.github/copilot-config.json` or global)
- **Cursor**
- **Windsurf**
- **OpenCode**

## CLI Tool Specific Usage

### Always pass your model name
PolyPlan saves plans using the model name in the filename (e.g., `round1-claudecode-sonnet4.6.md`). Auto-detection is not always possible, so **always pass `modelName` explicitly**:

```
Call the polyplan_round1 tool with modelName='sonnet4.6' and problem='...' and plan='...'
```

### OpenCode / Gemini
OpenCode with Gemini models requires explicit tool invocation syntax. Use **"Call the tool"** instead of **"Use polyplan"**:

| ❌ May not invoke the tool | ✅ Always invokes the tool |
|---|---|
| `Use polyplan round1 for this problem: ...` | `Call the round_1 tool with modelName='gemini2.5' and problem='...' and plan='...'` |
| `Use polyplan to show status` | `Call the show_status tool` |
| `Use polyplan round2` | `Call the round_2_context tool, then call round_2` |

The word **"Call"** forces direct MCP tool invocation in OpenCode/Gemini instead of a natural-language response.

### Claude Code
Claude Code auto-detects as `claudecode` but does not expose the active model name via MCP. Always pass `modelName` explicitly:
```
/round_1 modelName=sonnet4.6 problemDescription="..." plan="..."
```

### GitHub Copilot (VS Code)
Works with slash commands directly. Still recommended to pass `modelName`:
```
/round_1 with modelName='sonnet4.6' for this problem: ...
```

## Why Multi-Model Planning?
Different models have different strengths, blind spots, and reasoning styles. Some excel at architectural structure, while others are better at catching security edge cases. By using 5+ models independently and then cross-reviewing, you catch more issues, resolve conflicts early, and produce a significantly more robust plan than any single model could produce alone.

## Contributing
We welcome contributions! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to get started, run tests, and submit Pull Requests.

## License
[MIT](LICENSE) © 2026 PolyPlan Contributors