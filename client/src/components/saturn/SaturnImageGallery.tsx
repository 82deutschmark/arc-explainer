/**
 * client/src/components/saturn/SaturnImageGallery.tsx
 *
 * Simple gallery component to display streamed Saturn images during analysis.
 * Expects an array of { path, base64? }. If base64 is present, renders inline.
 * Otherwise skips rendering that item.
 *
 * How the project uses this:
 * - Consumed by `client/src/pages/SaturnVisualSolver.tsx`, fed with the
 *   `galleryImages` accumulated in `useSaturnProgress()` from server events.
 *
 * Author: Cascade (model: Cascade)
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export type SaturnImage = { path: string; base64?: string };

export function SaturnImageGallery({ images, title = 'Generated Images' }: {
  images: SaturnImage[];
  title?: string;
}) {
  const shown = Array.isArray(images) ? images.filter((i) => i?.base64) : [];
  if (!shown.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {shown.map((im, idx) => (
            <div key={`${im.path}-${idx}`} className="border rounded-lg p-2 bg-white">
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <img
                src={`data:image/png;base64,${im.base64}`}
                className="w-full h-auto object-contain rounded"
              />
              <div className="mt-2 text-[10px] text-gray-500 break-all">{im.path}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default SaturnImageGallery;
