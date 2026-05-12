/**
 * PolyPlan MCP — Shared TypeScript Types
 *
 * All types used across the PolyPlan MCP server.
 */

// ─── Round Identifiers ──────────────────────────────────────────────────────

/** The three planning rounds */
export type Round = "round1" | "round2" | "final";

/** Human-readable round labels */
export const ROUND_LABELS: Record<Round, string> = {
  round1: "Round 1 — Individual Plans",
  round2: "Round 2 — Peer Review Plans",
  final: "Final — Synthesis",
};

// ─── Plan File ──────────────────────────────────────────────────────────────

/** Parsed info from a plan filename like round1-copilot-sonnet4.6.md */
export interface PlanFileInfo {
  /** The round this plan belongs to */
  round: Round;
  /** CLI tool identifier (e.g., "copilot", "claudecode", "opencode") */
  cliTool: string;
  /** Model name (e.g., "sonnet4.6", "gpt4o", "gemini2.5") */
  modelName: string;
  /** Full filename (e.g., "round1-copilot-sonnet4.6.md") */
  filename: string;
}

/** A plan file with its content loaded */
export interface PlanFile extends PlanFileInfo {
  /** The markdown content of the plan */
  content: string;
  /** File creation/modification timestamp */
  timestamp: Date;
}

// ─── Session / Config ──────────────────────────────────────────────────────

/** Project config stored in .polyplan/config.json */
export interface PolyPlanConfig {
  /** Human-readable project name */
  projectName: string;
  /** When the session was first created */
  createdAt: string;
  /** Current active problem description (set in Round 1) */
  problemDescription?: string;
}

// ─── Model Detection ───────────────────────────────────────────────────────

/** Detected identity of the calling CLI tool + model */
export interface CallerIdentity {
  /** CLI tool name (e.g., "claudecode", "copilot", "opencode", "codex", "antigravity", "cursor") */
  cliTool: string;
  /** Model name (e.g., "sonnet4.6", "opus4.6", "gpt4o") */
  modelName: string;
}

// ─── History / Audit Log ───────────────────────────────────────────────────

/** A single entry in the history log */
export interface HistoryEntry {
  /** ISO timestamp */
  timestamp: string;
  /** Which CLI tool performed the action */
  cliTool: string;
  /** Which model was active */
  modelName: string;
  /** Which round or command */
  action: string;
  /** Human-readable details */
  details: string;
}

// ─── Conflict Detection ────────────────────────────────────────────────────

/** A single detected conflict across plans */
export interface Conflict {
  /** Conflict category (e.g., "Database Choice", "Auth Strategy") */
  category: string;
  /** Map of model identifier → their position/choice */
  positions: Record<string, string>;
  /** Summary of the majority view */
  summary: string;
}

// ─── Question Tracking ─────────────────────────────────────────────────────

/** A question raised in a plan */
export interface TrackedQuestion {
  /** The question text */
  question: string;
  /** Who raised it (e.g., "copilot-sonnet4.6") */
  raisedBy: string;
  /** Whether it was answered by another model */
  answered: boolean;
  /** Who answered it, if answered */
  answeredBy?: string;
  /** The answer text, if found */
  answerText?: string;
}

// ─── Status ────────────────────────────────────────────────────────────────

/** Status of a single round */
export interface RoundStatus {
  /** Plans that exist for this round */
  plans: PlanFileInfo[];
  /** Whether this round has any plans */
  hasPlans: boolean;
}

/** Full session status */
export interface SessionStatus {
  /** Project name */
  projectName: string;
  /** Session start time */
  sessionStarted: string;
  /** Status of each round */
  rounds: Record<Round, RoundStatus>;
  /** Count of open questions detected */
  openQuestionCount: number;
  /** Count of conflicts detected */
  conflictCount: number;
}

// ─── Model Switch Detection ────────────────────────────────────────────────

/** Result of model switch detection */
export interface ModelSwitchResult {
  /** Whether a switch was detected */
  switchDetected: boolean;
  /** The previous model name, if switched */
  previousModel?: string;
  /** The current model name */
  currentModel: string;
  /** The CLI tool */
  cliTool: string;
  /** Existing plan filename that would conflict */
  existingFile?: string;
}

/** Options for handling a model switch */
export type ModelSwitchAction = "save_separate" | "replace" | "cancel";

// ─── Tool Input Schemas ────────────────────────────────────────────────────

/** Input for the round1 tool */
export interface Round1Input {
  /** The problem/requirement description */
  problemDescription: string;
  /** Optional explicit model name override */
  modelName?: string;
  /** The generated plan content from the model */
  plan: string;
}

/** Input for the round2 tool */
export interface Round2Input {
  /** Optional explicit model name override */
  modelName?: string;
  /** The generated plan content from the model */
  plan: string;
}

/** Input for the final tool */
export interface FinalInput {
  /** Optional explicit model name override */
  modelName?: string;
  /** The generated plan content from the model */
  plan: string;
}

/** Input for the clear tool */
export interface ClearInput {
  /** Which round to clear, or "all" for everything */
  target: Round | "all";
  /** Confirmation flag — must be true to proceed */
  confirm: boolean;
}

/** Input for the diff tool */
export interface DiffInput {
  /** Model identifier to diff (e.g., "copilot-sonnet4.6") */
  model: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

/** Directory name for plan files */
export const PLANS_DIR = ".plans";

/** Directory name for polyplan config */
export const POLYPLAN_DIR = ".polyplan";

/** Config file path (relative to project root) */
export const CONFIG_FILE = ".polyplan/config.json";

/** History log file path (relative to project root) */
export const HISTORY_FILE = ".polyplan/history.log";

/** Plan filename pattern: round-clitool-modelname.md */
export const PLAN_FILENAME_REGEX = /^(round1|round2|final)-(.+)-(.+)\.md$/;
