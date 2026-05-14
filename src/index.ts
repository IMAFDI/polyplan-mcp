#!/usr/bin/env node

/**
 * PolyPlan MCP — Entry Point
 *
 * CLI modes:
 * 1. `polyplan-mcp init`     — Initialize .plans/ and .polyplan/
 * 2. `polyplan-mcp --version` — Print version
 * 3. MCP mode (default)      — stdio transport
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createServer } from "./server.js";
import { initProject } from "./core/session.js";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = require(path.join(__dirname, "../package.json")) as { version: string };

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let projectRoot = process.cwd();
  const projectIdx = args.indexOf("--project");
  if (projectIdx !== -1 && args[projectIdx + 1]) {
    projectRoot = path.resolve(args[projectIdx + 1]);
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log(pkg.version);
    return;
  }

  if (args.includes("init")) {
    await handleInit(projectRoot);
    return;
  }

  await startMcpServer(projectRoot);
}

async function handleInit(projectRoot: string): Promise<void> {
  const { config, wasAlreadyInitialized } = await initProject(projectRoot);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(wasAlreadyInitialized ? "✓ PolyPlan re-initialized" : "✓ PolyPlan initialized");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  console.log("");
  console.log(`📁 Project: ${config.projectName}`);
  console.log("");
  console.log("Created:");
  console.log("  ✓ .plans/");
  console.log("  ✓ .polyplan/config.json");
  console.log("  ✓ .polyplan/WORKFLOWS.md");
  console.log("  ✓ .gitignore updated");
  console.log("");
  console.log("PolyPlan is an MCP server with 16 registered tools.");
  console.log("All MCP-compatible CLI tools can discover them automatically.");
  console.log("");
  console.log("Start planning by asking your CLI tool:");
  console.log('  "Call the polyplan round_1 tool with: your problem description"');
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

async function startMcpServer(projectRoot: string): Promise<void> {
  const server = createServer(projectRoot);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("PolyPlan MCP Error:", error);
  process.exit(1);
});
