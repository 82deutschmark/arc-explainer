/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-15
 * PURPOSE: Extract structured explanations from Johan_Land reasoning summaries.
 *          Parses judge feedback sections and problem-solving reasoning to populate
 *          pattern_description and solving_strategy database fields.
 * SRP/DRY check: Pass - Single responsibility (text extraction/parsing)
 */

import type { ExtractedExplanation } from '../types/johanland.ts';

/**
 * Parse reasoning_summary into structured components
 *
 * Johan_Land summaries have two main sections:
 * --- JUDGE FEEDBACK ---
 * Judge Rule Summary: [rule description]
 * Judge Audit Summary: [audit description]
 * Judge Consistency Check: [consistency check result]
 *
 * --- EXAMPLE REASONING ---
 * [Detailed step-by-step reasoning]
 */
export function parseReasoningSummary(reasoningSummary: string): ExtractedExplanation {
  const full = cleanReasoningSummary(reasoningSummary);

  // Extract judge feedback section
  const judgeFeedbackMatch = full.match(
    /---\s*JUDGE\s+FEEDBACK\s*---\n([\s\S]*?)(?=---\s*EXAMPLE|---\s*REASONING|$)/i
  );
  const judgeFeedback = judgeFeedbackMatch ? judgeFeedbackMatch[1].trim() : '';

  // Extract example reasoning section
  const exampleMatch = full.match(
    /---\s*EXAMPLE\s+REASONING\s*---\n([\s\S]*?)$/i
  );
  const exampleReasoning = exampleMatch ? exampleMatch[1].trim() : full;

  // Extract pattern description: First substantial paragraph from example reasoning
  const patternDescription = extractFirstParagraph(exampleReasoning, 100, 500);

  // Extract solving strategy: Judge rule summary (preferred) or key approach from example
  const solvingStrategy = extractSolvingStrategy(exampleReasoning, judgeFeedback);

  return {
    pattern_description: patternDescription,
    solving_strategy: solvingStrategy,
    judge_feedback: judgeFeedback,
    full_reasoning: full
  };
}

/**
 * Extract the first substantial paragraph from text
 * Used for pattern_description field
 */
export function extractFirstParagraph(text: string, minLength: number, maxLength: number): string {
  // Split by double newlines or multiple spaces to find paragraphs
  const paragraphs = text.split(/\n\n+|\r\n\r\n+/).filter((p) => p.trim().length > 0);

  if (paragraphs.length === 0) {
    return text.substring(0, maxLength).trim();
  }

  // Find first substantial paragraph
  for (const para of paragraphs) {
    const cleaned = para.trim().replace(/\s+/g, ' ');

    // Skip very short paragraphs
    if (cleaned.length >= minLength) {
      // Return up to maxLength characters
      if (cleaned.length > maxLength) {
        // Find a good break point (end of sentence)
        const truncated = cleaned.substring(0, maxLength);
        const lastPeriod = truncated.lastIndexOf('.');
        const lastComma = truncated.lastIndexOf(',');
        const breakPoint = Math.max(lastPeriod, lastComma);

        if (breakPoint > minLength) {
          return cleaned.substring(0, breakPoint + 1);
        }

        return truncated.trim();
      }

      return cleaned;
    }
  }

  // Fallback: return first paragraph
  return paragraphs[0].trim().substring(0, maxLength);
}

/**
 * Extract solving strategy from judge feedback or example reasoning
 */
export function extractSolvingStrategy(exampleReasoning: string, judgeFeedback: string): string {
  // Priority 1: Extract "Judge Rule Summary" from judge feedback
  if (judgeFeedback.length > 0) {
    const ruleSummaryMatch = judgeFeedback.match(/Judge\s+Rule\s+Summary:?\s*([^\n]+(?:\n(?!Judge|---)[^\n]*)*)/i);
    if (ruleSummaryMatch) {
      const summary = ruleSummaryMatch[1].trim().replace(/\s+/g, ' ');
      if (summary.length > 20 && summary.length < 2000) {
        return summary.substring(0, 1500); // Limit to reasonable length
      }
    }
  }

  // Priority 2: Extract from "My Plan" or "Algorithm" sections
  const planMatch = exampleReasoning.match(/(?:My\s+Plan|Algorithm|Steps?|Approach)[\s:]*\n([\s\S]{0,1000}?)(?:\n\n|\*\*|---|\n[A-Z]|$)/i);
  if (planMatch) {
    return planMatch[1].trim().substring(0, 1500);
  }

  // Priority 3: Extract first bulleted/numbered list
  const listMatch = exampleReasoning.match(/((?:[-*]\s+.+(?:\n|$)){2,})/);
  if (listMatch) {
    return listMatch[1].trim().substring(0, 1500);
  }

  // Priority 4: Extract first few sentences that contain strategy keywords
  const strategicMatch = exampleReasoning.match(/[^.!?]*(?:identify|transform|count|pattern|rule|map|place|locate|repeat|tile|cycle)[^.!?]*[.!?]/gi);
  if (strategicMatch && strategicMatch.length > 0) {
    return strategicMatch.slice(0, 3).join(' ').substring(0, 1500);
  }

  // Fallback: Return first 1500 chars of example reasoning
  return exampleReasoning.substring(0, 1500);
}

/**
 * Clean and normalize reasoning summary text
 * Handles different line endings and whitespace
 */
export function cleanReasoningSummary(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Normalize tabs to spaces
    .replace(/\t/g, '  ')
    // Remove trailing whitespace from lines
    .split('\n')
    .map((line) => line.trimRight())
    .join('\n')
    // Remove excessive blank lines
    .replace(/\n{4,}/g, '\n\n\n')
    // Trim start and end
    .trim();
}

/**
 * Extract just the judge audit summary
 */
export function extractJudgeAuditSummary(judgeFeedback: string): string {
  const match = judgeFeedback.match(/Judge\s+Audit\s+Summary:?\s*([^\n]+(?:\n(?!Judge|---)[^\n]*)*)/i);
  if (match) {
    return match[1].trim().replace(/\s+/g, ' ');
  }
  return '';
}

/**
 * Extract judge consistency check result
 */
export function extractConsistencyCheck(judgeFeedback: string): string {
  const match = judgeFeedback.match(/Judge\s+Consistency\s+Check:?\s*([^\n]+)/i);
  if (match) {
    return match[1].trim();
  }
  return '';
}

/**
 * Format reasoning summary for display with section markers
 */
export function formatReasoningSummaryForDisplay(extracted: ExtractedExplanation): string {
  let output = '';

  if (extracted.judge_feedback) {
    output += '=== JUDGE FEEDBACK ===\n';
    output += extracted.judge_feedback + '\n\n';
  }

  if (extracted.pattern_description) {
    output += '=== PATTERN DESCRIPTION ===\n';
    output += extracted.pattern_description + '\n\n';
  }

  if (extracted.solving_strategy) {
    output += '=== SOLVING STRATEGY ===\n';
    output += extracted.solving_strategy + '\n\n';
  }

  output += '=== FULL REASONING ===\n';
  output += extracted.full_reasoning;

  return output;
}

/**
 * Check if reasoning_summary appears to have meaningful content
 */
export function isReasoningSummaryMeaningful(summary: string): boolean {
  if (!summary || typeof summary !== 'string') {
    return false;
  }

  const cleaned = summary.trim();

  // Check if it's just "NA" or empty
  if (cleaned === 'NA' || cleaned === '' || cleaned.length < 50) {
    return false;
  }

  // Check if it has some structure (sections, sentences, etc.)
  return cleaned.includes('\n') || cleaned.length > 100;
}
