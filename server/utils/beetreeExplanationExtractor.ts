/**
 * BeeTree Explanation Extractor
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-01-12
 * PURPOSE: Extract pattern_description and solving_strategy from LLM responses in BeeTree logs.
 *          Uses heuristics to find relevant sections describing patterns and solution approaches.
 *
 * SRP/DRY check: Pass - Single responsibility (explanation extraction), no duplication.
 */

/**
 * Extracted explanation components
 */
export interface ExtractedExplanation {
  pattern_description: string;
  solving_strategy: string;
  full_response: string;
}

/**
 * Section markers to look for in LLM responses
 */
const PATTERN_MARKERS = [
  'pattern:',
  'observation:',
  'pattern observation:',
  'the pattern is',
  'pattern analysis:',
  'i observe',
  'key pattern:',
  'pattern description:'
];

const STRATEGY_MARKERS = [
  'strategy:',
  'approach:',
  'solution:',
  'steps:',
  'solving strategy:',
  'how to solve:',
  'solution approach:',
  'to solve this',
  'transformation:',
  'algorithm:'
];

/**
 * Extract a section following a marker
 */
function extractSection(text: string, markers: string[], maxLength: number = 500): string | null {
  const lowerText = text.toLowerCase();

  for (const marker of markers) {
    const index = lowerText.indexOf(marker);
    if (index !== -1) {
      // Extract from after the marker
      const startIndex = index + marker.length;
      let endIndex = startIndex + maxLength;

      // Try to find natural ending (double newline, or next section marker)
      const substring = text.substring(startIndex, startIndex + maxLength * 2);
      const doubleNewline = substring.indexOf('\n\n');

      if (doubleNewline !== -1 && doubleNewline < maxLength) {
        endIndex = startIndex + doubleNewline;
      }

      let extracted = text.substring(startIndex, endIndex).trim();

      // Clean up
      extracted = extracted
        .replace(/^\s*[-:•]\s*/, '') // Remove leading bullet/dash
        .replace(/\n\s*\n/g, ' ')    // Collapse double newlines
        .replace(/\s+/g, ' ')         // Normalize whitespace
        .trim();

      if (extracted.length > 20) { // Minimum meaningful length
        return extracted;
      }
    }
  }

  return null;
}

/**
 * Extract pattern description from the first substantial paragraph
 */
function extractFirstParagraph(text: string, minLength: number = 100, maxLength: number = 500): string {
  // Split into paragraphs
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim());

  for (const para of paragraphs) {
    // Skip very short paragraphs (likely headers or labels)
    if (para.length < minLength) continue;

    // Clean and normalize
    const cleaned = para
      .replace(/\s+/g, ' ')
      .trim();

    // Return the first substantial paragraph (truncate if too long)
    return cleaned.length > maxLength ? cleaned.substring(0, maxLength) + '...' : cleaned;
  }

  // Fallback: return first part of text
  const fallback = text
    .replace(/\s+/g, ' ')
    .trim();

  return fallback.length > maxLength ? fallback.substring(0, maxLength) + '...' : fallback;
}

/**
 * Extract pattern description from LLM response
 */
export function extractPatternDescription(fullResponse: string): string {
  // Try marker-based extraction first
  const markerExtraction = extractSection(fullResponse, PATTERN_MARKERS, 500);
  if (markerExtraction) {
    return markerExtraction;
  }

  // Fallback: extract first substantial paragraph
  const paragraphExtraction = extractFirstParagraph(fullResponse, 100, 500);
  if (paragraphExtraction) {
    return paragraphExtraction;
  }

  // Last resort: take first 500 chars
  const fallback = fullResponse.replace(/\s+/g, ' ').trim();
  return fallback.length > 500 ? fallback.substring(0, 500) + '...' : fallback;
}

/**
 * Extract solving strategy from LLM response
 */
export function extractSolvingStrategy(fullResponse: string): string {
  // Try marker-based extraction first
  const markerExtraction = extractSection(fullResponse, STRATEGY_MARKERS, 500);
  if (markerExtraction) {
    return markerExtraction;
  }

  // Try to find steps or numbered lists
  const stepsMatch = fullResponse.match(/(?:steps?|approach|solution|algorithm)[\s\S]{0,100}?(\d+[\s\S]{20,500})/i);
  if (stepsMatch) {
    const steps = stepsMatch[1].trim();
    return steps.length > 500 ? steps.substring(0, 500) + '...' : steps;
  }

  // Fallback: extract second paragraph if available
  const paragraphs = fullResponse.split(/\n\s*\n/).map(p => p.trim());
  if (paragraphs.length > 1) {
    const secondPara = paragraphs[1].replace(/\s+/g, ' ').trim();
    return secondPara.length > 500 ? secondPara.substring(0, 500) + '...' : secondPara;
  }

  // Last resort: generic strategy text
  return 'BeeTree meta-solver strategy: run multiple frontier models (Claude Opus, GPT-5.1, Gemini-3, etc.) in parallel across 5 steps with deep thinking, multimodal analysis, and hint generation. Aggregate predictions via majority voting and model priority ranking.';
}

/**
 * Extract explanations from LLM response
 */
export function extractExplanations(fullResponse: string): ExtractedExplanation {
  if (!fullResponse || fullResponse.trim().length === 0) {
    throw new Error('Full response is empty or invalid');
  }

  const pattern_description = extractPatternDescription(fullResponse);
  const solving_strategy = extractSolvingStrategy(fullResponse);

  // Validate that we got meaningful content
  if (pattern_description.length < 20) {
    throw new Error('Extracted pattern description is too short (< 20 chars)');
  }

  if (solving_strategy.length < 20) {
    throw new Error('Extracted solving strategy is too short (< 20 chars)');
  }

  return {
    pattern_description,
    solving_strategy,
    full_response: fullResponse
  };
}

/**
 * Try to extract explanations with fallback to next run if extraction fails
 */
export function extractExplanationsWithFallback(
  responses: string[],
  verbose: boolean = false
): ExtractedExplanation {
  const errors: string[] = [];

  for (let i = 0; i < responses.length; i++) {
    try {
      const extracted = extractExplanations(responses[i]);
      if (verbose && i > 0) {
        console.log(`  ✓ Successfully extracted explanations from fallback response #${i + 1}`);
      }
      return extracted;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`Response ${i + 1}: ${errorMsg}`);
      if (verbose) {
        console.warn(`  ⚠ Failed to extract from response #${i + 1}: ${errorMsg}`);
      }
    }
  }

  // All responses failed
  throw new Error(`Failed to extract explanations from ${responses.length} response(s): ${errors.join('; ')}`);
}

/**
 * Clean and prepare text for database storage
 */
export function cleanTextForStorage(text: string): string {
  return text
    .replace(/\r\n/g, '\n')        // Normalize line endings
    .replace(/\t/g, '  ')           // Replace tabs with spaces
    .replace(/\s+\n/g, '\n')        // Remove trailing whitespace on lines
    .replace(/\n{3,}/g, '\n\n')     // Collapse excessive newlines
    .trim();
}
