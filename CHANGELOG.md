# Changelog

All notable changes to this project will be documented in this file.

## [0.1.3] - 2026-05-12

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