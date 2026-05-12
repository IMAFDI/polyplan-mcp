/**
 * PolyPlan MCP — History Logger
 *
 * Append-only audit log at .polyplan/history.log.
 * Captures every action with timestamp, CLI tool, model, round, and details.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { HISTORY_FILE, type HistoryEntry } from "../types.js";
import { ensurePolyPlanDir } from "./session.js";

/**
 * Format a history entry as a single log line.
 */
function formatEntry(entry: HistoryEntry): string {
  return `[${entry.timestamp}] [${entry.cliTool}/${entry.modelName}] ${entry.action} — ${entry.details}`;
}

/**
 * Parse a log line back into a HistoryEntry.
 */
function parseEntry(line: string): HistoryEntry | null {
  const match = line.match(
    /^\[(.+?)\] \[(.+?)\/(.+?)\] (.+?) — (.+)$/
  );
  if (!match) return null;

  return {
    timestamp: match[1],
    cliTool: match[2],
    modelName: match[3],
    action: match[4],
    details: match[5],
  };
}

/**
 * Append a new entry to the history log.
 */
export async function logAction(
  projectRoot: string,
  cliTool: string,
  modelName: string,
  action: string,
  details: string
): Promise<void> {
  await ensurePolyPlanDir(projectRoot);
  const logPath = path.join(projectRoot, HISTORY_FILE);

  const entry: HistoryEntry = {
    timestamp: new Date().toISOString(),
    cliTool,
    modelName,
    action,
    details,
  };

  const line = formatEntry(entry) + "\n";
  await fs.appendFile(logPath, line, "utf-8");
}

/**
 * Read all history entries from the log.
 */
export async function readHistory(projectRoot: string): Promise<HistoryEntry[]> {
  const logPath = path.join(projectRoot, HISTORY_FILE);

  try {
    const content = await fs.readFile(logPath, "utf-8");
    return content
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map(parseEntry)
      .filter((entry): entry is HistoryEntry => entry !== null);
  } catch {
    return [];
  }
}

/**
 * Get the full raw history log as a string.
 */
export async function readHistoryRaw(projectRoot: string): Promise<string> {
  const logPath = path.join(projectRoot, HISTORY_FILE);

  try {
    return await fs.readFile(logPath, "utf-8");
  } catch {
    return "No history yet.";
  }
}
