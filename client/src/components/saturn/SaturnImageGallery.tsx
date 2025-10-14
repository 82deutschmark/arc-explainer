/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-14
 * PURPOSE: Image gallery for Saturn Visual Solver - displays generated grid images prominently
 * Shows images in a responsive grid with base64 preview support. Always visible, shows placeholder when empty.
 * SRP: Single responsibility - image gallery display
 * DRY: Pass - reusable component
 * DaisyUI: Fail - Uses shadcn/ui Card components (existing pattern in codebase)
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export type SaturnImage = { path: string; base64?: string };

export function SaturnImageGallery({
  images,
  title = '📸 Generated Images',
  isRunning = false
}: {
  images: SaturnImage[];
  title?: string;
  isRunning?: boolean;
}) {
  const shown = Array.isArray(images) ? images.filter((i) => i?.base64) : [];

  return (
    <Card className="border-gray-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold text-gray-700">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <div className="text-xs font-mono text-gray-500">{shown.length} images</div>
            {isRunning && <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {shown.length === 0 ? (
          <div className="text-center text-sm text-gray-500 py-8">
            {isRunning ? '⏳ Generating images...' : '💤 No images yet - click START to begin'}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto">
            {shown.map((im, idx) => (
              <div
                key={`${im.path}-${idx}`}
                className="relative aspect-square bg-gray-100 rounded border border-gray-300 overflow-hidden hover:border-blue-500 transition-colors"
              >
                <img
                  src={`data:image/png;base64,${im.base64}`}
                  alt={`Generated grid ${idx + 1}`}
                  className="w-full h-full object-contain"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[9px] px-1 py-0.5 truncate font-mono">
                  {im.path.split('/').pop() || `img-${idx + 1}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SaturnImageGallery;
