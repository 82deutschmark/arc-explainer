-- Migration: Add game culling columns to public.games
-- Author: Cascade (Claude claude-3-5-sonnet)
-- Date: 2026-01-13
-- Purpose: Enable filtering out low-quality games (< 10 rounds) from statistics
--          while preserving full history for audit and potential restoration.
-- SRP/DRY check: Pass - Single schema change for culling support

-- Add culling columns to games table
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS is_culled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS culled_reason text,
  ADD COLUMN IF NOT EXISTS culled_source text,
  ADD COLUMN IF NOT EXISTS culled_at timestamptz;

-- Create index for efficient filtering on is_culled
CREATE INDEX IF NOT EXISTS idx_games_is_culled ON public.games (is_culled)
  WHERE is_culled = false;

-- Backfill: Mark all games with < 10 rounds as culled
UPDATE public.games
SET
  is_culled = true,
  culled_reason = 'ROUND_SHORT',
  culled_source = 'migration_backfill',
  culled_at = NOW()
WHERE COALESCE(rounds, 0) < 10
  AND (is_culled IS NULL OR is_culled = false);

-- Add comment for documentation
COMMENT ON COLUMN public.games.is_culled IS 'If true, game is excluded from all statistics and leaderboards';
COMMENT ON COLUMN public.games.culled_reason IS 'Reason code: ROUND_SHORT, ERROR, MANUAL, etc.';
COMMENT ON COLUMN public.games.culled_source IS 'Source: migration_backfill, auto_runtime, manual_admin';
COMMENT ON COLUMN public.games.culled_at IS 'Timestamp when game was marked as culled';
