/*
Author: Claude Code using Sonnet 4.5
Date: 2025-11-06
PURPOSE: Extract and parse agent narration from OpenAI Responses API messages.
Detects "What I see / What it means / Next move" narrative structure and final reports.
Helps verify agent follows its own reasoning before taking actions.
SRP/DRY check: Pass — focused solely on extracting narrative structure from agent messages.
*/

/**
 * Represents a structured narration section from the agent
 */
export interface NarrationSection {
  whatISee: string;
  whatItMeans: string;
  nextMove: string;
  timestamp?: Date;
}

/**
 * Represents a complete narration entry with metadata
 */
export interface NarrationEntry {
  type: 'reasoning' | 'final_report' | 'observation';
  content: string;
  sections?: NarrationSection;
  timestamp: Date;
}

/**
 * Extract narrative sections from agent message content
 * Looks for "What I see:", "What it means:", "Next move:" patterns
 * @param content - Raw message content from agent
 * @returns Parsed narration section or null if no structure found
 */
export function extractNarrationSections(content: string): NarrationSection | null {
  const sections: NarrationSection = {
    whatISee: '',
    whatItMeans: '',
    nextMove: '',
  };

  // Match "What I see:" pattern (case-insensitive, flexible punctuation)
  const seeMatch = content.match(/What I see:?\s*(.+?)(?=What it means:|What it means|Next move:|$)/is);
  if (seeMatch) {
    sections.whatISee = seeMatch[1].trim();
  }

  // Match "What it means:" pattern
  const meansMatch = content.match(/What it means:?\s*(.+?)(?=Next move:|Next move|$)/is);
  if (meansMatch) {
    sections.whatItMeans = meansMatch[1].trim();
  }

  // Match "Next move:" pattern
  const moveMatch = content.match(/Next move:?\s*(.+?)$/is);
  if (moveMatch) {
    sections.nextMove = moveMatch[1].trim();
  }

  // Only return if we found at least one section
  if (sections.whatISee || sections.whatItMeans || sections.nextMove) {
    return sections;
  }

  return null;
}

/**
 * Detect if content contains a final report
 * @param content - Message content
 * @returns True if this appears to be a final report
 */
export function isFinalReport(content: string): boolean {
  const finalReportKeywords = [
    'final report',
    'final summary',
    'game complete',
    'game over',
    'victory achieved',
    'puzzle solved'
  ];

  const lowerContent = content.toLowerCase();
  return finalReportKeywords.some(keyword => lowerContent.includes(keyword));
}

/**
 * Extract narration entries from a raw message content string
 * @param content - Raw message content
 * @returns NarrationEntry with structured sections if found
 */
export function extractNarration(content: string): NarrationEntry | null {
  if (!content || content.trim().length === 0) {
    return null;
  }

  // Check for final report
  if (isFinalReport(content)) {
    return {
      type: 'final_report',
      content: content.trim(),
      timestamp: new Date()
    };
  }

  // Try to extract structured narration
  const sections = extractNarrationSections(content);

  if (sections) {
    return {
      type: 'reasoning',
      content: content.trim(),
      sections,
      timestamp: new Date()
    };
  }

  // Otherwise treat as general observation
  return {
    type: 'observation',
    content: content.trim(),
    timestamp: new Date()
  };
}

/**
 * Format a narration section for display
 * @param section - Narration section to format
 * @returns Formatted string for UI display
 */
export function formatNarrationSection(section: NarrationSection): string {
  const parts: string[] = [];

  if (section.whatISee) {
    parts.push(`**What I see:** ${section.whatISee}`);
  }

  if (section.whatItMeans) {
    parts.push(`**What it means:** ${section.whatItMeans}`);
  }

  if (section.nextMove) {
    parts.push(`**Next move:** ${section.nextMove}`);
  }

  return parts.join('\n\n');
}
