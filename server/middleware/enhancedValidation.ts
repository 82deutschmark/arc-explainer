/**
 * enhancedValidation.ts
 * 
 * Enhanced validation middleware with schema-based validation and comprehensive error handling.
 * Builds upon existing validation.ts with more robust validation patterns.
 * Follows Phase 5.2 architecture: moving validation closer to usage with better error messages.
 * 
 * @author Claude Code (Phase 5 refactor)
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';
import { logger } from '../utils/logger.js';
import { getModelConfig } from '../config/models/index.js';
import type { ModelConfig } from '@shared/types.js';

/**
 * Validation schema interface
 */
interface ValidationSchema {
  [key: string]: {
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
    min?: number;
    max?: number;
    enum?: any[];
    pattern?: RegExp;
    custom?: (value: any, data?: any) => boolean | string;
  };
}

/**
 * Validation result interface
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData: any;
}

/**
 * Enhanced validation middleware factory
 */
export class EnhancedValidation {
  /**
   * Create schema-based validation middleware
   */
  static schema(schema: ValidationSchema, location: 'body' | 'params' | 'query' = 'body') {
    return (req: Request, res: Response, next: NextFunction) => {
      const data = req[location];
      const result = this.validateSchema(data, schema);
      
      if (!result.isValid) {
        throw new AppError(
          `Validation failed: ${result.errors.join(', ')}`,
          400,
          'VALIDATION_ERROR'
        );
      }
      
      // Replace request data with sanitized version
      req[location] = result.sanitizedData;
      next();
    };
  }

  /**
   * Enhanced puzzle analysis validation
   */
  static puzzleAnalysis() {
    const schema: ValidationSchema = {
      taskId: {
        required: true,
        type: 'string',
        min: 1,
        pattern: /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}|^[a-f0-9]{8}$/i,
        custom: (value: any, data?: any) => value.trim().length > 0 || 'Task ID cannot be empty'
      },
      model: {
        required: true,
        type: 'string',
        custom: (value: any, data?: any) => {
          const modelConfig = getModelConfig(value);
          return modelConfig ? true : `Unknown model: ${value}`;
        }
      },
      temperature: {
        type: 'number',
        min: 0,
        max: 2,
        custom: (value: any, data?: any) => {
          if (value === undefined) return true;
          const num = parseFloat(value);
          return !isNaN(num) || 'Temperature must be a valid number';
        }
      },
      promptId: {
        type: 'string',
        enum: ['solver', 'educational', 'standard', 'alien', 'custom'],
        custom: (value: any, data?: any) => {
          if (value === undefined) return true;
          return ['solver', 'educational', 'standard', 'alien', 'custom'].includes(value) || 
                 'Invalid prompt ID';
        }
      },
      customPrompt: {
        type: 'string',
        min: 10,
        max: 10000,
        custom: (value: any, data?: any) => {
          if (data.promptId === 'custom' && (!value || value.trim().length < 10)) {
            return 'Custom prompt is required and must be at least 10 characters when promptId is "custom"';
          }
          return true;
        }
      },
      reasoningEffort: {
        type: 'string',
        enum: ['minimal', 'low', 'medium', 'high']
      },
      reasoningVerbosity: {
        type: 'string',
        enum: ['low', 'medium', 'high']
      },
      reasoningSummaryType: {
        type: 'string',
        enum: ['auto', 'detailed']
      }
    };

    return (req: Request, res: Response, next: NextFunction) => {
      // Combine params and body for validation
      const combined = { ...req.params, ...req.body };
      const result = this.validateSchema(combined, schema);
      
      if (!result.isValid) {
        throw new AppError(
          `Invalid analysis request: ${result.errors.join(', ')}`,
          400,
          'VALIDATION_ERROR'
        );
      }

      // Enhanced model-specific validation
      const modelKey = result.sanitizedData.model;
      const modelConfig = getModelConfig(modelKey);
      
      if (modelConfig && result.sanitizedData.temperature !== undefined) {
        if (!modelConfig.isReasoning) {
          throw new AppError(
            `Model ${modelKey} does not support temperature adjustment`,
            400,
            'VALIDATION_ERROR'
          );
        }
      }

      // Merge sanitized data back
      Object.assign(req.params, result.sanitizedData);
      Object.assign(req.body, result.sanitizedData);
      next();
    };
  }

  /**
   * Enhanced batch analysis validation
   */
  static batchAnalysis() {
    const schema: ValidationSchema = {
      modelKey: {
        required: true,
        type: 'string',
        custom: (value: any, data?: any) => {
          const modelConfig = getModelConfig(value);
          return modelConfig ? true : `Unknown model: ${value}`;
        }
      },
      dataset: {
        required: true,
        type: 'string',
        enum: ['ARC1', 'ARC1-Eval', 'ARC2', 'ARC2-Eval', 'ARC-Heavy', 'ConceptARC', 'All']
      },
      promptId: {
        type: 'string',
        enum: ['solver', 'educational', 'standard', 'alien', 'custom']
      },
      customPrompt: {
        type: 'string',
        min: 10,
        max: 10000,
        custom: (value: any, data?: any) => {
          if (data.promptId === 'custom' && (!value || value.trim().length < 10)) {
            return 'Custom prompt is required when promptId is "custom"';
          }
          return true;
        }
      },
      temperature: {
        type: 'number',
        min: 0,
        max: 2
      },
      batchSize: {
        type: 'number',
        min: 1,
        max: 50,
        custom: (value: any, data?: any) => {
          if (value === undefined) return true;
          const num = parseInt(value);
          return !isNaN(num) && num >= 1 && num <= 50 || 'Batch size must be between 1 and 50';
        }
      }
    };

    return this.schema(schema, 'body');
  }

  /**
   * Enhanced feedback validation
   */
  static feedback() {
    const schema: ValidationSchema = {
      explanationId: {
        required: true,
        type: 'number',
        min: 1,
        custom: (value: any, data?: any) => {
          const num = parseInt(value);
          return !isNaN(num) && num > 0 || 'Explanation ID must be a positive integer';
        }
      },
      voteType: {
        required: true,
        type: 'string',
        enum: ['helpful', 'not_helpful']
      },
      comment: {
        required: true,
        type: 'string',
        min: 20,
        max: 2000,
        custom: (value: any, data?: any) => {
          if (!value || value.trim().length < 20) {
            return 'A meaningful comment of at least 20 characters is required';
          }
          if (value.length > 2000) {
            return 'Comment must not exceed 2000 characters';
          }
          return true;
        }
      }
    };

    return (req: Request, res: Response, next: NextFunction) => {
      // Handle explanationId from either params or body
      if (!req.body.explanationId && req.params.explanationId) {
        req.body.explanationId = parseInt(req.params.explanationId, 10);
      }

      const result = this.validateSchema(req.body, schema);
      
      if (!result.isValid) {
        throw new AppError(
          `Invalid feedback submission: ${result.errors.join(', ')}`,
          400,
          'VALIDATION_ERROR'
        );
      }

      req.body = result.sanitizedData;
      next();
    };
  }

  /**
   * Model existence and capability validation
   */
  static modelValidation(capability?: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const modelKey = req.params.model || req.body.modelKey || req.body.model;
      
      if (!modelKey) {
        throw new AppError('Model key is required', 400, 'VALIDATION_ERROR');
      }

      const modelConfig = getModelConfig(modelKey);
      if (!modelConfig) {
        throw new AppError(`Unknown model: ${modelKey}`, 400, 'VALIDATION_ERROR');
      }

      // Check specific capability if requested
      if (capability) {
        switch (capability) {
          case 'temperature':
            if (!modelConfig.supportsTemperature) {
              throw new AppError(
                `Model ${modelKey} does not support temperature adjustment`,
                400,
                'VALIDATION_ERROR'
              );
            }
            break;
          case 'reasoning':
            if (!modelConfig.isReasoning) {
              throw new AppError(
                `Model ${modelKey} does not support reasoning`,
                400,
                'VALIDATION_ERROR'
              );
            }
            break;
          case 'batch':
            if (modelConfig.premium) {
              throw new AppError(
                `Premium model ${modelKey} does not support batch processing`,
                400,
                'VALIDATION_ERROR'
              );
            }
            break;
        }
      }

      next();
    };
  }

  /**
   * Request sanitization middleware
   */
  static sanitize() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Sanitize string inputs
      const sanitizeObject = (obj: any): any => {
        if (typeof obj === 'string') {
          return obj.trim();
        }
        if (Array.isArray(obj)) {
          return obj.map(sanitizeObject);
        }
        if (obj && typeof obj === 'object') {
          const sanitized: any = {};
          for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitizeObject(value);
          }
          return sanitized;
        }
        return obj;
      };

      if (req.body) {
        req.body = sanitizeObject(req.body);
      }
      if (req.query) {
        req.query = sanitizeObject(req.query);
      }

      next();
    };
  }

  /**
   * Core schema validation logic
   */
  private static validateSchema(data: any, schema: ValidationSchema): ValidationResult {
    const errors: string[] = [];
    const sanitizedData: any = { ...data };

    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];

      // Check required fields
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`Field '${field}' is required`);
        continue;
      }

      // Skip validation for undefined optional fields
      if (value === undefined && !rules.required) {
        continue;
      }

      // Type validation
      if (rules.type && value !== undefined) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== rules.type) {
          errors.push(`Field '${field}' must be of type ${rules.type}, got ${actualType}`);
          continue;
        }
      }

      // String/array length validation
      if (rules.min !== undefined && (typeof value === 'string' || Array.isArray(value))) {
        if (value.length < rules.min) {
          errors.push(`Field '${field}' must be at least ${rules.min} characters/items long`);
        }
      }

      if (rules.max !== undefined && (typeof value === 'string' || Array.isArray(value))) {
        if (value.length > rules.max) {
          errors.push(`Field '${field}' must not exceed ${rules.max} characters/items`);
        }
      }

      // Numeric range validation
      if (typeof value === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          errors.push(`Field '${field}' must be at least ${rules.min}`);
        }
        if (rules.max !== undefined && value > rules.max) {
          errors.push(`Field '${field}' must not exceed ${rules.max}`);
        }
      }

      // Enum validation
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`Field '${field}' must be one of: ${rules.enum.join(', ')}`);
      }

      // Pattern validation
      if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
        errors.push(`Field '${field}' format is invalid`);
      }

      // Custom validation
      if (rules.custom) {
        const customResult = rules.custom(value, data);
        if (customResult !== true) {
          errors.push(typeof customResult === 'string' ? customResult : `Field '${field}' failed custom validation`);
        }
      }

      // Sanitize value
      if (typeof value === 'string') {
        sanitizedData[field] = value.trim();
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData
    };
  }
}

// Export convenience instances
export const enhancedValidation = {
  schema: EnhancedValidation.schema,
  puzzleAnalysis: EnhancedValidation.puzzleAnalysis,
  batchAnalysis: EnhancedValidation.batchAnalysis,
  feedback: EnhancedValidation.feedback,
  modelValidation: EnhancedValidation.modelValidation,
  sanitize: EnhancedValidation.sanitize
};
