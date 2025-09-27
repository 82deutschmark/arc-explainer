/**
 * 
 * Author: Cascade
 * Date: 2025-09-26T20:58:02-04:00
 * PURPOSE: Reusable clickable puzzle badge component for consistent navigation across the app.
 * Provides click-to-navigate functionality to puzzle pages with proper hover states and styling.
 * Extracted from AnalyticsOverview to make it reusable across components.
 * 
 * USAGE EXAMPLES:
 * <ClickablePuzzleBadge puzzleId="12345" variant="success" />       // Green solved puzzle
 * <ClickablePuzzleBadge puzzleId="67890" variant="error" />         // Red failed puzzle  
 * <ClickablePuzzleBadge puzzleId="abcde" variant="neutral" />       // Gray not attempted
 * <ClickablePuzzleBadge puzzleId="xyz" clickable={false} />         // Non-clickable badge
 * 
 * SRP and DRY check: Pass - Single responsibility for puzzle badge display and navigation
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
  openInNewTab = true
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

  const baseClasses = clickable 
    ? 'cursor-pointer transition-colors'
    : '';

  const variantClasses = variantStyles[variant];

  return (
    <Badge
      variant="outline"
      className={cn(
        baseClasses,
        variantClasses,
        className
      )}
      onClick={clickable ? handleClick : undefined}
      title={clickable ? `Click to view puzzle ${puzzleId}` : undefined}
    >
      {puzzleId}
    </Badge>
  );
};
