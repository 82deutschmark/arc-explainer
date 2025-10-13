/**
 * client/src/components/saturn/SaturnHeroGallery.tsx
 *
 * Author: code-supernova
 * Date: 2025-10-13
 * PURPOSE: Hero-style image gallery for Saturn Visual Solver with large, prominent display
 * of generated images. Features responsive grid layout, loading states, and modern styling.
 *
 * SRP/DRY check: Pass - Single responsibility for image gallery display
 * DaisyUI: Pass - Uses DaisyUI card and grid components exclusively
 */

import React from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';

interface GalleryImage {
  path: string;
  base64?: string;
}

interface SaturnHeroGalleryProps {
  galleryImages: GalleryImage[];
  isRunning: boolean;
  taskId: string;
}

export default function SaturnHeroGallery({ galleryImages, isRunning, taskId }: SaturnHeroGalleryProps) {
  const hasImages = galleryImages.length > 0;

  return (
    <div className="card bg-white/90 backdrop-blur-md border-0 shadow-2xl">
      <div className="card-body p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <ImageIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Generated Visuals</h2>
              <p className="text-sm text-gray-600">
                {hasImages ? `${galleryImages.length} image${galleryImages.length === 1 ? '' : 's'} generated` : 'Images will appear here as Saturn processes'}
              </p>
            </div>
          </div>

          {isRunning && (
            <div className="flex items-center gap-2 text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">Generating...</span>
            </div>
          )}
        </div>

        {/* Image Gallery */}
        {!hasImages && !isRunning ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <div className="p-4 bg-gray-100 rounded-full mb-4">
              <ImageIcon className="h-12 w-12" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Images Yet</h3>
            <p className="text-center max-w-md">
              Launch Saturn Visual Solver to start generating visual solutions for this puzzle.
            </p>
          </div>
        ) : (
          /* Image Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {galleryImages.map((image, index) => (
              <div key={`${image.path}-${index}`} className="group">
                <div className="card bg-white border-2 border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300">
                  <div className="card-body p-3">
                    {/* Image Container */}
                    <div className="relative aspect-square bg-gray-50 rounded-lg overflow-hidden mb-3">
                      {image.base64 ? (
                        <img
                          src={`data:image/png;base64,${image.base64}`}
                          alt={`Generated image ${index + 1}`}
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-center text-gray-400">
                            <ImageIcon className="h-8 w-8 mx-auto mb-2" />
                            <p className="text-xs">Loading...</p>
                          </div>
                        </div>
                      )}

                      {/* Image overlay with metadata */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="absolute bottom-2 left-2 right-2">
                          <div className="text-white text-xs font-medium">
                            Image {index + 1}
                          </div>
                          <div className="text-white/80 text-xs">
                            {image.path}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Image Info */}
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-gray-800 truncate">
                        Step {index + 1}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {image.path}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Loading Skeleton for new images */}
            {isRunning && (
              <div className="animate-pulse">
                <div className="card bg-gray-100 border-2 border-dashed border-gray-300">
                  <div className="card-body p-3">
                    <div className="aspect-square bg-gray-200 rounded-lg mb-3 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
