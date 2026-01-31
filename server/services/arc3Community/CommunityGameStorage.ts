/*
 * Author: Cascade (Claude)
 * Date: 2026-01-31
 * PURPOSE: File storage service for community game Python source files.
 *          Handles upload, retrieval, and hash verification of game files.
 * SRP/DRY check: Pass — single-purpose file storage management.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { logger } from '../../utils/logger';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'community-games');
const THUMBNAIL_DIR = path.join(UPLOAD_DIR, 'thumbnails');
const MAX_FILE_SIZE = 100 * 1024; // 100KB limit for game files

export interface StoredFile {
  filePath: string;
  fileName: string;
  hash: string;
  size: number;
}

export class CommunityGameStorage {
  /**
   * Initialize storage directories
   */
  static async initialize(): Promise<void> {
    try {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      await fs.mkdir(THUMBNAIL_DIR, { recursive: true });
      logger.info('Community game storage directories initialized', 'storage');
    } catch (error) {
      logger.error(`Failed to initialize storage: ${error}`, 'storage');
      throw error;
    }
  }

  /**
   * Store a game Python file
   * @param gameId Unique game identifier (used in filename)
   * @param content Python source code content
   * @returns Stored file metadata
   */
  static async storeGameFile(gameId: string, content: string): Promise<StoredFile> {
    await this.initialize();

    // Validate file size
    const size = Buffer.byteLength(content, 'utf8');
    if (size > MAX_FILE_SIZE) {
      throw new Error(`File size ${size} exceeds maximum of ${MAX_FILE_SIZE} bytes`);
    }

    // Generate safe filename
    const sanitizedId = this.sanitizeGameId(gameId);
    const fileName = `${sanitizedId}.py`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    // Calculate hash
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    // Write file
    await fs.writeFile(filePath, content, 'utf8');
    logger.info(`Stored game file: ${fileName} (${size} bytes, hash: ${hash.substring(0, 8)}...)`, 'storage');

    return {
      filePath,
      fileName,
      hash,
      size,
    };
  }

  /**
   * Read a game file content
   */
  static async readGameFile(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return content;
    } catch (error) {
      logger.error(`Failed to read game file ${filePath}: ${error}`, 'storage');
      throw new Error(`Game file not found: ${filePath}`);
    }
  }

  /**
   * Verify file hash matches stored hash
   */
  static async verifyFileHash(filePath: string, expectedHash: string): Promise<boolean> {
    try {
      const content = await this.readGameFile(filePath);
      const actualHash = crypto.createHash('sha256').update(content).digest('hex');
      return actualHash === expectedHash;
    } catch {
      return false;
    }
  }

  /**
   * Store a thumbnail image
   */
  static async storeThumbnail(gameId: string, imageBuffer: Buffer, mimeType: string): Promise<string> {
    await this.initialize();

    const extension = mimeType === 'image/png' ? 'png' : 'jpg';
    const sanitizedId = this.sanitizeGameId(gameId);
    const fileName = `${sanitizedId}.${extension}`;
    const filePath = path.join(THUMBNAIL_DIR, fileName);

    await fs.writeFile(filePath, imageBuffer);
    logger.info(`Stored thumbnail: ${fileName}`, 'storage');

    // Return relative path for web access
    return `/uploads/community-games/thumbnails/${fileName}`;
  }

  /**
   * Delete a game file and its thumbnail
   */
  static async deleteGameFiles(gameId: string): Promise<void> {
    const sanitizedId = this.sanitizeGameId(gameId);
    
    // Delete Python file
    const pyPath = path.join(UPLOAD_DIR, `${sanitizedId}.py`);
    try {
      await fs.unlink(pyPath);
      logger.info(`Deleted game file: ${sanitizedId}.py`, 'storage');
    } catch {
      // File may not exist
    }

    // Delete thumbnails (try both extensions)
    for (const ext of ['png', 'jpg']) {
      const thumbPath = path.join(THUMBNAIL_DIR, `${sanitizedId}.${ext}`);
      try {
        await fs.unlink(thumbPath);
        logger.info(`Deleted thumbnail: ${sanitizedId}.${ext}`, 'storage');
      } catch {
        // File may not exist
      }
    }
  }

  /**
   * Check if a game file exists
   */
  static async gameFileExists(gameId: string): Promise<boolean> {
    const sanitizedId = this.sanitizeGameId(gameId);
    const filePath = path.join(UPLOAD_DIR, `${sanitizedId}.py`);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the full path for a game file
   */
  static getGameFilePath(gameId: string): string {
    const sanitizedId = this.sanitizeGameId(gameId);
    return path.join(UPLOAD_DIR, `${sanitizedId}.py`);
  }

  /**
   * List all stored game files
   */
  static async listGameFiles(): Promise<string[]> {
    await this.initialize();
    const files = await fs.readdir(UPLOAD_DIR);
    return files.filter(f => f.endsWith('.py'));
  }

  /**
   * Sanitize game ID for safe filesystem usage
   */
  private static sanitizeGameId(gameId: string): string {
    // Replace unsafe characters, keep alphanumeric, dash, underscore
    return gameId
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 100);
  }

  /**
   * Calculate hash of content without storing
   */
  static calculateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
