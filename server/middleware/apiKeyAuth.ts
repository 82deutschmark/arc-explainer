/**
 * API Key Authentication Middleware
 *
 * Simple API key authentication for external integrations.
 * Checks for Bearer token in Authorization header.
 *
 * Author: Cascade using `whatever model the user has selected`
 * Date: `timestamp`
 * PURPOSE: Add API key authentication to ARC Explainer for external API access
 * SRP and DRY check: Pass - New middleware for authentication domain
 */

import { Request, Response, NextFunction } from 'express';

// Simple in-memory API key storage (in production, use database)
const VALID_API_KEYS = new Set([
    // Add valid API keys here
    'arc-explainer-public-key-2025',
    'researcher-access-key-001',
    'demo-api-key-for-researchers'
]);

// Environment variable for API key (can be set in .env)
const API_KEY_FROM_ENV = process.env.ARC_EXPLAINER_API_KEY;

/**
 * API Key Authentication Middleware
 *
 * Checks for valid API key in Authorization header:
 * Authorization: Bearer <api-key>
 */
export const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                error: 'Authorization header required',
                details: 'Include Authorization: Bearer <api-key> header'
            });
        }

        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Invalid authorization format',
                details: 'Use Authorization: Bearer <api-key> format'
            });
        }

        const providedKey = authHeader.substring(7); // Remove 'Bearer '

        // Check if key is valid
        const isValidKey = VALID_API_KEYS.has(providedKey) ||
                          (API_KEY_FROM_ENV && providedKey === API_KEY_FROM_ENV);

        if (!isValidKey) {
            return res.status(401).json({
                success: false,
                error: 'Invalid API key',
                details: 'API key not recognized'
            });
        }

        // Add API key info to request for downstream use
        (req as any).apiKey = providedKey;
        (req as any).authenticated = true;

        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Authentication error',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

/**
 * Optional API Key Authentication
 *
 * Same as apiKeyAuth but allows requests without API key
 * (for backwards compatibility during transition)
 */
export const optionalApiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        // If API key provided, validate it
        const providedKey = authHeader.substring(7);

        const isValidKey = VALID_API_KEYS.has(providedKey) ||
                          (API_KEY_FROM_ENV && providedKey === API_KEY_FROM_ENV);

        if (isValidKey) {
            (req as any).apiKey = providedKey;
            (req as any).authenticated = true;
        }
    }

    next();
};

/**
 * Admin-only API Key Authentication
 *
 * Requires API key AND checks if it's an admin key
 */
export const adminApiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Admin authorization required'
        });
    }

    const providedKey = authHeader.substring(7);

    // Admin keys (subset of valid keys)
    const ADMIN_KEYS = new Set([
        'arc-explainer-admin-key-2025',
        'admin-access-key-001'
    ]);

    const isAdminKey = ADMIN_KEYS.has(providedKey) ||
                      (API_KEY_FROM_ENV && providedKey === API_KEY_FROM_ENV && API_KEY_FROM_ENV.includes('admin'));

    if (!isAdminKey) {
        return res.status(403).json({
            success: false,
            error: 'Admin access required'
        });
    }

    (req as any).apiKey = providedKey;
    (req as any).authenticated = true;
    (req as any).isAdmin = true;

    next();
};
