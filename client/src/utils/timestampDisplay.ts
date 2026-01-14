/**
 * Author: Cascade (OpenAI Assistant)
 * Date: 2026-01-14
 * PURPOSE: Shared helpers for presenting timestamps with ISO UTC precision and relative context.
 *          Normalizes seconds vs milliseconds inputs and emits combined "ISO (relative)" strings.
 * SRP/DRY check: Pass — consolidates timestamp formatting for RE-ARC UI components.
 */

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = MS_PER_SECOND * 60;
const MS_PER_HOUR = MS_PER_MINUTE * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;
const MS_PER_WEEK = MS_PER_DAY * 7;
const MS_PER_MONTH = MS_PER_DAY * 30;
const MS_PER_YEAR = MS_PER_DAY * 365;

export interface TimestampDisplayValue {
  /** ISO 8601 string with UTC suffix */
  absolute: string;
  /** Relative phrasing such as "2 hours ago" */
  relative: string;
  /** Convenience string: `${absolute} (${relative})` */
  combined: string;
  /** Native Date instance for downstream consumers */
  date: Date;
}

function normalizeTimestamp(value: number | string | Date): number | null {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'number') {
    // Treat sub-trillion values as seconds (UNIX epoch) and convert to ms
    return value < 1_000_000_000_000 ? value * MS_PER_SECOND : value;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatRelativeFromDiff(diffMs: number): string {
  const absDiff = Math.abs(diffMs);
  const signAdjusted = (value: number) => (diffMs < 0 ? -value : value);

  if (absDiff < MS_PER_MINUTE) {
    return RELATIVE_TIME_FORMATTER.format(
      signAdjusted(Math.round(diffMs / MS_PER_SECOND)),
      'second'
    );
  }
  if (absDiff < MS_PER_HOUR) {
    return RELATIVE_TIME_FORMATTER.format(
      signAdjusted(Math.round(diffMs / MS_PER_MINUTE)),
      'minute'
    );
  }
  if (absDiff < MS_PER_DAY) {
    return RELATIVE_TIME_FORMATTER.format(
      signAdjusted(Math.round(diffMs / MS_PER_HOUR)),
      'hour'
    );
  }
  if (absDiff < MS_PER_WEEK) {
    return RELATIVE_TIME_FORMATTER.format(
      signAdjusted(Math.round(diffMs / MS_PER_DAY)),
      'day'
    );
  }
  if (absDiff < MS_PER_MONTH) {
    return RELATIVE_TIME_FORMATTER.format(
      signAdjusted(Math.round(diffMs / MS_PER_WEEK)),
      'week'
    );
  }
  if (absDiff < MS_PER_YEAR) {
    return RELATIVE_TIME_FORMATTER.format(
      signAdjusted(Math.round(diffMs / MS_PER_MONTH)),
      'month'
    );
  }

  return RELATIVE_TIME_FORMATTER.format(
    signAdjusted(Math.round(diffMs / MS_PER_YEAR)),
    'year'
  );
}

/**
 * Formats a timestamp as `ISO (relative)` while handling seconds vs milliseconds inputs.
 */
export function formatTimestampWithRelative(
  value: number | string | Date,
  { referenceTime = Date.now() }: { referenceTime?: number } = {}
): TimestampDisplayValue {
  const normalized = normalizeTimestamp(value);
  if (normalized == null) {
    return {
      absolute: 'Invalid date',
      relative: 'invalid time',
      combined: 'Invalid date',
      date: new Date(NaN),
    };
  }

  const date = new Date(normalized);
  const absolute = date.toISOString();
  const relative = formatRelativeFromDiff(normalized - referenceTime);

  return {
    absolute,
    relative,
    combined: `${absolute} (${relative})`,
    date,
  };
}
