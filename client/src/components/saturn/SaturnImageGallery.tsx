/**
 * Author: Cascade
 * Date: 2025-10-15
 * PURPOSE: Image gallery for Saturn Visual Solver - display generated PNG images
 * Shows grid visualizations created during visual pattern recognition phase
 * SRP: Single responsibility - image display
 * DRY: Pass - reusable component
 */

import React, { useMemo, useState } from 'react';
import { ImageIcon, ZoomIn } from 'lucide-react';

export type SaturnImage = {
  path: string;
  base64?: string;
  title?: string;
  subtitle?: string;
  badgeVariant?: 'training' | 'test' | 'prediction' | 'tool' | 'other';
  sequence?: number;
};

type BadgeVariant = NonNullable<SaturnImage['badgeVariant']>;

const BADGE_VARIANT_STYLES: Record<BadgeVariant, string> = {
  training: 'bg-amber-500 text-white',
  test: 'bg-sky-600 text-white',
  prediction: 'bg-emerald-600 text-white',
  tool: 'bg-purple-600 text-white',
  other: 'bg-gray-700 text-white',
};

export function SaturnImageGallery({
  images,
  isRunning = false
}: {
  images: SaturnImage[];
  isRunning?: boolean;
}) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);

  const shown = useMemo(() => (
    Array.isArray(images)
      ? images
          .filter((im) => Boolean(im?.base64))
          .map((im, idx) => ({
            ...im,
            title: im?.title || `Image ${idx + 1}`,
            badgeVariant: im?.badgeVariant ?? 'other',
            sequence: typeof im?.sequence === 'number' ? im.sequence : idx + 1,
          }))
      : []
  ), [images]);

  const renderBadge = (badge: BadgeVariant, label: string) => (
    <div className={`absolute top-1 left-1 text-xs font-semibold px-2 py-0.5 rounded ${BADGE_VARIANT_STYLES[badge]}`}>
      {label}
    </div>
  );

  return (
    <div className="bg-white border border-gray-300 rounded h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-300 bg-gray-50 px-3 py-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-700">GENERATED IMAGES</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 font-mono">{shown.length} images</span>
          {isRunning && (
            <span className="text-xs text-blue-600 font-bold">● GENERATING</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <ImageIcon className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">
              {isRunning ? 'Waiting for images...' : 'No images generated yet'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Visual representations will appear here
            </p>
          </div>
        ) : selectedImage === null ? (
          /* Grid View */
          <div className="grid grid-cols-2 gap-2">
            {shown.map((im, idx) => (
              <div
                key={`${im.path}-${idx}`}
                className="relative border border-gray-300 rounded cursor-pointer hover:border-blue-500 transition-colors"
                onClick={() => setSelectedImage(idx)}
              >
                <img
                  src={`data:image/png;base64,${im.base64}`}
                  alt={im.title || `Image ${idx + 1}`}
                  className="w-full h-auto"
                  style={{ imageRendering: 'pixelated' }}
                />
                {renderBadge(im.badgeVariant ?? 'other', im.title ?? `Image ${idx + 1}`)}
                <div className="absolute bottom-1 left-1 right-1 bg-black/60 text-white text-[10px] px-1 py-1 rounded whitespace-nowrap overflow-hidden text-ellipsis">
                  {im.subtitle || `Sequence #${im.sequence ?? idx + 1}`}
                </div>
                <button
                  className="absolute top-1 right-1 bg-black/70 text-white p-1 rounded hover:bg-black/90"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImage(idx);
                  }}
                >
                  <ZoomIn className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          /* Detail View */
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
              <span className="text-sm font-bold text-gray-700">
                {shown[selectedImage].title || `Image ${selectedImage + 1}`} ({selectedImage + 1} of {shown.length})
              </span>
              <button
                onClick={() => setSelectedImage(null)}
                className="btn btn-ghost btn-xs"
              >
                Back to Grid
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center bg-gray-100 rounded border border-gray-300 p-4">
              <img
                src={`data:image/png;base64,${shown[selectedImage].base64}`}
                alt={shown[selectedImage].title || `Image ${selectedImage + 1}`}
                className="max-w-full max-h-full"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            {shown[selectedImage].subtitle && (
              <div className="mt-2 text-xs text-gray-500 text-center">
                {shown[selectedImage].subtitle}
              </div>
            )}
            <div className="flex items-center justify-center gap-2 mt-2">
              <button
                onClick={() => setSelectedImage(Math.max(0, selectedImage - 1))}
                disabled={selectedImage === 0}
                className="btn btn-sm btn-ghost"
              >
                ← Prev
              </button>
              <button
                onClick={() => setSelectedImage(Math.min(shown.length - 1, selectedImage + 1))}
                disabled={selectedImage === shown.length - 1}
                className="btn btn-sm btn-ghost"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SaturnImageGallery;
