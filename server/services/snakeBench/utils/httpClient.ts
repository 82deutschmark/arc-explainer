/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-19
 * PURPOSE: HTTP client for server-side JSON fetching of remote replay assets (Supabase, GitHub, Railway).
 *          Handles redirects, timeouts, and error context. No CORS issues (server-side only).
 * SRP/DRY check: Pass — isolated HTTP fetching logic, reusable across services.
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';
import { DEFAULT_REMOTE_FETCH_TIMEOUT_MS, MAX_HTTP_REDIRECTS } from './constants.ts';

/**
 * Fetch JSON from a URL server-side (avoids CORS issues).
 * Follows redirects (common for signed URLs / CDN rewrites).
 * Includes timeout and proper error context.
 */
export async function fetchJsonFromUrl(
  url: string,
  options?: {
    timeoutMs?: number;
    maxRedirects?: number;
  }
): Promise<any> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_REMOTE_FETCH_TIMEOUT_MS;
  const maxRedirects = options?.maxRedirects ?? MAX_HTTP_REDIRECTS;

  return fetchWithRedirects(url, 0, maxRedirects, timeoutMs);
}

async function fetchWithRedirects(
  url: string,
  redirectDepth: number,
  maxRedirects: number,
  timeoutMs: number
): Promise<any> {
  if (redirectDepth > maxRedirects) {
    throw new Error(`Too many redirects while fetching ${url}`);
  }

  const parsedUrl = new URL(url);

  return new Promise((resolve, reject) => {
    const transport = parsedUrl.protocol === 'http:' ? http : https;
    const req = transport.request(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: 'GET',
        headers: {
          // GitHub may block requests without a UA in some environments.
          'User-Agent': 'arc-explainer',
          Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
        },
      },
      (res) => {
        const statusCode = res.statusCode ?? 0;

        // Follow redirects (common for signed URLs / CDN rewrites).
        if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
          const nextUrl = new URL(res.headers.location, parsedUrl).toString();
          res.resume();
          fetchWithRedirects(nextUrl, redirectDepth + 1, maxRedirects, timeoutMs)
            .then(resolve)
            .catch(reject);
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');

          // Improve failure visibility when upstream returns HTML or a helpful message.
          if (statusCode >= 400) {
            const snippet = raw.length > 200 ? `${raw.slice(0, 200)}...` : raw;
            reject(new Error(`HTTP ${statusCode}${snippet ? ` - ${snippet}` : ''}`));
            return;
          }

          try {
            const parsed = JSON.parse(raw);
            resolve(parsed);
          } catch {
            // Include a tiny snippet so "Unexpected token <" has context.
            const snippet = raw.length > 200 ? `${raw.slice(0, 200)}...` : raw;
            reject(new Error(`Invalid JSON response${snippet ? ` - ${snippet}` : ''}`));
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('timeout'));
    });
    req.end();
  });
}
