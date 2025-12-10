/*
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-07
 * PURPOSE: Shows the base64 image preview of what the vision-enabled agent sees
 *          when inspecting the game state. Displays the frameImage from
 *          inspect_game_state tool results.
 * SRP/DRY check: Pass — isolates agent vision preview display.
 */

import React from 'react';
import { Eye } from 'lucide-react';

interface Arc3AgentVisionPreviewProps {
  frameImage: string | null;
  width?: number;
  height?: number;
  className?: string;
}

export const Arc3AgentVisionPreview: React.FC<Arc3AgentVisionPreviewProps> = ({
  frameImage,
  width = 256,
  height = 256,
  className = '',
}) => {
  if (!frameImage) {
    return null;
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
        <Eye className="h-3 w-3" />
        <span>Agent's View</span>
      </div>
      <div className="border border-muted rounded overflow-hidden bg-muted/30">
        <img
          src={frameImage}
          alt="Agent's visual inspection of game state"
          style={{ width: `${width}px`, height: `${height}px` }}
          className="object-contain w-full"
        />
      </div>
      <p className="text-[9px] text-muted-foreground">
        Vision model receives this image when inspecting game state
      </p>
    </div>
  );
};

export default Arc3AgentVisionPreview;
