import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { addToGitignore } from "./clientManager.js";

type McpFormat = "object" | "array" | "toml";

interface PlatformDef {
  name: string;
  configPath: (root: string) => string;
  key: string;
  detect: () => Promise<boolean>;
  format: McpFormat;
  needsType: boolean;
}

const home = os.homedir();

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function hasCommand(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const PLATFORMS: Record<string, PlatformDef> = {
  "claude": {
    name: "Claude Code",
    configPath: (root) => path.join(root, ".mcp.json"),
    key: "mcpServers",
    detect: async () => true, // Claude Code is common, always add local
    format: "object",
    needsType: true,
  },
  "copilot": {
    name: "GitHub Copilot (VS Code)",
    configPath: (root) => path.join(root, ".vscode", "mcp.json"),
    key: "servers",
    detect: async () => exists(path.join(home, ".vscode")),
    format: "object",
    needsType: true,
  },
  "opencode": {
    name: "OpenCode",
    configPath: (root) => path.join(root, ".opencode.json"),
    key: "mcpServers",
    detect: async () => true,
    format: "object",
    needsType: true,
  },
  "gemini": {
    name: "Gemini CLI",
    configPath: (root) => path.join(root, ".gemini", "settings.json"),
    key: "mcpServers",
    detect: async () => hasCommand("gemini") || await exists(path.join(home, ".gemini")),
    format: "object",
    needsType: false,
  },
  "cursor": {
    name: "Cursor",
    configPath: (root) => path.join(root, ".cursor", "mcp.json"),
    key: "mcpServers",
    detect: async () => exists(path.join(home, ".cursor")),
    format: "object",
    needsType: true,
  },
  "codex": {
    name: "Codex",
    configPath: (root) => path.join(home, ".codex", "config.toml"),
    key: "mcp_servers",
    detect: async () => exists(path.join(home, ".codex")),
    format: "toml",
    needsType: true,
  }
};

function buildServerEntry(needsType: boolean, projectRoot: string) {
  const entry: any = {
    command: "npx",
    args: ["-y", "polyplan-mcp", "--project", projectRoot]
  };
  if (needsType) {
    entry.type = "stdio";
  }
  return entry;
}

export async function detectAndInstallMcp(projectRoot: string): Promise<{configured: string[], alreadyConfigured: string[]}> {
  const configured: string[] = [];
  const alreadyConfigured: string[] = [];
  const gitignoreEntries: string[] = [];

  for (const [key, plat] of Object.entries(PLATFORMS)) {
    if (!(await plat.detect())) {
      continue;
    }

    const configPath = plat.configPath(projectRoot);
    const serverKey = plat.key;
    const serverEntry = buildServerEntry(plat.needsType, projectRoot);

    if (plat.format === "toml") {
      const changed = await mergeTomlMcpServer(configPath, "polyplan-mcp", serverEntry);
      if (changed) {
        console.log(`  ✓ ${plat.name}: configured ${configPath}`);
        configured.push(plat.name);
      } else {
        console.log(`  - ${plat.name}: already configured in ${configPath}`);
        alreadyConfigured.push(plat.name);
      }
      continue;
    }

    // JSON format (object)
    let existing: any = {};
    if (await exists(configPath)) {
      try {
        const raw = await fs.readFile(configPath, "utf-8");
        // Simple JSON5 parsing
        const stripped = raw.replace(/\/\/[^\n]*\n/g, '\n').replace(/,(\s*[}\]])/g, '$1');
        existing = JSON.parse(stripped || "{}");
      } catch (e) {
        console.log(`  ⚠ ${plat.name}: unparseable JSON in ${configPath}. Skipping.`);
        continue;
      }
    }

    const servers = existing[serverKey] || {};
    if (servers["polyplan-mcp"]) {
      console.log(`  - ${plat.name}: already configured in ${configPath}`);
      alreadyConfigured.push(plat.name);
      continue;
    }

    servers["polyplan-mcp"] = serverEntry;
    existing[serverKey] = servers;

    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(existing, null, 2) + "\n", "utf-8");
    console.log(`  ✓ ${plat.name}: configured ${configPath}`);
    configured.push(plat.name);

    // Track for gitignore if it's within project root
    if (configPath.startsWith(projectRoot)) {
      const relPath = path.relative(projectRoot, configPath);
      // For .vscode/mcp.json we add .vscode/mcp.json to gitignore, etc.
      if (relPath.startsWith(".mcp.json") || relPath.startsWith(".opencode.json")) {
         gitignoreEntries.push(relPath);
      } else {
         const topDir = relPath.split(path.sep)[0];
         gitignoreEntries.push(`${topDir}/`);
      }
    }
  }

  if (gitignoreEntries.length > 0) {
    await addToGitignore(projectRoot, [...new Set(gitignoreEntries)]);
  }

  return { configured, alreadyConfigured };
}

async function mergeTomlMcpServer(configPath: string, serverName: string, entry: any): Promise<boolean> {
  const sectionHeader = `[mcp_servers.${serverName}]`;
  let existing = "";
  if (await exists(configPath)) {
    existing = await fs.readFile(configPath, "utf-8");
    if (existing.includes(sectionHeader)) {
      return false;
    }
  }

  const lines = [sectionHeader];
  for (const [k, v] of Object.entries(entry)) {
    if (k === "args" && Array.isArray(v)) {
      lines.push(`${k} = [${v.map(arg => `"${arg}"`).join(", ")}]`);
    } else {
      lines.push(`${k} = "${v}"`);
    }
  }
  const section = lines.join("\n") + "\n";

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  let prefix = existing;
  if (prefix && !prefix.endsWith("\n")) prefix += "\n";
  if (prefix && !prefix.endsWith("\n\n")) prefix += "\n";
  await fs.writeFile(configPath, prefix + section, "utf-8");
  return true;
}
