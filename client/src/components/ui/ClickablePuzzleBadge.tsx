/**
 * 
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-10T10:04:10-04:00
 * PURPOSE: Reusable clickable puzzle badge component for consistent navigation across the app.
 * Provides click-to-navigate functionality to puzzle pages with proper hover states and styling.
 * Now displays puzzle IDs with their friendly names (e.g., "007bbfb7 - fractal").
 * Extracted from AnalyticsOverview to make it reusable across components.
 * 
 * USAGE EXAMPLES:
 * <ClickablePuzzleBadge puzzleId="007bbfb7" variant="success" />       // Shows "007bbfb7 - fractal"
 * <ClickablePuzzleBadge puzzleId="67890" variant="error" />            // Red failed puzzle  
 * <ClickablePuzzleBadge puzzleId="abcde" variant="neutral" />          // Gray not attempted
 * <ClickablePuzzleBadge puzzleId="xyz" clickable={false} />            // Non-clickable badge
 * <ClickablePuzzleBadge puzzleId="007bbfb7" showName={false} />        // Shows only ID
 * 
 * SRP and DRY check: Pass - Single responsibility for puzzle badge display and navigation
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getPuzzleName } from '@shared/utils/puzzleNames';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ClickablePuzzleBadgeProps {
  puzzleId: string;
  /**
   * Color variant for the badge
   */
  variant?: 'success' | 'error' | 'neutral' | 'default';
  /**
   * Whether the badge should be clickable (default: true)
   */
  clickable?: boolean;
  /**
   * Custom className to override default styling
   */
  className?: string;
  /**
   * Whether to open in new tab (default: true)
   */
  openInNewTab?: boolean;
  /**
   * Whether to display the puzzle name alongside the ID (default: true)
   */
  showName?: boolean;
}

const variantStyles = {
  success: 'text-green-700 border-green-300 bg-green-50 hover:bg-green-100',
  error: 'text-red-700 border-red-300 bg-red-50 hover:bg-red-100', 
  neutral: 'text-gray-700 border-gray-300 bg-gray-50 hover:bg-gray-100',
  default: 'hover:bg-gray-100'
};

export const ClickablePuzzleBadge: React.FC<ClickablePuzzleBadgeProps> = ({
  puzzleId,
  variant = 'default',
  clickable = true,
  className,
  openInNewTab = true,
  showName = true
}) => {
  const handleClick = () => {
    if (!clickable) return;
    
    const url = `/puzzle/${puzzleId}`;
    if (openInNewTab) {
      window.open(url, '_blank');
    } else {
      window.location.href = url;
    }
  };

  const puzzleName = showName ? getPuzzleName(puzzleId) : undefined;
  const tooltipContent = puzzleName ? `${puzzleId} - ${puzzleName}` : puzzleId;

  const badgeContent = (
    <Badge
      variant="outline"
      className={cn(
        clickable ? 'cursor-pointer transition-colors' : '',
        variantStyles[variant],
        className
      )}
      onClick={clickable ? handleClick : undefined}
    >
      {puzzleId}
    </Badge>
  );

  if (showName && puzzleName) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltipContent}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badgeContent;
};
