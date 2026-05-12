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
   Use polyplan to start round 1 for this problem: [your problem]
   ```
3. **Check status anytime**
   ```
   Use polyplan to show status
   ```

## All Commands

| Command | Description |
|---|---|
| `round1` | Start Round 1. Creates an individual plan for this model/CLI combo. |
| `round2` | Start Round 2. Auto-feeds all Round 1 plans except own. Creates master plan. |
| `final` | Start Final round. Feeds ALL Round 1 + Round 2 plans. Creates final implementable plan. |
| `status` | Show full session state — which models have completed each round. |
| `clear` | Wipe all plans and start completely fresh. Prompts for confirmation. |
| `clear round1` | Clear only Round 1 plans. Leaves Round 2 intact if it exists. |
| `clear round2` | Clear only Round 2 plans. Leaves Round 1 intact. |
| `conflicts` | Show all points where models disagreed in Round 1. |
| `questions` | Show all open questions raised by any model, and which were answered by others. |
| `diff` | Show what changed for a specific model between Round 1 and Round 2. |
| `agree` | Show what ALL models agreed on in Round 1 without seeing each other. |
| `summary` | One-paragraph summary of each model's plan. Quick overview. |
| `export` | Bundle entire `.plans/` session into one readable markdown file for sharing. |
| `history` | Full audit log — which model, which CLI, which round, what time, what action. |

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
| `Use polyplan round1 for this problem: ...` | `Call the polyplan_round1 tool with modelName='gemini2.5' and problem='...' and plan='...'` |
| `Use polyplan to show status` | `Call the polyplan_status tool` |
| `Use polyplan round2` | `Call the polyplan_round2_context tool, then call polyplan_round2` |

The word **"Call"** forces direct MCP tool invocation in OpenCode/Gemini instead of a natural-language response.

### Claude Code
Claude Code auto-detects as `claudecode` but does not expose the active model name via MCP. Always pass `modelName` explicitly:
```
Call the polyplan_round1 tool with modelName='sonnet4.6' for this problem: ...
```

### GitHub Copilot (VS Code)
Works with natural language. Still recommended to pass `modelName`:
```
Use polyplan round1 with modelName='sonnet4.6' for this problem: ...
```

## Why Multi-Model Planning?
Different models have different strengths, blind spots, and reasoning styles. Some excel at architectural structure, while others are better at catching security edge cases. By using 5+ models independently and then cross-reviewing, you catch more issues, resolve conflicts early, and produce a significantly more robust plan than any single model could produce alone.

## Contributing
We welcome contributions! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to get started, run tests, and submit Pull Requests.

## License
[MIT](LICENSE) © 2026 PolyPlan Contributors