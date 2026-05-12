/**
 * PolyPlan MCP — Question Tracker
 *
 * Scans plans for open questions and cross-references whether
 * any other model's plan contains a likely answer.
 *
 * Detection heuristics:
 * - Sentences ending in `?`
 * - Phrases like "unclear if", "need to confirm", "depends on", "TBD", "unknown"
 */

import type { PlanFile, TrackedQuestion } from "../types.js";

/** Phrases that indicate an open question or uncertainty */
const UNCERTAINTY_PHRASES = [
  "unclear if",
  "unclear whether",
  "need to confirm",
  "needs to be confirmed",
  "depends on",
  "depending on",
  "tbd",
  "to be determined",
  "to be decided",
  "unknown",
  "not sure",
  "unsure",
  "need clarification",
  "needs clarification",
  "open question",
  "question:",
  "need to decide",
  "needs to be decided",
  "requires further",
  "need more info",
  "assumption:",
];

/**
 * Extract questions from a plan's content.
 * Returns an array of question strings.
 */
function extractQuestions(content: string): string[] {
  const questions: string[] = [];

  // Split into sentences (rough, but good enough for this purpose)
  const sentences = content.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    // Direct questions ending with ?
    if (trimmed.endsWith("?")) {
      // Skip very short questions (likely not real questions)
      if (trimmed.length > 15) {
        questions.push(trimmed);
      }
      continue;
    }

    // Uncertainty phrases
    const lowerSentence = trimmed.toLowerCase();
    for (const phrase of UNCERTAINTY_PHRASES) {
      if (lowerSentence.includes(phrase)) {
        questions.push(trimmed);
        break; // Don't add the same sentence twice
      }
    }
  }

  return questions;
}

/**
 * Extract key terms from a question for matching against answers.
 * Removes common words to focus on domain-specific terms.
 */
function extractKeyTerms(text: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "as", "into", "through", "during", "before", "after", "above", "below",
    "between", "out", "off", "over", "under", "again", "further", "then",
    "once", "here", "there", "when", "where", "why", "how", "all", "both",
    "each", "few", "more", "most", "other", "some", "such", "no", "nor",
    "not", "only", "own", "same", "so", "than", "too", "very", "just",
    "because", "but", "and", "or", "if", "while", "what", "which", "who",
    "this", "that", "these", "those", "it", "its", "we", "they", "them",
    "their", "our", "your", "my", "he", "she", "him", "her", "i",
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

/**
 * Check if a plan's content likely answers a question.
 * Uses keyword overlap as a heuristic.
 */
function findAnswer(
  question: string,
  planContent: string,
  minOverlap: number = 3
): string | null {
  const questionTerms = extractKeyTerms(question);
  if (questionTerms.length === 0) return null;

  // Split plan content into paragraphs
  const paragraphs = planContent.split(/\n\n+/);

  let bestMatch: { paragraph: string; overlap: number } | null = null;

  for (const paragraph of paragraphs) {
    const paragraphTerms = new Set(extractKeyTerms(paragraph));
    const overlap = questionTerms.filter((term) => paragraphTerms.has(term)).length;

    if (overlap >= minOverlap) {
      if (!bestMatch || overlap > bestMatch.overlap) {
        bestMatch = { paragraph: paragraph.trim(), overlap };
      }
    }
  }

  if (bestMatch) {
    // Return a truncated version of the matching paragraph
    const maxLen = 200;
    const answer = bestMatch.paragraph;
    return answer.length > maxLen
      ? answer.substring(0, maxLen) + "..."
      : answer;
  }

  return null;
}

/**
 * Track questions across all plans.
 * For each question found, check if any other plan has an answer.
 */
export function trackQuestions(plans: PlanFile[]): TrackedQuestion[] {
  const trackedQuestions: TrackedQuestion[] = [];

  for (const plan of plans) {
    const planIdentifier = `${plan.cliTool}-${plan.modelName}`;
    const questions = extractQuestions(plan.content);

    for (const question of questions) {
      const tracked: TrackedQuestion = {
        question,
        raisedBy: planIdentifier,
        answered: false,
      };

      // Check other plans for answers
      for (const otherPlan of plans) {
        if (otherPlan === plan) continue;
        const otherIdentifier = `${otherPlan.cliTool}-${otherPlan.modelName}`;

        const answer = findAnswer(question, otherPlan.content);
        if (answer) {
          tracked.answered = true;
          tracked.answeredBy = otherIdentifier;
          tracked.answerText = answer;
          break; // Take the first answer found
        }
      }

      trackedQuestions.push(tracked);
    }
  }

  return trackedQuestions;
}

/**
 * Format tracked questions as a human-readable string.
 */
export function formatQuestions(
  questions: TrackedQuestion[],
  round: string
): string {
  if (questions.length === 0) {
    return `✅ No open questions detected across ${round} plans.`;
  }

  const lines: string[] = [];
  lines.push(`OPEN QUESTIONS — ${round}`);
  lines.push("");

  questions.forEach((q, index) => {
    const shortQuestion =
      q.question.length > 100
        ? q.question.substring(0, 100) + "..."
        : q.question;

    lines.push(`[Q${index + 1}] "${shortQuestion}" (raised by: ${q.raisedBy})`);

    if (q.answered) {
      lines.push(`     → ANSWERED by: ${q.answeredBy}`);
      if (q.answerText) {
        const shortAnswer =
          q.answerText.length > 120
            ? q.answerText.substring(0, 120) + "..."
            : q.answerText;
        lines.push(`       "${shortAnswer}"`);
      }
    } else {
      lines.push("     → UNANSWERED — no model addressed this");
      lines.push("     ⚠ Flag for human input before Final round");
    }
    lines.push("");
  });

  const unanswered = questions.filter((q) => !q.answered).length;
  const answered = questions.filter((q) => q.answered).length;

  lines.push(`Summary: ${answered} answered, ${unanswered} unanswered out of ${questions.length} total questions.`);

  return lines.join("\n");
}
