/**
 * Recovery script to fix old explained files with JSON parsing failures
 * Applies enhanced sanitization logic to rawResponse data and attempts re-parsing
 * 
 * @author Cascade claude-3-5-sonnet-20241022
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class JSONRecovery {
  constructor() {
    this.explainedDir = path.join(__dirname, '..', 'data', 'explained');
    this.recoveredCount = 0;
    this.failedCount = 0;
    this.processedFiles = [];
  }

  /**
   * Enhanced sanitization logic (copied from OpenRouter service)
   */
  sanitizeResponse(text) {
    let sanitized = text;
    
    // Remove markdown code block wrappers including escaped variants
    sanitized = sanitized
      .replace(/^\\+```(?:json)?\s*/, '').replace(/\s*\\+```$/, '')
      .replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    
    // Remove single backtick wrappers including escaped variants
    sanitized = sanitized
      .replace(/^\\+`\s*/, '').replace(/\s*\\+`$/, '')
      .replace(/^`\s*/, '').replace(/\s*`$/, '');
    
    // Fix escape sequences BEFORE converting to newlines to prevent corruption
    sanitized = this.escapeNewlinesInJsonStrings(sanitized);
    
    // Now handle literal escape sequences that should be actual newlines
    sanitized = sanitized
      .replace(/\\n/g, '\n')
      .replace(/\/n/g, '\n')
      .replace(/\\\\n/g, '\n');
    
    return sanitized
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/[^\x20-\x7E\n\r\t\u00A0-\uFFFF]/g, '?')
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/([{,]\s*)(\w+):/g, '$1"$2":')
      .replace(/\[\s*("[^"]+"\s*:\s*[^,\]]+(?:\s*,\s*"[^"]+"\s*:\s*[^,\]]+)*)\s*\]/g, '{$1}')
      .replace(/\[\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*/g, '{"$1": ')
      .trim();
  }

  /**
   * Escape newlines within JSON string values
   */
  escapeNewlinesInJsonStrings(text) {
    return text.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match, content) => {
      if (content.includes('\n')) {
        const escaped = content.replace(/\n/g, '\\n');
        return `"${escaped}"`;
      }
      return match;
    });
  }

  /**
   * Extract complete JSON object starting from position
   */
  extractCompleteJSONObject(text, startPos) {
    let braceCount = 0;
    let inString = false;
    let escaped = false;
    
    for (let i = startPos; i < text.length; i++) {
      const char = text[i];
      
      if (escaped) {
        escaped = false;
        continue;
      }
      
      if (char === '\\') {
        escaped = true;
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
            return text.substring(startPos, i + 1);
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Attempt to recover JSON from raw response
   */
  attemptJSONRecovery(rawResponse) {
    // Strategy 1: Direct sanitization
    try {
      const sanitized = this.sanitizeResponse(rawResponse);
      return JSON.parse(sanitized);
    } catch (error) {
      console.log(`  Sanitization failed: ${error.message}`);
    }

    // Strategy 2: Extract JSON from markdown/text
    try {
      const patterns = [
        /```(?:json)?\s*(\{[\s\S]*?\})\s*```/i,
        /`(\{[\s\S]*?\})`/i,
        /^\s*(\{[\s\S]*\})\s*$/,
        /(\{[^}]*"(?:multiplePredictedOutputs|predictedOutput|patternDescription)"[^}]*\})/i
      ];

      for (const pattern of patterns) {
        const match = rawResponse.match(pattern);
        if (match && match[1]) {
          const sanitized = this.sanitizeResponse(match[1].trim());
          return JSON.parse(sanitized);
        }
      }
    } catch (error) {
      console.log(`  Pattern extraction failed: ${error.message}`);
    }

    // Strategy 3: Brute force JSON extraction
    try {
      const braceStart = rawResponse.indexOf('{');
      if (braceStart !== -1) {
        const extracted = this.extractCompleteJSONObject(rawResponse, braceStart);
        if (extracted) {
          const sanitized = this.sanitizeResponse(extracted);
          return JSON.parse(sanitized);
        }
      }
    } catch (error) {
      console.log(`  Brute force extraction failed: ${error.message}`);
    }

    return null;
  }

  /**
   * Check if an explanation entry needs recovery
   */
  needsRecovery(explanation) {
    return explanation.result && 
           explanation.result.recoveryMethod === 'validation-compliant-fallback' &&
           explanation.result.rawResponse &&
           explanation.result.parsingError;
  }

  /**
   * Process a single explained file
   */
  async processFile(filename) {
    const filepath = path.join(this.explainedDir, filename);
    
    try {
      const content = fs.readFileSync(filepath, 'utf-8');
      const data = JSON.parse(content);
      
      if (!data.explanations) {
        console.log(`  No explanations found in ${filename}`);
        return;
      }

      let fileModified = false;
      const recoveryResults = [];

      // Check each model's explanation
      for (const [modelKey, explanation] of Object.entries(data.explanations)) {
        if (this.needsRecovery(explanation)) {
          console.log(`  Attempting recovery for ${modelKey}...`);
          
          const recovered = this.attemptJSONRecovery(explanation.result.rawResponse);
          
          if (recovered && this.isValidRecoveredData(recovered)) {
            // Update the explanation with recovered data
            explanation.result = {
              ...recovered,
              // Preserve metadata about the recovery
              _recoveredAt: new Date().toISOString(),
              _originalParsingError: explanation.result.parsingError,
              _recoveryMethod: 'enhanced-sanitization'
            };
            
            fileModified = true;
            recoveryResults.push(`✅ ${modelKey}: Successfully recovered`);
            console.log(`    ✅ Successfully recovered ${modelKey}`);
          } else {
            recoveryResults.push(`❌ ${modelKey}: Recovery failed`);
            console.log(`    ❌ Recovery failed for ${modelKey}`);
          }
        }
      }

      // Save the file if any recoveries were successful
      if (fileModified) {
        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
        this.recoveredCount++;
        console.log(`  📁 Updated ${filename}`);
      }

      if (recoveryResults.length > 0) {
        this.processedFiles.push({
          filename,
          modified: fileModified,
          results: recoveryResults
        });
      }

    } catch (error) {
      console.error(`  ❌ Error processing ${filename}: ${error.message}`);
      this.failedCount++;
    }
  }

  /**
   * Validate that recovered data has proper structure
   */
  isValidRecoveredData(data) {
    // Check for required fields that indicate successful parsing
    const hasValidStructure = data && typeof data === 'object' &&
      (data.patternDescription || data.solvingStrategy || data.multiplePredictedOutputs !== undefined);
    
    // Ensure it's not just the fallback response
    const isNotFallback = !data.recoveryMethod || data.recoveryMethod !== 'validation-compliant-fallback';
    
    return hasValidStructure && isNotFallback;
  }

  /**
   * Main recovery process
   */
  async run() {
    console.log('🔧 Starting JSON parsing failure recovery...');
    console.log(`📂 Scanning ${this.explainedDir}`);
    
    const files = fs.readdirSync(this.explainedDir).filter(f => f.endsWith('-EXPLAINED.json'));
    console.log(`📄 Found ${files.length} explained files`);
    
    for (const filename of files) {
      console.log(`\n🔍 Processing ${filename}...`);
      await this.processFile(filename);
    }

    // Summary report
    console.log('\n' + '='.repeat(60));
    console.log('📊 RECOVERY SUMMARY');
    console.log('='.repeat(60));
    console.log(`📁 Files processed: ${files.length}`);
    console.log(`✅ Files recovered: ${this.recoveredCount}`);
    console.log(`❌ Files failed: ${this.failedCount}`);
    
    if (this.processedFiles.length > 0) {
      console.log('\n📋 Detailed Results:');
      this.processedFiles.forEach(({ filename, modified, results }) => {
        console.log(`\n📄 ${filename}:`);
        results.forEach(result => console.log(`  ${result}`));
      });
    }
    
    console.log('\n✨ Recovery process complete!');
  }
}

// Run the recovery if this script is executed directly
const recovery = new JSONRecovery();
recovery.run().catch(console.error);

export default JSONRecovery;
