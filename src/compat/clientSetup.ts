/**
 * Project-local client compatibility setup.
 *
 * This creates small command/prompt files for clients that expose slash
 * commands from the filesystem, plus project-local MCP config files where the
 * client supports them.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { POLYPLAN_COMMANDS, type PolyPlanCommand } from "./commands.js";

type JsonObject = Record<string, unknown>;

interface SetupResult {
  created: string[];
  updated: string[];
  skipped: string[];
}

const MCP_ENTRY = {
  command: "polyplan-mcp",
  args: ["--project", "."],
};

const VSCODE_MCP_ENTRY = {
  command: "polyplan-mcp",
  args: ["--project", "."],
};

const OPENCODE_MCP_ENTRY = {
  type: "local",
  command: ["polyplan-mcp", "--project", "."],
  enabled: true,
};

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath: string): Promise<JsonObject | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as JsonObject;
  } catch {
    return null;
  }
}

async function writeJson(filePath: string, data: JsonObject): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function getOrCreateObject(parent: JsonObject, key: string): JsonObject {
  const value = parent[key];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  const next: JsonObject = {};
  parent[key] = next;
  return next;
}

async function mergeJsonFile(
  projectRoot: string,
  relativePath: string,
  apply: (data: JsonObject) => boolean,
  result: SetupResult
): Promise<void> {
  const filePath = path.join(projectRoot, relativePath);
  const existed = await pathExists(filePath);
  const data = (await readJson(filePath)) ?? {};
  const changed = apply(data);

  if (!changed) {
    result.skipped.push(relativePath);
    return;
  }

  await writeJson(filePath, data);
  if (existed) result.updated.push(relativePath);
  else result.created.push(relativePath);
}

async function writeCommandFile(
  projectRoot: string,
  relativePath: string,
  content: string,
  result: SetupResult
): Promise<void> {
  const filePath = path.join(projectRoot, relativePath);
  if (await pathExists(filePath)) {
    result.skipped.push(relativePath);
    return;
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
  result.created.push(relativePath);
}

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

function vscodePromptContent(command: PolyPlanCommand): string {
  return `---\nname: ${command.name}\ndescription: ${command.description}\nargument-hint: ${command.argumentHint ?? "[optional arguments]"}\nagent: agent\ntools: ['polyplan/*']\n---\n\n${command.prompt("${input:arguments:optional arguments}")}\n`;
}

async function setupMcpConfigs(projectRoot: string, result: SetupResult): Promise<void> {
  await mergeJsonFile(
    projectRoot,
    ".mcp.json",
    (data) => {
      const servers = getOrCreateObject(data, "mcpServers");
      const existing = servers.polyplan as JsonObject | undefined;
      if (
        existing &&
        existing.command === MCP_ENTRY.command &&
        JSON.stringify(existing.args) === JSON.stringify(MCP_ENTRY.args)
      ) {
        return false;
      }
      servers.polyplan = MCP_ENTRY;
      return true;
    },
    result
  );

  await mergeJsonFile(
    projectRoot,
    ".cursor/mcp.json",
    (data) => {
      const servers = getOrCreateObject(data, "mcpServers");
      const existing = servers.polyplan as JsonObject | undefined;
      if (
        existing &&
        existing.command === MCP_ENTRY.command &&
        JSON.stringify(existing.args) === JSON.stringify(MCP_ENTRY.args)
      ) {
        return false;
      }
      servers.polyplan = MCP_ENTRY;
      return true;
    },
    result
  );

  await mergeJsonFile(
    projectRoot,
    ".vscode/mcp.json",
    (data) => {
      const servers = getOrCreateObject(data, "servers");
      const existing = servers.polyplan as JsonObject | undefined;
      if (
        existing &&
        existing.command === VSCODE_MCP_ENTRY.command &&
        JSON.stringify(existing.args) === JSON.stringify(VSCODE_MCP_ENTRY.args)
      ) {
        return false;
      }
      servers.polyplan = VSCODE_MCP_ENTRY;
      return true;
    },
    result
  );

  await mergeJsonFile(
    projectRoot,
    "opencode.json",
    (data) => {
      if (!data.$schema) data.$schema = "https://opencode.ai/config.json";
      const mcp = getOrCreateObject(data, "mcp");
      const existing = mcp.polyplan as JsonObject | undefined;
      if (
        existing &&
        existing.type === OPENCODE_MCP_ENTRY.type &&
        JSON.stringify(existing.command) === JSON.stringify(OPENCODE_MCP_ENTRY.command)
      ) {
        return false;
      }
      mcp.polyplan = OPENCODE_MCP_ENTRY;
      return true;
    },
    result
  );
}

async function setupSlashCommands(projectRoot: string, result: SetupResult): Promise<void> {
  for (const command of POLYPLAN_COMMANDS) {
    await writeCommandFile(
      projectRoot,
      `.claude/commands/${command.name}.md`,
      claudeCommandContent(command),
      result
    );
    await writeCommandFile(
      projectRoot,
      `.cursor/commands/${command.name}.md`,
      cursorCommandContent(command),
      result
    );
    await writeCommandFile(
      projectRoot,
      `.opencode/commands/${command.name}.md`,
      opencodeCommandContent(command),
      result
    );
    await writeCommandFile(
      projectRoot,
      `.github/prompts/${command.name}.prompt.md`,
      vscodePromptContent(command),
      result
    );
  }
}

/**
 * Ensure client compatibility files exist for this project.
 */
export async function ensureClientCompatibility(projectRoot: string): Promise<SetupResult> {
  const result: SetupResult = { created: [], updated: [], skipped: [] };
  await setupMcpConfigs(projectRoot, result);
  await setupSlashCommands(projectRoot, result);
  return result;
}
