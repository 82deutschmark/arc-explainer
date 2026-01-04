/**
 * Author: Claude Haiku 4.5
 * Date: 2026-01-04
 * PURPOSE: Reusable scorecard link component for all Arc3 playgrounds.
 *          Displays a clickable link to the official Arc3 scorecard on three.arcprize.org.
 *          Shows during streaming when scorecard is opened on the backend.
 * SRP/DRY check: Pass — isolated component for scorecard display, no side effects.
 */

import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface Arc3ScorecardLinkProps {
  card_id?: string;
  url?: string;
}

/**
 * Displays a link to the official Arc3 scorecard.
 * Shows up automatically when an agent opens a scorecard during streaming.
 */
export function Arc3ScorecardLink({ card_id, url }: Arc3ScorecardLinkProps) {
  if (!card_id || !url) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-8 px-2 text-xs bg-blue-50 border-blue-200 hover:bg-blue-100"
          >
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Scorecard</span>
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold text-sm">View Official Scorecard</p>
            <p className="text-xs text-muted-foreground">
              ID: <code className="text-[11px]">{card_id}</code>
            </p>
            <p className="text-xs text-muted-foreground">
              Your run is recorded on three.arcprize.org
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
