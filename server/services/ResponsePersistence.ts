/**
 * ResponsePersistence.ts
 * 
 * Single Responsibility: Raw response persistence with proper directory management
 * Extracts file I/O concerns from AI services following SRP principle
 * 
 * @author Claude Code (Architectural refactor)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger.js';

export class ResponsePersistence {
  private static instance: ResponsePersistence;
  
  private constructor() {}
  
  static getInstance(): ResponsePersistence {
    if (!ResponsePersistence.instance) {
      ResponsePersistence.instance = new ResponsePersistence();
    }
    return ResponsePersistence.instance;
  }

  /**
   * Save raw HTTP response with proper directory creation
   * Handles the ENOENT errors that were occurring
   */
  async saveRawResponse(
    modelName: string, 
    responseBody: string, 
    statusCode: number,
    metadata?: {
      requestId?: string;
      duration?: number;
      provider?: string;
      truncated?: boolean;
      responseLength?: number;
      processingError?: string;
      postContinuation?: boolean;
    }
  ): Promise<string | null> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sanitizedModelName = this.sanitizeFilename(modelName);
      const filename = `raw-response-${sanitizedModelName}-${timestamp}-status${statusCode}.txt`;
      
      // Ensure directory exists (fixes ENOENT errors)
      const baseDir = path.join('data', 'explained');
      await this.ensureDirectoryExists(baseDir);
      
      const filepath = path.join(baseDir, filename);
      
      const content = this.buildResponseContent(
        statusCode,
        modelName,
        responseBody,
        metadata
      );
      
      await fs.writeFile(filepath, content);
      logger.fileOperation('Saved raw response to', filename, 'ResponsePersistence');
      
      return filepath;
    } catch (error) {
      logger.logError('Failed to save response', { error, context: 'ResponsePersistence' });
      return null;
    }
  }

  /**
   * Save provider-specific explanation response for debugging
   */
  async saveExplanationResponse(
    puzzleId: string,
    modelKey: string,
    responseData: any,
    status: 'RECEIVED' | 'PARSE_FAILED' | 'SUCCESS' = 'RECEIVED'
  ): Promise<string | null> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sanitizedModelName = this.sanitizeFilename(modelKey);
      const filename = `${puzzleId}-${sanitizedModelName}-${timestamp}-${status}-raw.txt`;
      
      // Ensure directory exists
      const baseDir = path.join('data', 'explained');
      await this.ensureDirectoryExists(baseDir);
      
      const filepath = path.join(baseDir, filename);
      
      const content = this.buildExplanationContent(
        modelKey,
        status,
        timestamp,
        responseData
      );
      
      await fs.writeFile(filepath, content);
      logger.fileOperation('Explanation saved to', filename, 'ResponsePersistence');
      
      return filepath;
    } catch (error) {
      logger.logError('Failed to save explanation', { error, context: 'ResponsePersistence' });
      return null;
    }
  }

  /**
   * Ensure directory exists, creating it recursively if needed
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch (error) {
      // Directory doesn't exist, create it recursively
      await fs.mkdir(dirPath, { recursive: true });
      logger.fileOperation('Created directory', dirPath, 'ResponsePersistence');
    }
  }

  /**
   * Sanitize filename for cross-platform compatibility
   */
  private sanitizeFilename(input: string): string {
    return input.replace(/[\/\\:*?"<>|]/g, '-');
  }

  /**
   * Build formatted response content for raw HTTP responses
   */
  private buildResponseContent(
    statusCode: number,
    modelName: string,
    responseBody: string,
    metadata?: {
      requestId?: string;
      duration?: number;
      provider?: string;
      truncated?: boolean;
      responseLength?: number;
      processingError?: string;
      postContinuation?: boolean;
    }
  ): string {
    const sections = [
      `HTTP Status: ${statusCode}`,
      `Timestamp: ${new Date().toISOString()}`,
      `Model: ${modelName}`,
      `Response Length: ${responseBody.length} chars`
    ];

    if (metadata?.provider) {
      sections.push(`Provider: ${metadata.provider}`);
    }

    if (metadata?.requestId) {
      sections.push(`Request ID: ${metadata.requestId}`);
    }

    if (metadata?.duration) {
      sections.push(`Duration: ${metadata.duration}ms`);
    }

    if (metadata?.truncated !== undefined) {
      sections.push(`Truncated: ${metadata.truncated}`);
    }

    if (metadata?.responseLength !== undefined) {
      sections.push(`Original Response Length: ${metadata.responseLength} chars`);
    }

    if (metadata?.processingError) {
      sections.push(`Processing Error: ${metadata.processingError}`);
    }

    if (metadata?.postContinuation !== undefined) {
      sections.push(`Post Continuation: ${metadata.postContinuation}`);
    }

    sections.push('', responseBody);

    return sections.join('\n');
  }

  /**
   * Build formatted content for explanation responses
   */
  private buildExplanationContent(
    modelKey: string,
    status: string,
    timestamp: string,
    responseData: any
  ): string {
    const responseLength = typeof responseData === 'string' 
      ? responseData.length 
      : JSON.stringify(responseData).length;

    const content = [
      '=== OpenRouter Raw Response ===',
      `Model: ${modelKey}`,
      `Status: ${status}`,
      `Timestamp: ${timestamp}`,
      `Response Length: ${responseLength} characters`,
      '',
      '=== RAW RESPONSE CONTENT ===',
      typeof responseData === 'string' ? responseData : JSON.stringify(responseData, null, 2),
      '',
      '=== END RAW RESPONSE ==='
    ].join('\n');

    return content;
  }
}

// Export singleton instance
export const responsePersistence = ResponsePersistence.getInstance();