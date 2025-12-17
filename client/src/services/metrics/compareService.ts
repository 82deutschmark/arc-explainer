/**
 * Author: Cascade
 * Date: 2025-12-17
 * PURPOSE: Centralized client-side service for calling /api/metrics/compare.
 *          Eliminates duplicated request-building, fetch handling, and error extraction
 *          across multiple pages/components.
 * SRP/DRY check: Pass - Single responsibility: build request + fetch + parse response.
 */

import { ModelComparisonResult } from '@/pages/AnalyticsOverview';

export interface MetricsCompareRequest {
  /**
   * Dataset identifier understood by the backend (e.g. evaluation2, training2, arc-heavy).
   */
  dataset: string;

  /**
   * Ordered list of model names to compare. The backend accepts model1..model4.
   */
  modelNames: string[];
}

const extractErrorMessage = async (response: Response): Promise<string> => {
  // Keep the existing UX behavior: prefer a JSON { message } if provided by the server,
  // otherwise fall back to raw text / generic message.
  try {
    const asJson = await response.json();
    if (typeof asJson?.message === 'string' && asJson.message.trim()) {
      return asJson.message;
    }
  } catch {
    // Ignore JSON parsing errors and fall back to text below.
  }

  try {
    const text = await response.text();
    if (text?.trim()) {
      return text;
    }
  } catch {
    // Ignore.
  }

  return 'Failed to fetch comparison data';
};

/**
 * Builds the query string for /api/metrics/compare (model1..model4 + dataset).
 */
export const buildMetricsCompareSearchParams = (
  request: MetricsCompareRequest,
): URLSearchParams => {
  const params = new URLSearchParams({ dataset: request.dataset });

  request.modelNames
    .filter((name) => Boolean(name && name.trim()))
    .slice(0, 4)
    .forEach((modelName, index) => {
      params.set(`model${index + 1}`, modelName);
    });

  return params;
};

/**
 * Calls /api/metrics/compare and returns the parsed ModelComparisonResult.
 */
export const fetchMetricsCompare = async (
  request: MetricsCompareRequest,
  options?: {
    signal?: AbortSignal;
  },
): Promise<ModelComparisonResult> => {
  const params = buildMetricsCompareSearchParams(request);

  const response = await fetch(`/api/metrics/compare?${params.toString()}`, {
    credentials: 'include',
    signal: options?.signal,
  });

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new Error(message);
  }

  const payload = await response.json().catch(() => null);
  if (!payload?.data) {
    throw new Error('No data received from server');
  }

  return payload.data as ModelComparisonResult;
};
