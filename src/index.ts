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
import { createServer } from "./server.js";
import { initProject, isInitialized } from "./core/session.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Determine project root from --project arg or cwd
  let projectRoot = process.cwd();
  const projectIdx = args.indexOf("--project");
  if (projectIdx !== -1 && args[projectIdx + 1]) {
    projectRoot = path.resolve(args[projectIdx + 1]);
  }

  // Handle CLI commands
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
    console.log("PolyPlan is already initialized in this project.");
    console.log(`  📁 Project root: ${projectRoot}`);
    return;
  }

  const config = await initProject(projectRoot);

  console.log("");
  console.log("  ✅ PolyPlan initialized!");
  console.log("");
  console.log(`  📁 Project: ${config.projectName}`);
  console.log(`  📂 Created .plans/`);
  console.log(`  📂 Created .polyplan/config.json`);
  console.log(`  📝 Updated .gitignore`);
  console.log("");
  console.log("  Next steps:");
  console.log("  1. Add polyplan-mcp to your CLI tool's MCP config");
  console.log("  2. Run /polyplan round1 \"your problem\" in each CLI tool");
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
