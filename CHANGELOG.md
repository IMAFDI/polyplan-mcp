# Changelog

All notable changes to this project will be documented in this file.

## [0.1.4] - 2026-05-12

### Changed
- Renamed all MCP tool names to underscore_format so Claude Code exposes them as `/slash commands` in the `/` menu
  - `polyplan_round1` → `round_1`
  - `polyplan_round1_context` → `round_1_context`
  - `polyplan_round2` → `round_2`
  - `polyplan_round2_context` → `round_2_context`
  - `polyplan_final` → `final_plan`
  - `polyplan_final_context` → `final_plan_context`
  - `polyplan_status` → `show_status`
  - `polyplan_clear` → `clear_plans`
  - `polyplan_conflicts` → `show_conflicts`
  - `polyplan_questions` → `show_questions`
  - `polyplan_diff` → `show_diff`
  - `polyplan_agree` → `show_agree`
  - `polyplan_summary` → `show_summary`
  - `polyplan_export` → `export_plans`
  - `polyplan_history` → `show_history`
  - `polyplan_init` → `init`
- Improved description strings on every tool — shown next to the slash command in Claude Code's `/` menu
- Updated README All Commands table and CLI Tool Specific Usage examples to use new slash command names



### Fixed
- Model name "unknown" bug: warning now appears in the tool response (not silent stderr) when `modelName` is not passed, instructing users to pass it explicitly
- Updated `modelName` parameter description on `polyplan_round1`, `polyplan_round2`, and `polyplan_final` to make it clear it should always be provided
- OpenCode/Gemini tool invocation: added "CLI Tool Specific Usage" section to README explaining that OpenCode requires `"Call the polyplan_X tool"` syntax rather than natural language
- Status output now shows OpenCode invocation hint when no Round 1 plans exist

## [0.1.2] - 2026-05-12
### Added
- Initial release
- 16 MCP tools: round1, round2, final, status, clear, conflicts, questions, diff, agree, summary, export, history
- Auto-registration postinstall script for Claude Code, Cursor, Windsurf, OpenCode, VS Code
- Conflict detection engine (9 technology categories)
- Question tracking with cross-model answer linking
- Model switch detection with user prompt
- Full audit history log