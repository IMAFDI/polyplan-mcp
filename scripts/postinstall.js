#!/usr/bin/env node
/**
 * PolyPlan MCP — Post-Install Auto Registration
 *
 * Automatically registers polyplan-mcp in all supported CLI tool MCP configs
 * after npm install -g polyplan-mcp.
 *
 * Plain Node.js only — no external dependencies.
 * Works on macOS, Linux, and Windows.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const POLYPLAN_ENTRY = {
  command: "polyplan-mcp",
  args: ["--project", "./"],
};

const OPENCODE_ENTRY = {
  type: "local",
  command: ["polyplan-mcp", "--project", "./"],
  enabled: true,
};

const DIVIDER = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

function homeDir() {
  return os.homedir();
}

function appDataDir() {
  if (process.platform === "win32") return process.env.APPDATA || "";
  if (process.platform === "darwin") {
    return path.join(homeDir(), "Library", "Application Support");
  }
  return process.env.XDG_DATA_HOME || path.join(homeDir(), ".local", "share");
}

function expand(pathStr) {
  return pathStr.replace(/^~/, homeDir()).replace(/%([^%]+)%/, (_, v) => process.env[v] || "");
}

/** Read JSON file, return null if missing or invalid */
function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

/** Write JSON file atomically */
function writeJson(filePath, obj) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + "\n", "utf-8");
    return true;
  } catch {
    return false;
  }
}

const TOOL_CONFIGS = [
  {
    name: "Claude Code (user)",
    keyPath: ["mcpServers", "polyplan"],
    filePath: "~/.claude.json",
  },
  {
    name: "Cursor",
    keyPath: ["mcpServers", "polyplan"],
    filePath: "~/.cursor/mcp.json",
  },
  {
    name: "Windsurf",
    keyPath: ["mcpServers", "polyplan"],
    filePath: "~/.codeium/windsurf/mcp_config.json",
  },
  {
    name: "OpenCode",
    keyPath: ["mcp", "polyplan"],
    filePath: "~/.config/opencode/opencode.json",
    entry: OPENCODE_ENTRY,
  },
  {
    name: "VS Code (Copilot)",
    keyPath: ["mcp", "servers", "polyplan"],
    filePath:
      process.platform === "darwin"
        ? path.join(appDataDir(), "Code", "User", "settings.json")
        : process.platform === "win32"
        ? path.join(appDataDir(), "Code", "User", "settings.json")
        : path.join(homeDir(), ".config", "Code", "User", "settings.json"),
  },
];

const TOML_CONFIGS = [
  {
    name: "Codex CLI",
    filePath: "~/.codex/config.toml",
    section: "[mcp_servers.polyplan]",
    block: [
      "[mcp_servers.polyplan]",
      'command = "polyplan-mcp"',
      'args = ["--project", "./"]',
      "",
    ].join("\n"),
  },
];

function getFilePath(tool) {
  if (path.isAbsolute(tool.filePath)) return tool.filePath;
  return expand(tool.filePath);
}

function setNestedKey(obj, keyPath, value) {
  let curr = obj;
  for (let i = 0; i < keyPath.length - 1; i++) {
    if (!(keyPath[i] in curr)) curr[keyPath[i]] = {};
    curr = curr[keyPath[i]];
  }
  curr[keyPath[keyPath.length - 1]] = value;
}

function getNestedKey(obj, keyPath) {
  let curr = obj;
  for (const k of keyPath) {
    if (!(k in curr)) return undefined;
    curr = curr[k];
  }
  return curr;
}

function alreadyRegistered(obj, keyPath) {
  const existing = getNestedKey(obj, keyPath);
  if (!existing) return false;
  if (Array.isArray(existing.command)) {
    return existing.command[0] === POLYPLAN_ENTRY.command;
  }
  return existing.command === POLYPLAN_ENTRY.command;
}

function registerTool(tool) {
  const filePath = getFilePath(tool);
  const entry = tool.entry ?? POLYPLAN_ENTRY;

  if (!fs.existsSync(filePath)) {
    if (tool.createIfMissing) {
      const obj = {};
      setNestedKey(obj, tool.keyPath, entry);
      if (!writeJson(filePath, obj)) {
        return { status: "write-error", path: filePath };
      }
      return { status: "registered", path: filePath };
    }
    return { status: "not-installed", path: filePath };
  }

  const obj = readJson(filePath);
  if (obj === null) {
    return { status: "parse-error", path: filePath };
  }

  if (alreadyRegistered(obj, tool.keyPath)) {
    return { status: "already-registered", path: filePath };
  }

  setNestedKey(obj, tool.keyPath, entry);

  if (!writeJson(filePath, obj)) {
    return { status: "write-error", path: filePath };
  }

  return { status: "registered", path: filePath };
}

function registerToml(config) {
  const filePath = getFilePath(config);
  let content = "";
  const exists = fs.existsSync(filePath);

  if (exists) {
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      return { status: "write-error", path: filePath };
    }
  }

  if (content.includes(config.section)) {
    return { status: "already-registered", path: filePath };
  }

  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const prefix = content.trimEnd();
    const next = prefix ? `${prefix}\n\n${config.block}` : config.block;
    fs.writeFileSync(filePath, next, "utf-8");
    return { status: "registered", path: filePath };
  } catch {
    return { status: "write-error", path: filePath };
  }
}

function shortenPath(p) {
  const home = homeDir();
  if (p.startsWith(home)) return "~" + p.slice(home.length);
  if (process.platform === "win32") {
    const ad = process.env.APPDATA || "";
    if (p.startsWith(ad)) return "%APPDATA%" + p.slice(ad.length);
  }
  return p;
}

function run() {
  const results = [];

  for (const tool of TOOL_CONFIGS) {
    const result = registerTool(tool);
    results.push({ name: tool.name, ...result });
  }
  for (const config of TOML_CONFIGS) {
    const result = registerToml(config);
    results.push({ name: config.name, ...result });
  }

  const registered = results.filter((r) => r.status === "registered").length;
  const already = results.filter((r) => r.status === "already-registered").length;

  console.log("\nPolyPlan MCP — Auto Registration");
  console.log(DIVIDER);

  for (const r of results) {
    if (r.status === "registered") {
      console.log(`✓ ${r.name.padEnd(23)} ${shortenPath(r.path)}`);
    } else if (r.status === "already-registered") {
      console.log(`✓ ${r.name.padEnd(23)} already registered`);
    } else if (r.status === "not-installed") {
      console.log(`✗ ${r.name.padEnd(23)} not installed, skipped`);
    } else {
      const msg = r.status === "parse-error" ? "parse error" : "write error";
      console.log(`✗ ${r.name.padEnd(23)} ${msg} — ${shortenPath(r.path)}`);
    }
  }

  console.log(DIVIDER);
  if (registered > 0 || already > 0) {
    console.log(
      `PolyPlan registered in ${registered} new tool(s) (${already} already registered).`
    );
  } else {
    console.log("No CLI tools detected. Install a tool to auto-register PolyPlan.");
  }
  console.log("Run polyplan-mcp init inside each project to set up planning directories.");
  console.log("Restart your CLI tools — PolyPlan's 16 MCP tools will be available automatically.\n");
}

run();
