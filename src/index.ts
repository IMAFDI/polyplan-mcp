#!/usr/bin/env node

/**
 * PolyPlan MCP — Entry Point
 *
 * Handles two modes:
 * 1. CLI mode: `polyplan-mcp init` — Initialize project
 * 2. MCP mode: stdio transport for CLI tool connections
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createServer } from "./server.js";
import { initProject, isInitialized } from "./core/session.js";
import { ensureClientCompatibility } from "./compat/clientSetup.js";

// Read version from package.json without bundling issues
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = require(path.join(__dirname, "../package.json")) as { version: string };

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

  // Default: start MCP server with stdio transport
  await startMcpServer(projectRoot);
}

/**
 * Handle the `polyplan-mcp init` command.
 */
async function handleInit(projectRoot: string): Promise<void> {
  const already = await isInitialized(projectRoot);
  if (already) {
    const setup = await ensureClientCompatibility(projectRoot);
    console.log("PolyPlan is already initialized in this project.");
    console.log(`  📁 Project root: ${projectRoot}`);
    console.log(`  🔌 Compatibility files: ${setup.created.length} created, ${setup.updated.length} updated`);
    return;
  }

  const config = await initProject(projectRoot);
  const setup = await ensureClientCompatibility(projectRoot);

  console.log("");
  console.log("  ✅ PolyPlan initialized!");
  console.log("");
  console.log(`  📁 Project: ${config.projectName}`);
  console.log(`  📂 Created .plans/`);
  console.log(`  📂 Created .polyplan/config.json`);
  console.log(`  🔌 Created compatibility files: ${setup.created.length}`);
  console.log(`  📝 Updated .gitignore`);
  console.log("");
  console.log("  Next steps:");
  console.log("  1. Restart your AI coding CLI/editor");
  console.log("  2. Run /polyplan status or /show_status");
  console.log("");
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
