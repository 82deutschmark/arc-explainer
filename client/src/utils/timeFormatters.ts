/**
 * Time formatting utilities for consistent display across the application
 * 
 * All time values are expected to be in milliseconds from the server
 * (stored in api_processing_time_ms database column)
 */

/**
 * Formats processing time to a human-readable string
 * 
 * @param timeValue - Time value from server (auto-detects seconds vs milliseconds)
 * @returns Formatted string (e.g., "45ms", "2.3s", "1.5m")
 */
export function formatProcessingTime(timeValue: number | null | undefined): string | null {
  if (!timeValue) return null;

  // Auto-detect if value is in seconds or milliseconds
  // Values > 1000 are almost certainly milliseconds (can't be < 1 second in seconds)
  let seconds: number;

  if (timeValue < 1000) {
    // Small values are either seconds or milliseconds < 1000ms
    // Treat as seconds (most likely for processing time)
    seconds = timeValue;
  } else {
    // Large values (>= 1000) are milliseconds - convert to seconds
    seconds = timeValue / 1000;
  }
  
  // Convert back to milliseconds for existing formatting logic
  const milliseconds = seconds * 1000;
  
  // For very small times, show milliseconds
  if (milliseconds < 1000) {
    return `${Math.round(milliseconds)}ms`;
  }
  
  // For times under a minute, show seconds with 1 decimal place
  if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(1)}s`;
  }
  
  // For longer times, show minutes with 1 decimal place
  return `${(milliseconds / 60000).toFixed(1)}m`;
}

/**
 * Formats processing time to a detailed human-readable string
 * Used in detailed views where more precision is helpful
 * 
 * @param timeValue - Time value from server (could be seconds or milliseconds)
 * @returns Formatted string (e.g., "45ms", "1m 23s", "45s")
 */
export function formatProcessingTimeDetailed(timeValue: number | null | undefined): string | null {
  if (!timeValue) return null;

  // Auto-detect if value is in seconds or milliseconds
  // Values > 1000 are almost certainly milliseconds (can't be < 1 second in seconds)
  let seconds: number;

  if (timeValue < 1000) {
    // Small values (< 1000) are either seconds or milliseconds < 1000ms
    // Treat as seconds (most likely for processing time)
    seconds = timeValue;
  } else {
    // Large values (>= 1000) are milliseconds - convert to seconds
    seconds = timeValue / 1000;
  }
  
  // Now format the seconds value
  if (seconds < 1) {
    return `${Math.round(seconds * 1000)}ms`;
  }
  
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  
  // Format: 1m 23s or just 45s if under a minute
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
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