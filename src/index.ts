#!/usr/bin/env node

/**
 * PolyPlan MCP — Entry Point
 *
 * Handles CLI modes:
 * 1. `polyplan-mcp init` — Initialize project
 * 2. `polyplan-mcp enable <client>` — Enable client integration
 * 3. `polyplan-mcp disable <client>` — Disable client integration
 * 4. `polyplan-mcp sync` — Regenerate enabled client files
 * 5. MCP mode: stdio transport for CLI tool connections
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createServer } from "./server.js";
import { initProject, isInitialized } from "./core/session.js";
import { detectAndInstallMcp } from "./core/mcpInstaller.js";
import {
  enableClient,
  disableClient,
  syncClients,
  formatEnableResult,
  formatDisableResult,
  formatSyncResult,
} from "./core/clientManager.js";
import type { SupportedClient } from "./types.js";

// Read version from package.json without bundling issues
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = require(path.join(__dirname, "../package.json")) as { version: string };

const VALID_CLIENTS: SupportedClient[] = ["claude", "cursor", "copilot", "opencode", "vscode", "all"];

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Determine project root from --project arg or cwd
  let projectRoot = process.cwd();
  const projectIdx = args.indexOf("--project");
  if (projectIdx !== -1 && args[projectIdx + 1]) {
    projectRoot = path.resolve(args[projectIdx + 1]);
  }

  // Handle CLI commands
  if (args.includes("--version") || args.includes("-v")) {
    console.log(pkg.version);
    return;
  }

  if (args.includes("init")) {
    await handleInit(projectRoot);
    return;
  }

  if (args.includes("enable")) {
    const clientIdx = args.indexOf("enable") + 1;
    const client = args[clientIdx] as SupportedClient | undefined;
    await handleEnable(projectRoot, client);
    return;
  }

  if (args.includes("disable")) {
    const clientIdx = args.indexOf("disable") + 1;
    const client = args[clientIdx] as SupportedClient | undefined;
    await handleDisable(projectRoot, client);
    return;
  }

  if (args.includes("sync")) {
    await handleSync(projectRoot);
    return;
  }

  // Default: start MCP server with stdio transport
  await startMcpServer(projectRoot);
}

/**
 * Handle the `polyplan-mcp init` command.
 */
async function handleInit(projectRoot: string): Promise<void> {
  const already = await isInitialized(projectRoot);
  let cleaned: string[] = [];

  if (!already) {
    const result = await initProject(projectRoot);
    cleaned = result.cleaned;
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (!already) {
    console.log("✓ PolyPlan initialized");
  } else {
    console.log("✓ PolyPlan project updated");
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (cleaned.length > 0) {
    console.log("✓ Cleaned up legacy polyplan files");
  }
  if (!already) {
    console.log("Created:");
    console.log("  .plans/");
    console.log("  .polyplan/");
    console.log("  .polyplan/config.json");
    console.log("  .polyplan/WORKFLOWS.md");
    console.log("");
  }

  console.log("Detecting installed AI coding tools...");
  const { configured, alreadyConfigured } = await detectAndInstallMcp(projectRoot);
  
  console.log("");
  if (configured.length > 0) {
    console.log(`✓ Auto-registered PolyPlan MCP server in ${configured.length} tools:`);
    for (const tool of configured) {
      console.log(`  - ${tool}`);
    }
  } else if (alreadyConfigured.length > 0) {
    console.log(`✓ PolyPlan MCP server is already registered in ${alreadyConfigured.length} tools.`);
  } else {
    console.log("⚠ No supported AI coding tools detected.");
  }
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}


/**
 * Handle the `polyplan-mcp enable <client>` command.
 */
async function handleEnable(projectRoot: string, client?: SupportedClient): Promise<void> {
  if (!client || !VALID_CLIENTS.includes(client)) {
    console.error(`Usage: polyplan-mcp enable <client>`);
    console.error(`Valid clients: ${VALID_CLIENTS.join(", ")}`);
    process.exit(1);
  }

  const initialized = await isInitialized(projectRoot);
  if (!initialized) {
    console.error("PolyPlan is not initialized. Run `polyplan-mcp init` first.");
    process.exit(1);
  }

  const results = await enableClient(projectRoot, client);
  console.log(`✓ Enabled: ${client}`);
  console.log(formatEnableResult(results));
  console.log("");
  console.log("  .gitignore updated to exclude generated files.");
}

/**
 * Handle the `polyplan-mcp disable <client>` command.
 */
async function handleDisable(projectRoot: string, client?: SupportedClient): Promise<void> {
  if (!client || !VALID_CLIENTS.includes(client)) {
    console.error(`Usage: polyplan-mcp disable <client>`);
    console.error(`Valid clients: ${VALID_CLIENTS.join(", ")}`);
    process.exit(1);
  }

  const initialized = await isInitialized(projectRoot);
  if (!initialized) {
    console.error("PolyPlan is not initialized. Run `polyplan-mcp init` first.");
    process.exit(1);
  }

  const results = await disableClient(projectRoot, client);
  console.log(`✓ Disabled: ${client}`);
  console.log(formatDisableResult(results));
}

/**
 * Handle the `polyplan-mcp sync` command.
 */
async function handleSync(projectRoot: string): Promise<void> {
  const initialized = await isInitialized(projectRoot);
  if (!initialized) {
    console.error("PolyPlan is not initialized. Run `polyplan-mcp init` first.");
    process.exit(1);
  }

  const result = await syncClients(projectRoot);
  console.log("✓ Sync complete");
  console.log(formatSyncResult(result));
}

/**
 * Start the MCP server with stdio transport.
 */
async function startMcpServer(projectRoot: string): Promise<void> {
  const server = createServer(projectRoot);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Run
main().catch((error) => {
  console.error("PolyPlan MCP Error:", error);
  process.exit(1);
});
