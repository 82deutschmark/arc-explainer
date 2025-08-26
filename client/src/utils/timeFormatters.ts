/**
 * Time formatting utilities for consistent display across the application
 * 
 * All time values are expected to be in milliseconds from the server
 * (stored in api_processing_time_ms database column)
 */

/**
 * Formats processing time in milliseconds to a human-readable string
 * 
 * @param milliseconds - Time in milliseconds from server
 * @returns Formatted string (e.g., "45ms", "2.3s", "1.5m")
 */
export function formatProcessingTime(milliseconds: number | null | undefined): string | null {
  if (!milliseconds) return null;
  
  // For very small times, show milliseconds
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }
  
  // For times under a minute, show seconds with 1 decimal place
  if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(1)}s`;
  }
  
  // For longer times, show minutes with 1 decimal place
  return `${(milliseconds / 60000).toFixed(1)}m`;
}

/**
 * Formats processing time in milliseconds to a detailed human-readable string
 * Used in detailed views where more precision is helpful
 * 
 * @param milliseconds - Time in milliseconds from server
 * @returns Formatted string (e.g., "45ms", "1m 23s", "45s")
 */
export function formatProcessingTimeDetailed(milliseconds: number | null | undefined): string | null {
  if (!milliseconds) return null;
  
  // For very small times, show milliseconds
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }
  
  const totalSeconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  // Format: 1m 23s or just 45s if under a minute
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Formats a duration between two timestamps
 * 
 * @param startTime - Start timestamp in milliseconds
 * @param endTime - End timestamp in milliseconds (defaults to now)
 * @returns Formatted duration string
 */
export function formatDuration(startTime: number, endTime: number = Date.now()): string {
  const duration = endTime - startTime;
  return formatProcessingTime(duration) || '0ms';
}

/**
 * Converts seconds to milliseconds (for legacy compatibility)
 * 
 * @param seconds - Time in seconds
 * @returns Time in milliseconds
 */
export function secondsToMs(seconds: number): number {
  return seconds * 1000;
}

/**
 * Converts milliseconds to seconds
 * 
 * @param milliseconds - Time in milliseconds
 * @returns Time in seconds
 */
export function msToSeconds(milliseconds: number): number {
  return milliseconds / 1000;
}