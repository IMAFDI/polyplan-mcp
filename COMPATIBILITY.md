# PolyPlan Compatibility

PolyPlan is a standard MCP server. Any client that supports MCP can use it.
The table below shows what each supported client gets out of the box and where
the postinstall auto-registration writes its config entry.

## Client Support Matrix

| Client | MCP Tools | MCP Prompts | MCP Resources | Auto-registration path |
|---|---|---|---|---|
| **Claude Code** | Yes — 18 tools available | Yes — surfaced as `/mcp__polyplan__<name>` (e.g. `/mcp__polyplan__polyplan`) | Yes | `~/.claude.json` |
| **Cursor** | Yes | Yes — via Cursor's slash/prompt UI | Yes | `~/.cursor/mcp.json` |
| **OpenCode** | Yes | Yes — via OpenCode prompt UI | Yes | `~/.config/opencode/opencode.json` |
| **VS Code / GitHub Copilot** | Yes | Yes — via Copilot prompt UI | Yes | VS Code `settings.json` (`mcp.servers.polyplan`) |
| **Codex CLI** | Yes | Depends on Codex version | Depends on Codex version | `~/.codex/config.toml` |
| **Windsurf / Gemini** | Yes | Yes — via client UI | Yes | `~/.codeium/windsurf/mcp_config.json` |

Auto-registration is best-effort: the postinstall script only writes to a
client's config if that config file already exists (i.e., the client is
installed). If a client is not installed at `npm install` time, it is skipped
silently. Re-running `npm install -g polyplan-mcp` after installing a new
client will register it.

## Per-Project Init

Running `polyplan-mcp init` inside a project creates:

```
.plans/                    — directory where plan files are stored
.polyplan/config.json      — project session config
.polyplan/WORKFLOWS.md     — human-readable usage guide
.gitignore                 — updated to ignore .plans/ and .polyplan/history.log
```

That is all. `init` does not create `.claude/commands/`, `.cursor/commands/`,
`.github/prompts/`, `.mcp.json`, or any other client-specific wrapper files.
Tools and prompts are discovered by clients through the MCP protocol directly —
no wrapper files are needed.

## MCP Prompts in Claude Code

Claude Code namespaces MCP prompts under the server name. PolyPlan's 12
prompts appear as:

```
/mcp__polyplan__polyplan        (the menu/router — start here)
/mcp__polyplan__round_1
/mcp__polyplan__round_2
/mcp__polyplan__final_plan
/mcp__polyplan__show_status
/mcp__polyplan__show_conflicts
/mcp__polyplan__show_questions
/mcp__polyplan__show_diff
/mcp__polyplan__show_agree
/mcp__polyplan__show_summary
/mcp__polyplan__export_plans
/mcp__polyplan__show_history
```

In other clients the prompts are exposed by their plain names (`polyplan`,
`round_1`, etc.) through the client's own UI.

## Limitations

- **Model name is not auto-detected.** The MCP protocol does not expose the
  active model name to servers. Always pass `modelName` explicitly when calling
  planning tools, or the plan filename will contain `unknown`.
- **Prompts are namespaced in Claude Code.** The bare `/polyplan` or `/round_1`
  slash commands do not exist in Claude Code. Use the full
  `/mcp__polyplan__<name>` form, or invoke tools directly with natural-language
  tool calls.
- **No per-client wrapper files are generated.** `polyplan-mcp init` creates
  planning directories only. There are no generated `.claude/commands/`,
  `.cursor/commands/`, or `.github/prompts/` files.
