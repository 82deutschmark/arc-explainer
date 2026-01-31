/*
 * Author: Cascade (Claude)
 * Date: 2026-01-31
 * PURPOSE: Banner component displayed on all archived ARC3 preview pages.
 *          Notifies users that this content is historical and points to the new community games hub.
 * SRP/DRY check: Pass — single-purpose notification banner for archive pages.
 */

import { AlertTriangle, Archive, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface Arc3ArchiveBannerProps {
  /** Optional custom message to display */
  message?: string;
  /** Whether to show the link to community games */
  showCommunityLink?: boolean;
  /** Compact mode for tighter layouts */
  compact?: boolean;
}

export function Arc3ArchiveBanner({
  message,
  showCommunityLink = true,
  compact = false,
}: Arc3ArchiveBannerProps) {
  const defaultMessage = 
    "This page is part of the archived ARC3 Preview. The content here represents historical data " +
    "from the original preview period and may be outdated.";

  return (
    <Alert 
      variant="default" 
      className={`border-amber-500/50 bg-amber-500/10 ${compact ? 'py-2' : ''}`}
    >
      <Archive className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-700 dark:text-amber-400 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        Archived Content
      </AlertTitle>
      <AlertDescription className="text-amber-600/90 dark:text-amber-300/90">
        <p className={compact ? 'text-sm' : ''}>
          {message || defaultMessage}
        </p>
        {showCommunityLink && (
          <div className="mt-3">
            <Link href="/arc3">
              <Button 
                variant="outline" 
                size={compact ? 'sm' : 'default'}
                className="border-amber-500/50 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
              >
                Visit Community Games Hub
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

export default Arc3ArchiveBanner;
