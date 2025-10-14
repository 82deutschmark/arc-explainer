/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-14
 * PURPOSE: Enhanced image gallery for Saturn Visual Solver - visually rich display with animations
 * Shows generated grid images with improved visual design, animations, and better user experience
 * SRP: Single responsibility - image gallery display
 * DRY: Pass - reusable component
 * DaisyUI: Fail - Uses shadcn/ui Card components (existing pattern in codebase)
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Image as ImageIcon, Camera, Eye, Grid, Maximize2, Download, Info } from 'lucide-react';

export type SaturnImage = {
  path: string;
  base64?: string;
  phase?: string;
  timestamp?: Date;
  metadata?: {
    width?: number;
    height?: number;
    confidence?: number;
    description?: string;
  };
};

export function SaturnImageGallery({
  images,
  title = '📸 Generated Images',
  isRunning = false
}: {
  images: SaturnImage[];
  title?: string;
  isRunning?: boolean;
}) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'focus'>('grid');

  const shown = Array.isArray(images) ? images.filter((i) => i?.base64) : [];

  const formatTimestamp = (timestamp?: Date) => {
    if (!timestamp) return '';
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card className="border-slate-300 bg-gradient-to-br from-slate-50 to-white shadow-lg">
      <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-blue-200">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-slate-700 flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-md">
              <Camera className="w-5 h-5 text-white" />
            </div>
            {title}
          </CardTitle>

          <div className="flex items-center gap-3">
            <div className="text-sm font-mono text-slate-600 bg-white/70 px-3 py-1 rounded-full border border-slate-300">
              {shown.length} image{shown.length === 1 ? '' : 's'}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'grid'
                    ? 'bg-cyan-500 text-white shadow-md'
                    : 'bg-white/70 text-slate-600 hover:bg-white hover:shadow-sm'
                }`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('focus')}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'focus'
                    ? 'bg-cyan-500 text-white shadow-md'
                    : 'bg-white/70 text-slate-600 hover:bg-white hover:shadow-sm'
                }`}
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>

            {isRunning && (
              <div className="flex items-center gap-2 text-cyan-600">
                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                <span className="text-sm font-medium">Generating...</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {shown.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full flex items-center justify-center shadow-inner">
              <ImageIcon className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              {isRunning ? '🎨 Creating Visual Solutions' : '📷 Ready for Visual Analysis'}
            </h3>
            <p className="text-slate-600 max-w-md mx-auto leading-relaxed">
              {isRunning
                ? 'Saturn is generating visual representations of puzzle solutions and analysis steps'
                : 'Advanced visual pattern recognition and solution visualization will appear here'
              }
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {shown.map((im, idx) => (
                <div
                  key={`${im.path}-${idx}`}
                  className={`relative group cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl ${
                    selectedImage === idx ? 'ring-2 ring-cyan-400 ring-offset-2' : ''
                  }`}
                  onClick={() => {
                    setSelectedImage(idx);
                    setViewMode('focus');
                  }}
                >
                  {/* Image Container */}
                  <div className="relative aspect-square bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg border-2 border-slate-300 overflow-hidden shadow-sm group-hover:border-cyan-400 group-hover:shadow-lg">
                    <img
                      src={`data:image/png;base64,${im.base64}`}
                      alt={`Generated grid ${idx + 1}`}
                      className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-110"
                    />

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute bottom-2 left-2 right-2">
                        <div className="text-white text-xs font-bold mb-1">
                          Step {idx + 1}
                        </div>
                        {im.phase && (
                          <div className="text-white/80 text-xs bg-black/40 px-2 py-1 rounded">
                            {im.phase}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Phase Badge */}
                    {im.phase && (
                      <div className="absolute top-2 left-2 px-2 py-1 bg-blue-500/90 text-white text-xs font-medium rounded-full shadow-sm">
                        {im.phase}
                      </div>
                    )}

                    {/* Generation Time */}
                    {im.timestamp && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 text-white text-xs rounded-full">
                        {formatTimestamp(im.timestamp)}
                      </div>
                    )}
                  </div>

                  {/* Image Info Card */}
                  <div className="mt-2 p-2 bg-white/80 rounded-lg border border-slate-200">
                    <div className="text-sm font-semibold text-slate-700 truncate">
                      Image {idx + 1}
                    </div>
                    {im.metadata?.description && (
                      <div className="text-xs text-slate-600 mt-1 line-clamp-2">
                        {im.metadata.description}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Focus View - Single Large Image */
          <div className="relative">
            {selectedImage !== null && shown[selectedImage] && (
              <>
                {/* Main Image Display */}
                <div className="relative bg-gradient-to-br from-slate-900 to-black p-8 min-h-[400px] flex items-center justify-center">
                  <div className="relative max-w-full max-h-full">
                    <img
                      src={`data:image/png;base64,${shown[selectedImage].base64}`}
                      alt={`Selected image ${selectedImage + 1}`}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border-2 border-white/20"
                    />

                    {/* Image Overlay Controls */}
                    <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-black/60 px-4 py-2 rounded-lg border border-white/20">
                          <span className="text-white font-bold">Image {selectedImage + 1} of {shown.length}</span>
                        </div>

                        {shown[selectedImage].phase && (
                          <div className="bg-blue-500/80 px-3 py-2 rounded-lg border border-blue-400/50">
                            <span className="text-white font-medium text-sm">{shown[selectedImage].phase}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewMode('grid')}
                          className="p-2 bg-black/60 hover:bg-black/80 rounded-lg text-white/80 hover:text-white transition-colors"
                        >
                          <Grid className="w-4 h-4" />
                        </button>
                        <button className="p-2 bg-black/60 hover:bg-black/80 rounded-lg text-white/80 hover:text-white transition-colors">
                          <Maximize2 className="w-4 h-4" />
                        </button>
                        <button className="p-2 bg-black/60 hover:bg-black/80 rounded-lg text-white/80 hover:text-white transition-colors">
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Image Metadata Panel */}
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="bg-black/60 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-white font-semibold">Image Details</h4>
                          <button className="p-1 bg-white/20 hover:bg-white/30 rounded text-white/80 hover:text-white transition-colors">
                            <Info className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          {selectedImage !== null && shown[selectedImage]?.metadata?.width && shown[selectedImage]?.metadata?.height && (
                            <div>
                              <div className="text-white/60 text-xs">Dimensions</div>
                              <div className="text-white font-medium">
                                {shown[selectedImage]!.metadata!.width} × {shown[selectedImage]!.metadata!.height}
                              </div>
                            </div>
                          )}

                          {shown[selectedImage]?.metadata?.confidence && (
                            <div>
                              <div className="text-white/60 text-xs">Confidence</div>
                              <div className="text-white font-medium">
                                {Math.round(shown[selectedImage]?.metadata?.confidence || 0)}%
                              </div>
                            </div>
                          )}

                          {shown[selectedImage]?.timestamp && (
                            <div>
                              <div className="text-white/60 text-xs">Generated</div>
                              <div className="text-white font-medium">
                                {formatTimestamp(shown[selectedImage].timestamp)}
                              </div>
                            </div>
                          )}

                          <div>
                            <div className="text-white/60 text-xs">Phase</div>
                            <div className="text-white font-medium">
                              {shown[selectedImage]?.phase || 'Analysis'}
                            </div>
                          </div>
                        </div>

                        {shown[selectedImage]?.metadata?.description && (
                          <div className="mt-3 pt-3 border-t border-white/20">
                            <div className="text-white/60 text-xs mb-1">Description</div>
                            <div className="text-white/90 text-sm leading-relaxed">
                              {shown[selectedImage]!.metadata!.description}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Navigation Controls */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2">
                  <button
                    onClick={() => setSelectedImage(prev => prev !== null ? Math.max(0, prev - 1) : 0)}
                    disabled={selectedImage === 0}
                    className="p-3 bg-black/60 hover:bg-black/80 rounded-full text-white/80 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  <div className="px-4 py-2 bg-black/60 rounded-lg text-white text-sm font-mono">
                    {selectedImage + 1} / {shown.length}
                  </div>

                  <button
                    onClick={() => setSelectedImage(prev => prev !== null ? Math.min(shown.length - 1, prev + 1) : 0)}
                    disabled={selectedImage === shown.length - 1}
                    className="p-3 bg-black/60 hover:bg-black/80 rounded-full text-white/80 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SaturnImageGallery;
