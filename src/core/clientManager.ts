/**
 * PolyPlan MCP — Client Integration Manager
 *
 * Handles enable/disable/sync of client compatibility files.
 * Templates live in .polyplan/compatibility/<client>/
 * Generated files are placed in project root and tracked in config.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { POLYPLAN_DIR, CONFIG_FILE, type SupportedClient, type PolyPlanConfig } from "../types.js";
import { POLYPLAN_COMMANDS, type PolyPlanCommand } from "../compat/commands.js";
import { readConfig, writeConfig } from "./configManager.js";

// ─── Types ──────────────────────────────────────────────────────────────────

interface EnableResult {
  client: string;
  created: string[];
  gitignoreUpdated: boolean;
}

interface DisableResult {
  client: string;
  removed: string[];
  gitignoreUpdated: boolean;
}

interface SyncResult {
  clients: string[];
  regenerated: string[];
}

// ─── Template Generators ────────────────────────────────────────────────────

function yamlList(items: string[]): string {
  return items.map((item) => `  - ${item}`).join("\n");
}

function claudeAllowedTools(command: PolyPlanCommand): string[] {
  return command.toolNames.map((toolName) => `mcp__polyplan__${toolName}`);
}

function claudeCommandContent(command: PolyPlanCommand): string {
  return `---\ndescription: ${command.description}\nargument-hint: ${command.argumentHint ?? "[optional arguments]"}\nallowed-tools:\n${yamlList(claudeAllowedTools(command))}\n---\n\n${command.prompt("$ARGUMENTS")}\n`;
}

function cursorCommandContent(command: PolyPlanCommand): string {
  return `---\ndescription: ${command.description}\n---\n\n${command.prompt("$ARGUMENTS")}\n`;
}

function opencodeCommandContent(command: PolyPlanCommand): string {
  return `---\ndescription: ${command.description}\n---\n\n${command.prompt("$ARGUMENTS")}\n`;
}

function githubPromptContent(command: PolyPlanCommand): string {
  return `---\nname: ${command.name}\ndescription: ${command.description}\nargument-hint: ${command.argumentHint ?? "[optional arguments]"}\nagent: agent\ntools: ['polyplan/*']\n---\n\n${command.prompt("${input:arguments:optional arguments}")}\n`;
}

function vscodeSettingsContent(): string {
  return JSON.stringify({
    "mcp": {
      "servers": {
        "polyplan": {
          "command": "polyplan-mcp",
          "args": ["--project", "."]
        }
      }
    }
  }, null, 2) + "\n";
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeFileEnsureDir(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf-8");
}

async function removeFileIfExists(filePath: string): Promise<boolean> {
  try {
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

async function removeDirIfEmpty(dirPath: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dirPath);
    if (entries.length === 0) {
      await fs.rmdir(dirPath);
      return true;
    }
  } catch {
    // Dir doesn't exist or can't read — fine
  }
  return false;
}

// ─── Gitignore Management ───────────────────────────────────────────────────

export async function addToGitignore(projectRoot: string, entries: string[]): Promise<boolean> {
  const gitignorePath = path.join(projectRoot, ".gitignore");
  let content = "";
  try {
    content = await fs.readFile(gitignorePath, "utf-8");
  } catch {
    // doesn't exist
  }

  const lines = content.split("\n");
  const additions: string[] = [];

  for (const entry of entries) {
    if (!lines.some((line) => line.trim() === entry)) {
      additions.push(entry);
    }
  }

  if (additions.length > 0) {
    const newContent = content.trimEnd() + "\n" + additions.join("\n") + "\n";
    await fs.writeFile(gitignorePath, newContent, "utf-8");
    return true;
  }
  return false;
}

async function removeFromGitignore(projectRoot: string, entries: string[]): Promise<boolean> {
  const gitignorePath = path.join(projectRoot, ".gitignore");
  let content = "";
  try {
    content = await fs.readFile(gitignorePath, "utf-8");
  } catch {
    return false;
  }

  const lines = content.split("\n");
  const filtered = lines.filter((line) => !entries.includes(line.trim()));

  if (filtered.length !== lines.length) {
    await fs.writeFile(gitignorePath, filtered.join("\n"), "utf-8");
    return true;
  }
  return false;
}

// ─── Template Writing ───────────────────────────────────────────────────────

async function writeTemplates(projectRoot: string, client: string): Promise<void> {
  const compatDir = path.join(projectRoot, POLYPLAN_DIR, "compatibility", client);
  await ensureDir(compatDir);

  switch (client) {
    case "claude":
      for (const command of POLYPLAN_COMMANDS) {
        await writeFileEnsureDir(
          path.join(compatDir, `${command.name}.md`),
          claudeCommandContent(command)
        );
      }
      break;
    case "cursor":
      for (const command of POLYPLAN_COMMANDS) {
        await writeFileEnsureDir(
          path.join(compatDir, `${command.name}.md`),
          cursorCommandContent(command)
        );
      }
      break;
    case "opencode":
      for (const command of POLYPLAN_COMMANDS) {
        await writeFileEnsureDir(
          path.join(compatDir, `${command.name}.md`),
          opencodeCommandContent(command)
        );
      }
      // Also write opencode.json template
      await writeFileEnsureDir(
        path.join(compatDir, "opencode.json"),
        JSON.stringify({
          "$schema": "https://opencode.ai/config.json",
          "mcp": {
            "polyplan": {
              "type": "local",
              "command": ["polyplan-mcp", "--project", "."],
              "enabled": true
            }
          }
        }, null, 2) + "\n"
      );
      break;
    case "vscode":
      await writeFileEnsureDir(
        path.join(compatDir, "mcp.json"),
        vscodeSettingsContent()
      );
      break;
    case "github":
      for (const command of POLYPLAN_COMMANDS) {
        await writeFileEnsureDir(
          path.join(compatDir, `polyplan-${command.name}.prompt.md`),
          githubPromptContent(command)
        );
      }
      break;
  }
}

// ─── Client Enable ──────────────────────────────────────────────────────────

function getClientInternalName(client: SupportedClient): string[] {
  if (client === "copilot") return ["github"];
  if (client === "all") return ["claude", "cursor", "github", "opencode", "vscode"];
  return [client];
}

function getGitignoreEntries(client: string): string[] {
  switch (client) {
    case "claude": return [".claude/"];
    case "cursor": return [".cursor/"];
    case "github": return [".github/prompts/polyplan-*"];
    case "opencode": return [".opencode/", "opencode.json"];
    case "vscode": return [".vscode/mcp.json"];
    default: return [];
  }
}

async function enableSingleClient(projectRoot: string, client: string): Promise<EnableResult> {
  const created: string[] = [];

  // Generate templates in .polyplan/compatibility/
  await writeTemplates(projectRoot, client);

  // Copy/generate files to project root
  const compatDir = path.join(projectRoot, POLYPLAN_DIR, "compatibility", client);

  switch (client) {
    case "claude": {
      const targetDir = path.join(projectRoot, ".claude", "commands");
      await ensureDir(targetDir);
      for (const command of POLYPLAN_COMMANDS) {
        const src = path.join(compatDir, `${command.name}.md`);
        const dest = path.join(targetDir, `${command.name}.md`);
        try {
          const content = await fs.readFile(src, "utf-8");
          await fs.writeFile(dest, content, "utf-8");
          created.push(`.claude/commands/${command.name}.md`);
        } catch { /* skip if template missing */ }
      }
      break;
    }
    case "cursor": {
      const targetDir = path.join(projectRoot, ".cursor", "commands");
      await ensureDir(targetDir);
      for (const command of POLYPLAN_COMMANDS) {
        const src = path.join(compatDir, `${command.name}.md`);
        const dest = path.join(targetDir, `${command.name}.md`);
        try {
          const content = await fs.readFile(src, "utf-8");
          await fs.writeFile(dest, content, "utf-8");
          created.push(`.cursor/commands/${command.name}.md`);
        } catch { /* skip */ }
      }
      break;
    }
    case "github": {
      const targetDir = path.join(projectRoot, ".github", "prompts");
      await ensureDir(targetDir);
      for (const command of POLYPLAN_COMMANDS) {
        const src = path.join(compatDir, `polyplan-${command.name}.prompt.md`);
        const dest = path.join(targetDir, `polyplan-${command.name}.prompt.md`);
        try {
          const content = await fs.readFile(src, "utf-8");
          await fs.writeFile(dest, content, "utf-8");
          created.push(`.github/prompts/polyplan-${command.name}.prompt.md`);
        } catch { /* skip */ }
      }
      break;
    }
    case "opencode": {
      const targetDir = path.join(projectRoot, ".opencode", "commands");
      await ensureDir(targetDir);
      for (const command of POLYPLAN_COMMANDS) {
        const src = path.join(compatDir, `${command.name}.md`);
        const dest = path.join(targetDir, `${command.name}.md`);
        try {
          const content = await fs.readFile(src, "utf-8");
          await fs.writeFile(dest, content, "utf-8");
          created.push(`.opencode/commands/${command.name}.md`);
        } catch { /* skip */ }
      }
      // Copy opencode.json to root
      const ocSrc = path.join(compatDir, "opencode.json");
      const ocDest = path.join(projectRoot, "opencode.json");
      try {
        const content = await fs.readFile(ocSrc, "utf-8");
        await fs.writeFile(ocDest, content, "utf-8");
        created.push("opencode.json");
      } catch { /* skip */ }
      break;
    }
    case "vscode": {
      const targetDir = path.join(projectRoot, ".vscode");
      await ensureDir(targetDir);
      const src = path.join(compatDir, "mcp.json");
      const dest = path.join(targetDir, "mcp.json");
      try {
        const content = await fs.readFile(src, "utf-8");
        await fs.writeFile(dest, content, "utf-8");
        created.push(".vscode/mcp.json");
      } catch { /* skip */ }
      break;
    }
  }

  // Update .gitignore
  const gitignoreEntries = getGitignoreEntries(client);
  const gitignoreUpdated = await addToGitignore(projectRoot, gitignoreEntries);

  return { client, created, gitignoreUpdated };
}

// ─── Client Disable ─────────────────────────────────────────────────────────

async function disableSingleClient(projectRoot: string, client: string): Promise<DisableResult> {
  const removed: string[] = [];

  switch (client) {
    case "claude": {
      const cmdDir = path.join(projectRoot, ".claude", "commands");
      for (const command of POLYPLAN_COMMANDS) {
        const filePath = path.join(cmdDir, `${command.name}.md`);
        if (await removeFileIfExists(filePath)) {
          removed.push(`.claude/commands/${command.name}.md`);
        }
      }
      await removeDirIfEmpty(cmdDir);
      await removeDirIfEmpty(path.join(projectRoot, ".claude"));
      break;
    }
    case "cursor": {
      const cmdDir = path.join(projectRoot, ".cursor", "commands");
      for (const command of POLYPLAN_COMMANDS) {
        const filePath = path.join(cmdDir, `${command.name}.md`);
        if (await removeFileIfExists(filePath)) {
          removed.push(`.cursor/commands/${command.name}.md`);
        }
      }
      await removeDirIfEmpty(cmdDir);
      // Don't remove .cursor/ — may have other files like mcp.json
      break;
    }
    case "github": {
      const promptDir = path.join(projectRoot, ".github", "prompts");
      for (const command of POLYPLAN_COMMANDS) {
        const filePath = path.join(promptDir, `polyplan-${command.name}.prompt.md`);
        if (await removeFileIfExists(filePath)) {
          removed.push(`.github/prompts/polyplan-${command.name}.prompt.md`);
        }
      }
      await removeDirIfEmpty(promptDir);
      // Don't remove .github/ — may have workflows etc
      break;
    }
    case "opencode": {
      const cmdDir = path.join(projectRoot, ".opencode", "commands");
      for (const command of POLYPLAN_COMMANDS) {
        const filePath = path.join(cmdDir, `${command.name}.md`);
        if (await removeFileIfExists(filePath)) {
          removed.push(`.opencode/commands/${command.name}.md`);
        }
      }
      await removeDirIfEmpty(cmdDir);
      await removeDirIfEmpty(path.join(projectRoot, ".opencode"));
      // Remove opencode.json from root
      if (await removeFileIfExists(path.join(projectRoot, "opencode.json"))) {
        removed.push("opencode.json");
      }
      break;
    }
    case "vscode": {
      const filePath = path.join(projectRoot, ".vscode", "mcp.json");
      if (await removeFileIfExists(filePath)) {
        removed.push(".vscode/mcp.json");
      }
      // Don't remove .vscode/ — may have other settings
      break;
    }
  }

  // Remove from .gitignore
  const gitignoreEntries = getGitignoreEntries(client);
  const gitignoreUpdated = await removeFromGitignore(projectRoot, gitignoreEntries);

  return { client, removed, gitignoreUpdated };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Enable compatibility for a specific client (or all clients).
 */
export async function enableClient(
  projectRoot: string,
  client: SupportedClient
): Promise<EnableResult[]> {
  const clients = getClientInternalName(client);
  const results: EnableResult[] = [];

  for (const c of clients) {
    const result = await enableSingleClient(projectRoot, c);
    results.push(result);
  }

  // Update config
  const config = await readConfig(projectRoot);
  if (config) {
    const enabled = new Set(config.enabledClients ?? []);
    for (const c of clients) {
      enabled.add(c);
    }
    config.enabledClients = [...enabled];
    await writeConfig(projectRoot, config);
  }

  return results;
}

/**
 * Disable compatibility for a specific client (or all clients).
 */
export async function disableClient(
  projectRoot: string,
  client: SupportedClient
): Promise<DisableResult[]> {
  const clients = getClientInternalName(client);
  const results: DisableResult[] = [];

  for (const c of clients) {
    const result = await disableSingleClient(projectRoot, c);
    results.push(result);
  }

  // Update config
  const config = await readConfig(projectRoot);
  if (config) {
    const enabled = new Set(config.enabledClients ?? []);
    for (const c of clients) {
      enabled.delete(c);
    }
    config.enabledClients = [...enabled];
    await writeConfig(projectRoot, config);
  }

  return results;
}

/**
 * Sync (regenerate) all currently enabled client files.
 */
export async function syncClients(projectRoot: string): Promise<SyncResult> {
  const config = await readConfig(projectRoot);
  const enabledClients = config?.enabledClients ?? [];

  if (enabledClients.length === 0) {
    return { clients: [], regenerated: [] };
  }

  const regenerated: string[] = [];

  for (const client of enabledClients) {
    // Regenerate templates
    await writeTemplates(projectRoot, client);
    // Re-enable (overwrite project root files)
    const result = await enableSingleClient(projectRoot, client);
    regenerated.push(...result.created);
  }

  return { clients: enabledClients, regenerated };
}

/**
 * Clean up legacy polyplan files from older versions.
 * Returns list of cleaned paths, or empty if nothing was cleaned.
 */
export async function cleanupLegacyFiles(projectRoot: string): Promise<string[]> {
  const cleaned: string[] = [];

  // Remove .claude/commands/polyplan* files from old installs
  try {
    const claudeCmdDir = path.join(projectRoot, ".claude", "commands");
    const entries = await fs.readdir(claudeCmdDir);
    for (const entry of entries) {
      // Only remove if these look like polyplan commands (match our command names)
      const isPolyplan = POLYPLAN_COMMANDS.some(
        (cmd) => entry === `${cmd.name}.md`
      );
      if (isPolyplan) {
        await removeFileIfExists(path.join(claudeCmdDir, entry));
        cleaned.push(`.claude/commands/${entry}`);
      }
    }
    await removeDirIfEmpty(claudeCmdDir);
    await removeDirIfEmpty(path.join(projectRoot, ".claude"));
  } catch { /* dir doesn't exist */ }

  // Remove .github/prompts/polyplan-*.prompt.md files
  try {
    const ghPromptDir = path.join(projectRoot, ".github", "prompts");
    const entries = await fs.readdir(ghPromptDir);
    for (const entry of entries) {
      if (entry.startsWith("polyplan-") && entry.endsWith(".prompt.md")) {
        await removeFileIfExists(path.join(ghPromptDir, entry));
        cleaned.push(`.github/prompts/${entry}`);
      }
    }
    await removeDirIfEmpty(ghPromptDir);
  } catch { /* dir doesn't exist */ }

  // Remove .opencode/ if created by polyplan (has commands/ with our command files)
  try {
    const ocCmdDir = path.join(projectRoot, ".opencode", "commands");
    const entries = await fs.readdir(ocCmdDir);
    const allPolyplan = entries.every((entry) =>
      POLYPLAN_COMMANDS.some((cmd) => entry === `${cmd.name}.md`)
    );
    if (allPolyplan && entries.length > 0) {
      for (const entry of entries) {
        await removeFileIfExists(path.join(ocCmdDir, entry));
        cleaned.push(`.opencode/commands/${entry}`);
      }
      await removeDirIfEmpty(ocCmdDir);
      await removeDirIfEmpty(path.join(projectRoot, ".opencode"));
    }
  } catch { /* dir doesn't exist */ }

  // Remove opencode.json if it only contains polyplan MCP config
  try {
    const ocJsonPath = path.join(projectRoot, "opencode.json");
    const raw = await fs.readFile(ocJsonPath, "utf-8");
    const data = JSON.parse(raw);
    if (data.mcp && data.mcp.polyplan && Object.keys(data.mcp).length === 1) {
      await removeFileIfExists(ocJsonPath);
      cleaned.push("opencode.json");
    }
  } catch { /* doesn't exist or can't parse */ }

  // Remove .cursor/commands/ polyplan files
  try {
    const cursorCmdDir = path.join(projectRoot, ".cursor", "commands");
    const entries = await fs.readdir(cursorCmdDir);
    for (const entry of entries) {
      const isPolyplan = POLYPLAN_COMMANDS.some(
        (cmd) => entry === `${cmd.name}.md`
      );
      if (isPolyplan) {
        await removeFileIfExists(path.join(cursorCmdDir, entry));
        cleaned.push(`.cursor/commands/${entry}`);
      }
    }
    await removeDirIfEmpty(cursorCmdDir);
  } catch { /* dir doesn't exist */ }

  // Remove old .mcp.json polyplan entry (legacy)
  try {
    const mcpJsonPath = path.join(projectRoot, ".mcp.json");
    const raw = await fs.readFile(mcpJsonPath, "utf-8");
    const data = JSON.parse(raw);
    if (data.mcpServers && data.mcpServers.polyplan) {
      delete data.mcpServers.polyplan;
      if (Object.keys(data.mcpServers).length === 0) {
        await removeFileIfExists(mcpJsonPath);
        cleaned.push(".mcp.json");
      } else {
        await fs.writeFile(mcpJsonPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
        cleaned.push(".mcp.json (removed polyplan entry)");
      }
    }
  } catch { /* doesn't exist or can't parse */ }

  // Remove .vscode/mcp.json polyplan entry (legacy)
  try {
    const vscodeMcpPath = path.join(projectRoot, ".vscode", "mcp.json");
    const raw = await fs.readFile(vscodeMcpPath, "utf-8");
    const data = JSON.parse(raw);
    if (data.servers && data.servers.polyplan) {
      delete data.servers.polyplan;
      if (Object.keys(data.servers).length === 0) {
        await removeFileIfExists(vscodeMcpPath);
        cleaned.push(".vscode/mcp.json");
      } else {
        await fs.writeFile(vscodeMcpPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
        cleaned.push(".vscode/mcp.json (removed polyplan entry)");
      }
    }
  } catch { /* doesn't exist or can't parse */ }

  // Remove .cursor/mcp.json polyplan entry (legacy)
  try {
    const cursorMcpPath = path.join(projectRoot, ".cursor", "mcp.json");
    const raw = await fs.readFile(cursorMcpPath, "utf-8");
    const data = JSON.parse(raw);
    if (data.mcpServers && data.mcpServers.polyplan) {
      delete data.mcpServers.polyplan;
      if (Object.keys(data.mcpServers).length === 0) {
        await removeFileIfExists(cursorMcpPath);
        cleaned.push(".cursor/mcp.json");
      } else {
        await fs.writeFile(cursorMcpPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
        cleaned.push(".cursor/mcp.json (removed polyplan entry)");
      }
    }
  } catch { /* doesn't exist or can't parse */ }

  return cleaned;
}

/**
 * Format enable results for CLI output.
 */
export function formatEnableResult(results: EnableResult[]): string {
  const lines: string[] = [];
  for (const r of results) {
    if (r.created.length > 0) {
      lines.push(`  ✓ ${r.client}: ${r.created.length} files created`);
      for (const f of r.created) {
        lines.push(`    ${f}`);
      }
    }
  }
  if (lines.length === 0) {
    lines.push("  No files were created.");
  }
  return lines.join("\n");
}

/**
 * Format disable results for CLI output.
 */
export function formatDisableResult(results: DisableResult[]): string {
  const lines: string[] = [];
  for (const r of results) {
    if (r.removed.length > 0) {
      lines.push(`  ✓ ${r.client}: ${r.removed.length} files removed`);
      for (const f of r.removed) {
        lines.push(`    ${f}`);
      }
    }
  }
  if (lines.length === 0) {
    lines.push("  No files were removed.");
  }
  return lines.join("\n");
}

/**
 * Format sync results for CLI output.
 */
export function formatSyncResult(result: SyncResult): string {
  if (result.clients.length === 0) {
    return "  No clients are currently enabled. Run `polyplan-mcp enable <client>` first.";
  }
  const lines: string[] = [
    `  ✓ Synced ${result.clients.length} client(s): ${result.clients.join(", ")}`,
    `  ✓ ${result.regenerated.length} files regenerated`,
  ];
  return lines.join("\n");
}
