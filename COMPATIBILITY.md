# PolyPlan MCP Compatibility Notes

## Current Architecture

PolyPlan is a small TypeScript MCP server with two entry modes:

- `polyplan-mcp init` initializes a project.
- `polyplan-mcp --project <path>` starts the stdio MCP server for that project.

Key paths:

- `src/index.ts`: CLI entry point, version handling, init handling, stdio server startup.
- `src/server.ts`: MCP server construction and tool registration.
- `src/tools/*`: workflow tools for rounds, status, summaries, conflicts, export, and history.
- `src/core/session.ts`: `.polyplan/config.json` state and project initialization.
- `src/core/plansManager.ts`: `.plans/*.md` read/write/list/delete logic.
- `src/core/modelDetector.ts`: MCP client identity normalization and modelName fallback.
- `scripts/postinstall.js`: best-effort global MCP registration after npm install.

## MCP Server Architecture

The server uses `McpServer` from `@modelcontextprotocol/sdk` over stdio. All workflow behavior remains behind MCP tools. The compatibility layer adds prompts/resources and client command files, but it does not replace the tool layer.

The server name is `polyplan`. Tool calls are therefore exposed by many clients with a server prefix internally, such as `polyplan/show_status`, `polyplan-show_status`, or `mcp__polyplan__show_status`, depending on the client.

## Tool Registration

Tools are registered in `src/server.ts` with `server.tool(...)`. Existing command names are preserved:

- `round_1`
- `round_1_context`
- `round_2`
- `round_2_context`
- `final_plan`
- `final_plan_context`
- `show_status`
- `clear_plans`
- `show_conflicts`
- `show_questions`
- `show_diff`
- `show_agree`
- `show_summary`
- `export_plans`
- `show_history`

The implementation also retains the existing `clear_round_1` and `clear_round_2` tools.

## Slash Command Exposure

MCP tools are not a portable slash-command API. Some clients list tools in command-style UIs, while others only make tools available to the model. Portable slash UX requires client-specific command/prompt support.

PolyPlan now exposes the same workflow three ways:

- MCP tools: execution layer.
- MCP prompts: portable prompt discovery for clients that expose MCP prompts as slash commands.
- Project command files: native slash wrappers for clients with file-backed command systems.

## Initialization

`polyplan-mcp init` now does more than create `.plans/` and `.polyplan/`. It also ensures project-local compatibility files:

- `.mcp.json` for Claude Code and GitHub Copilot CLI style workspace MCP config.
- `.cursor/mcp.json` for Cursor project MCP config.
- `.vscode/mcp.json` for VS Code/GitHub Copilot Agent mode MCP config.
- `opencode.json` for OpenCode project MCP config.
- `.claude/commands/*.md` for Claude Code direct slash commands.
- `.cursor/commands/*.md` for Cursor custom slash commands.
- `.opencode/commands/*.md` for OpenCode custom slash commands.
- `.github/prompts/*.prompt.md` for VS Code/GitHub Copilot prompt-file slash commands.

Existing files are merged or skipped; command files are not overwritten.

## Postinstall

`scripts/postinstall.js` is best-effort global registration only. It cannot reliably know the project where the user intends to use PolyPlan during `npm install -g`, so project-local files are created by `polyplan-mcp init`.

Postinstall currently attempts:

- Claude Code user MCP config.
- Cursor global MCP config.
- Windsurf global MCP config.
- OpenCode global MCP config.
- VS Code user settings MCP config.
- Codex CLI `~/.codex/config.toml` MCP config.

Users should still run `polyplan-mcp init` inside each project.

## Plan Storage

Plans are markdown files in `.plans/`:

```text
.plans/
  round1-<cliTool>-<modelName>.md
  round2-<cliTool>-<modelName>.md
  final-<cliTool>-<modelName>.md
```

Project metadata and history are stored in `.polyplan/`:

- `.polyplan/config.json`
- `.polyplan/history.log`

## Client Support Matrix

| Client | Works Well | Partial / Limitation | PolyPlan Strategy |
|---|---|---|---|
| Claude Code | Project `.mcp.json`, `.claude/commands`, MCP prompts | MCP prompt slash names are prefixed as `/mcp__polyplan__...`; direct `/round_1` needs `.claude/commands` | Generate both MCP config and direct command files |
| OpenCode | Project `opencode.json`, `.opencode/commands` | MCP tools are model-callable; natural language may not force tool use | Generate custom slash wrappers that explicitly instruct tool calls |
| Codex CLI | MCP tools via config | Public docs list built-in slash commands, not custom MCP prompt slash exposure | Register MCP globally in postinstall; rely on natural tool invocation |
| Cursor | `.cursor/mcp.json`, `.cursor/commands`, MCP tools/prompts/resources | Tool use is agent-selected; direct slash commands use command files | Generate project MCP config and command files |
| GitHub Copilot CLI | `.mcp.json` workspace MCP config | Slash commands are mostly built-in; MCP tools require permission | Generate `.mcp.json`; command UX depends on client support |
| VS Code Copilot | `.vscode/mcp.json`, `.github/prompts/*.prompt.md` | Prompt files are the slash UX; MCP tools are tools, not direct commands | Generate both MCP config and prompt files |
| Windsurf | Global `mcp_config.json` tools | Docs currently show only limited chat slash commands | Postinstall configures global MCP; no project slash wrapper yet |
| AntiGravity | MCP config/manual MCP store | Public docs are less stable; slash command support is unclear | Existing MCP tools work where configured; no generated local wrapper yet |
| Gemini CLI | MCP tools and MCP prompts as slash commands | Tool invocation may still require explicit phrasing/approval | Register MCP prompts matching PolyPlan command names |

## Client vs Project Limitations

Client limitations:

- No shared standard for custom slash command manifests.
- MCP tools are not universally exposed as slash commands.
- MCP prompt slash naming differs by client.
- Some clients require explicit tool-call phrasing or user approval.
- Some clients do not expose active model name to MCP servers.

Project limitations addressed here:

- Project-local registration was incomplete.
- Global postinstall previously tried to create project-local config from the wrong working directory.
- No MCP prompts/resources were registered.
- No file-backed slash wrappers existed for clients that support them.

Remaining project limitations:

- Windsurf and AntiGravity do not yet have a reliable project-local command-file target.
- Codex custom slash extensibility is not equivalent to Claude/Cursor/OpenCode/VS Code prompt files.
- `modelName` still cannot be auto-detected reliably across clients.
