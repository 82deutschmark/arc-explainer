/**
 * @file server/utils/JsonParser.ts
 * @description Unified JSON parsing utility with comprehensive error handling.
 *
 * This singleton class provides a robust, centralized solution for parsing JSON from various string formats.
 * It eliminates the need for scattered, duplicate `JSON.parse` calls and error handling logic across the codebase.
 * Its key responsibilities are:
 *  - Attempting direct parsing of clean JSON strings.
 *  - Extracting and parsing JSON embedded in code blocks (e.g., ```json...```).
 *  - Finding and extracting the first complete JSON object from a mixed-content string.
 *  - Providing specialized methods for parsing specific data structures, like grids.
 *
 * @assessed_by Gemini 2.5 Pro
 * @assessed_on 2025-09-09
 */

export interface JsonParseResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  method?: string;
  rawInput?: string;
}

export interface ParseOptions {
  preserveRawInput?: boolean;
  allowPartialExtraction?: boolean;
  gridValidation?: boolean;
  logErrors?: boolean;
  fieldName?: string;
}

export class JsonParser {
  private static instance: JsonParser;
  
  private constructor() {}
  
  static getInstance(): JsonParser {
    if (!JsonParser.instance) {
      JsonParser.instance = new JsonParser();
    }
    return JsonParser.instance;
  }

  /**
   * Primary parsing method - handles all JSON extraction scenarios
   */
  parse<T = any>(input: string | any, options: ParseOptions = {}): JsonParseResult<T> {
    const {
      preserveRawInput = true,
      allowPartialExtraction = true,
      gridValidation = false,
      logErrors = true,
      fieldName
    } = options;

    // Handle non-string input
    if (typeof input !== 'string') {
      if (input === null || input === undefined) {
        return { success: false, error: 'Input is null or undefined' };
      }
      // Already parsed object
      const result: JsonParseResult<T> = {
        success: true,
        data: input as T,
        method: 'direct_object'
      };
      if (preserveRawInput) {
        result.rawInput = JSON.stringify(input);
      }
      return result;
    }

    const trimmed = input.trim();
    if (!trimmed) {
      return { success: false, error: 'Input is empty or whitespace' };
    }

    // Strategy 1: Direct JSON parsing
    const directResult = this.attemptDirectParse<T>(trimmed, preserveRawInput, logErrors, fieldName);
    if (directResult.success) {
      return directResult;
    }

    if (!allowPartialExtraction) {
      return directResult; // Return the direct parsing error
    }

    // Strategy 2: Extract from text patterns
    const extractionResult = this.attemptExtraction<T>(trimmed, preserveRawInput, gridValidation);
    if (extractionResult.success) {
      return extractionResult;
    }

    // Strategy 3: Advanced pattern matching (from Grok service)
    const patternResult = this.attemptPatternExtraction<T>(trimmed, preserveRawInput);
    if (patternResult.success) {
      return patternResult;
    }

    // All strategies failed
    if (logErrors) {
      console.error(`[JsonParser] All parsing strategies failed for ${fieldName || 'unknown field'}`);
      console.error(`[JsonParser] Input length: ${input.length}, trimmed length: ${trimmed.length}`);
      console.error(`[JsonParser] First 200 chars: ${trimmed.substring(0, 200)}`);
      console.error(`[JsonParser] Last 200 chars: ${trimmed.slice(-200)}`);
    }

    return {
      success: false,
      error: `JSON parsing failed: ${directResult.error}`,
      rawInput: preserveRawInput ? trimmed : undefined
    };
  }

  /**
   * Specialized method for grid extraction (replaces responseValidator patterns)
   */
  parseGrid(input: string, options: ParseOptions = {}): JsonParseResult<number[][]> {
    const gridOptions = { ...options, gridValidation: true };
    const result = this.parse<number[][]>(input, gridOptions);
    
    if (result.success && result.data) {
      // Additional grid-specific validation
      if (!this.isValidGrid(result.data)) {
        return {
          success: false,
          error: 'Parsed data is not a valid numeric grid',
          rawInput: options.preserveRawInput ? input : undefined
        };
      }
    }
    
    return result;
  }

  /**
   * Strategy 1: Direct JSON.parse attempt
   */
  private attemptDirectParse<T>(
    input: string, 
    preserveRawInput: boolean, 
    logErrors: boolean, 
    fieldName?: string
  ): JsonParseResult<T> {
    try {
      const parsed = JSON.parse(input) as T;
      return {
        success: true,
        data: parsed,
        method: 'direct_parse',
        rawInput: preserveRawInput ? input : undefined
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown parsing error';
      
      if (logErrors && fieldName) {
        console.warn(`[JsonParser] Direct parse failed for ${fieldName}: ${errorMsg}`);
      }
      
      return {
        success: false,
        error: errorMsg,
        rawInput: preserveRawInput ? input : undefined
      };
    }
  }

  /**
   * Strategy 2: Extract JSON from text patterns (common in AI responses)
   */
  private attemptExtraction<T>(
    input: string, 
    preserveRawInput: boolean,
    gridValidation: boolean
  ): JsonParseResult<T> {
    // Pattern 1: Code blocks
    const codeBlockPattern = /```(?:json)?\s*(\{[\s\S]*?\}|\[[\s\S]*?\])\s*```/i;
    const codeBlockMatch = input.match(codeBlockPattern);
    
    if (codeBlockMatch) {
      const extracted = codeBlockMatch[1];
      const result = this.attemptDirectParse<T>(extracted, false, false);
      if (result.success) {
        return {
          ...result,
          method: 'code_block_extraction',
          rawInput: preserveRawInput ? input : undefined
        };
      }
    }

    // Pattern 2: JSON objects in text
    const jsonPattern = /(\{[\s\S]*\}|\[[\s\S]*\])/;
    const jsonMatch = input.match(jsonPattern);
    
    if (jsonMatch) {
      const extracted = jsonMatch[1];
      const result = this.attemptDirectParse<T>(extracted, false, false);
      if (result.success) {
        return {
          ...result,
          method: 'pattern_extraction',
          rawInput: preserveRawInput ? input : undefined
        };
      }
    }

    // Pattern 3: Grid-specific patterns (if grid validation enabled)
    if (gridValidation) {
      const gridPatterns = [
        /\[\s*\[\s*[\d\s,]+\s*\][\s,]*\]/g,  // [[1,2,3], [4,5,6]]
        /\[\s*[\d\s,]+\s*\]/g                // [1,2,3,4,5,6] (flat)
      ];

      for (const pattern of gridPatterns) {
        const matches = input.match(pattern);
        if (matches) {
          for (const match of matches) {
            const cleaned = this.cleanGridText(match);
            const result = this.attemptDirectParse<T>(cleaned, false, false);
            if (result.success && this.isValidGrid(result.data)) {
              return {
                ...result,
                method: 'grid_pattern_extraction',
                rawInput: preserveRawInput ? input : undefined
              };
            }
          }
        }
      }
    }

    return {
      success: false,
      error: 'No extractable JSON patterns found'
    };
  }

  /**
   * Strategy 3: Advanced pattern extraction (from Grok service logic)
   */
  private attemptPatternExtraction<T>(input: string, preserveRawInput: boolean): JsonParseResult<T> {
    const braceStart = input.indexOf('{');
    if (braceStart === -1) {
      return { success: false, error: 'No opening brace found' };
    }

    const extracted = this.extractCompleteJsonObject(input, braceStart);
    if (extracted) {
      const result = this.attemptDirectParse<T>(extracted, false, false);
      if (result.success) {
        return {
          ...result,
          method: 'brace_matching_extraction',
          rawInput: preserveRawInput ? input : undefined
        };
      }
    }

    return {
      success: false,
      error: 'Advanced pattern extraction failed'
    };
  }

  /**
   * Extract complete JSON object using brace matching (from Grok service)
   */
  private extractCompleteJsonObject(text: string, startPos: number): string | null {
    let braceCount = 0;
    let endPos = startPos;
    let inString = false;
    let escapeNext = false;

    for (let i = startPos; i < text.length; i++) {
      const char = text[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            endPos = i;
            break;
          }
        }
      }
    }
    
    if (braceCount === 0 && endPos > startPos) {
      return text.substring(startPos, endPos + 1);
    }
    
    return null;
  }

  /**
   * Clean grid text for parsing (from responseValidator logic)
   */
  private cleanGridText(text: string): string {
    return text
      .replace(/,\s*,/g, ',')           // Remove duplicate commas
      .replace(/\[\s+/g, '[')          // Remove spaces after opening bracket
      .replace(/\s+\]/g, ']')          // Remove spaces before closing bracket  
      .replace(/,\s*\]/g, ']')         // Remove trailing commas
      .replace(/\s+,/g, ',')           // Remove spaces before commas
      .trim();
  }

  /**
   * Validate that parsed data is a proper numeric grid
   */
  private isValidGrid(data: any): data is number[][] {
    if (!Array.isArray(data)) return false;
    if (data.length === 0) return false;
    
    return data.every(row => 
      Array.isArray(row) && 
      row.every(cell => 
        typeof cell === 'number' && 
        Number.isInteger(cell) && 
        cell >= 0
      )
    );
  }
}

// Export singleton instance
export const jsonParser = JsonParser.getInstance();