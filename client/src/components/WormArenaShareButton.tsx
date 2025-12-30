/**
 * Author: Cascade
 * Date: 2025-12-27
 * PURPOSE: Reusable Share/Tweet button for Worm Arena matches.
 *          Generates Twitter/X intent URLs with pre-filled tweet text
 *          and replay links. Extensible to other platforms.
 *
 * SRP/DRY check: Pass - focused on share functionality only.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Share2, Twitter, Copy, Check, Link, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface WormArenaShareData {
  gameId: string;
  modelA: string;
  modelB: string;
  roundsPlayed: number;
  maxFinalScore?: number;
  scoreDelta?: number;
  totalCost?: number;
  highlightReason?: string;
  durationSeconds?: number;
  sumFinalScores?: number;
}

export interface WormArenaShareButtonProps {
  /** Game data for generating share text */
  data: WormArenaShareData;
  /** Optional custom share text override */
  customText?: string;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Additional CSS classes */
  className?: string;
  /** Show dropdown with options or direct Twitter link */
  showDropdown?: boolean;
  /** Optional override for base site URL (tests) */
  siteBaseUrlOverride?: string;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const DEFAULT_SITE_BASE_URL = 'https://arc.markbarney.net';
const API_BASE = '';

/**
 * Shorten a model slug by removing common provider prefixes if needed.
 */
function shortenModelSlug(slug: string, maxLen: number = 25): string {
  if (slug.length <= maxLen) return slug;
  const parts = slug.split('/');
  if (parts.length > 1) {
    const shortened = parts.slice(1).join('/');
    if (shortened.length <= maxLen) return shortened;
  }
  return slug.slice(0, maxLen - 3) + '...';
}

/**
 * Format duration in human-readable form.
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) {
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hours}h ${remainMins}m` : `${hours}h`;
}

/**
 * Normalize game ID for URL usage.
 */
function normalizeGameId(raw: string): string {
  let normalized = (raw ?? '').trim();
  if (normalized.startsWith('snake_game_')) {
    normalized = normalized.slice('snake_game_'.length);
  }
  if (normalized.endsWith('.json')) {
    normalized = normalized.slice(0, -'.json'.length);
  }
  return normalized;
}

/**
 * Build the replay URL for a game.
 */
export function buildWormArenaReplayUrl(gameId: string, siteBaseUrl: string = DEFAULT_SITE_BASE_URL): string {
  const normalized = normalizeGameId(gameId);
  return `${siteBaseUrl}/worm-arena?matchId=${encodeURIComponent(normalized)}`;
}

/**
 * Generate tweet text from game data.
 */
export function generateWormArenaTweetText(data: WormArenaShareData): string {
  const modelA = shortenModelSlug(data.modelA, 25);
  const modelB = shortenModelSlug(data.modelB, 25);
  const rounds = data.roundsPlayed;
  const maxScore = data.maxFinalScore ?? 0;
  const scoreDelta = data.scoreDelta ?? 0;
  const cost = data.totalCost ?? 0;
  const duration = data.durationSeconds ? formatDuration(data.durationSeconds) : null;
  const sumScores = data.sumFinalScores ?? 0;
  const reason = data.highlightReason?.toLowerCase() ?? '';

  // Template 1: Tie / close match
  if (scoreDelta === 0 && maxScore > 0) {
    return `${modelA} vs ${modelB}: ${rounds}-round battle ended in a ${maxScore}-${maxScore} tie! Watch the AI showdown:`;
  }

  // Template 2: High score
  if (maxScore >= 20 || sumScores >= 35 || reason.includes('apple') || reason.includes('score')) {
    return `${modelA} grabbed ${maxScore} apples vs ${modelB} in ${rounds} rounds. Watch:`;
  }

  // Template 3: Long/expensive
  if (duration || cost >= 0.5) {
    const costStr = cost >= 0.01 ? ` ($${cost.toFixed(2)} run)` : '';
    const durationStr = duration ? ` ${duration}` : '';
    return `${modelA} vs ${modelB}: ${rounds} rounds${durationStr}${costStr}. Watch:`;
  }

  // Template 4: Use highlight reason if available and short
  if (data.highlightReason && data.highlightReason.length < 100) {
    const cleanReason = data.highlightReason.replace(/^Pinned:\s*/i, '');
    return `${modelA} vs ${modelB}: ${cleanReason} Watch:`;
  }

  // Default template
  return `${modelA} vs ${modelB}: ${rounds} rounds, max ${maxScore} apples. Watch the AI showdown:`;
}

/**
 * Build Twitter/X intent URL.
 */
export function buildTwitterIntentUrl(text: string, url: string): string {
  const params = new URLSearchParams({
    text: text,
    url: url,
  });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function WormArenaShareButton({
  data,
  customText,
  variant = 'outline',
  size = 'sm',
  className = '',
  showDropdown = true,
  siteBaseUrlOverride,
}: WormArenaShareButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const [videoAvailable, setVideoAvailable] = React.useState<boolean | null>(null);
  const [checkingVideo, setCheckingVideo] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);

  const replayUrl = buildWormArenaReplayUrl(data.gameId, siteBaseUrlOverride ?? DEFAULT_SITE_BASE_URL);
  const tweetText = customText || generateWormArenaTweetText(data);
  const twitterUrl = buildTwitterIntentUrl(tweetText, replayUrl);

  // Check MP4 availability once per gameId
  React.useEffect(() => {
    let cancelled = false;
    const checkAvailability = async () => {
      setCheckingVideo(true);
      setDownloadError(null);
      try {
        const res = await fetch(`${API_BASE}/api/wormarena/videos/${encodeURIComponent(data.gameId)}/availability`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as { success: boolean; exists?: boolean };
        if (cancelled) return;
        setVideoAvailable(json.success && json.exists === true);
      } catch (err: any) {
        if (cancelled) return;
        setVideoAvailable(false);
        setDownloadError(err?.message || 'Unavailable');
      } finally {
        if (!cancelled) setCheckingVideo(false);
      }
    };
    void checkAvailability();
    return () => {
      cancelled = true;
    };
  }, [data.gameId]);

  const handleCopyLink = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(replayUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  }, [replayUrl]);

  const handleCopyTweet = React.useCallback(async () => {
    try {
      const fullText = `${tweetText} ${replayUrl}`;
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy tweet:', err);
    }
  }, [tweetText, replayUrl]);

  const handleTwitterShare = React.useCallback(() => {
    window.open(twitterUrl, '_blank', 'noopener,noreferrer,width=600,height=400');
  }, [twitterUrl]);

  const handleDownload = React.useCallback(() => {
    if (!videoAvailable) return;
    const url = `${API_BASE}/api/wormarena/videos/${encodeURIComponent(data.gameId)}/download`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [videoAvailable, data.gameId]);

  // Simple button mode (direct to Twitter)
  if (!showDropdown) {
    return (
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleTwitterShare}
        title="Share on Twitter/X"
      >
        <Twitter className="h-4 w-4 mr-1" />
        Tweet
      </Button>
    );
  }

  // Dropdown mode with multiple options
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Share2 className="h-4 w-4 mr-1" />
          Tweet/Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleTwitterShare}>
          <Twitter className="h-4 w-4 mr-2" />
          Share on Twitter/X
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleDownload}
          disabled={checkingVideo || !videoAvailable}
          className={cn(
            (checkingVideo || !videoAvailable) && 'opacity-70 cursor-not-allowed',
          )}
        >
          {checkingVideo ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {checkingVideo
            ? 'Checking video...'
            : videoAvailable
            ? 'Download MP4'
            : 'Video not available'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyTweet}>
          {copied ? (
            <Check className="h-4 w-4 mr-2 text-green-600" />
          ) : (
            <Copy className="h-4 w-4 mr-2" />
          )}
          Copy tweet text
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyLink}>
          {copied ? (
            <Check className="h-4 w-4 mr-2 text-green-600" />
          ) : (
            <Link className="h-4 w-4 mr-2" />
          )}
          Copy replay link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// -----------------------------------------------------------------------------
// Exports for external use
// -----------------------------------------------------------------------------

export {
  shortenModelSlug,
  formatDuration,
  normalizeGameId,
};
