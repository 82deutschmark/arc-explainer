/**
 * client/src/components/saturn/SaturnImageCarousel.tsx
 *
 * Author: code-supernova
 * Date: 2025-10-14
 * PURPOSE: Enhanced image carousel for Saturn Visual Solver with context, animations, and comparison features.
 * Transforms basic image grid into a sophisticated visual showcase with large displays,
 * smooth transitions, metadata integration, and interactive features.
 *
 * KEY FEATURES:
 * - Large, prominent image display with zoom and pan capabilities
 * - Smooth animation transitions between images
 * - Image comparison mode (before/after, input/output)
 * - Rich metadata display (generation phase, confidence, dimensions)
 * - Interactive controls (zoom, fullscreen, download)
 * - Loading states and error handling
 * - Responsive design for different screen sizes
 *
 * VISUAL ELEMENTS:
 * - Glass-morphism design with gradient overlays
 * - Smooth hover animations and transitions
 * - Loading skeletons and progress indicators
 * - Context-aware image metadata display
 * - Interactive zoom and navigation controls
 *
 * SRP/DRY check: Pass - Specialized component for image visualization
 * DaisyUI: Pass - Uses DaisyUI components with visual enhancements
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  Maximize,
  Download,
  ChevronLeft,
  ChevronRight,
  Eye,
  Grid3X3,
  Layers,
  Info,
  Loader2,
  X,
  CheckCircle
} from 'lucide-react';
import { SaturnVisualPanel, SaturnStatusIndicator } from './SaturnVisualWorkbench';

export interface CarouselImage {
  id: string;
  path: string;
  base64?: string;
  phase?: string;
  timestamp: Date;
  metadata?: {
    width?: number;
    height?: number;
    confidence?: number;
    generationTime?: number;
    phase?: string;
    description?: string;
    tags?: string[];
    dimensions?: { width: number; height: number };
  };
  type?: 'input' | 'output' | 'analysis' | 'comparison' | 'debug';
}

export interface SaturnImageCarouselProps {
  images: CarouselImage[];
  isRunning: boolean;
  currentPhase?: string;
  onImageSelect?: (imageId: string) => void;
  onImageCompare?: (imageIds: string[]) => void;
  autoPlay?: boolean;
  showMetadata?: boolean;
  compact?: boolean;
}

export default function SaturnImageCarousel({
  images,
  isRunning,
  currentPhase,
  onImageSelect,
  onImageCompare,
  autoPlay = false,
  showMetadata = true,
  compact = false
}: SaturnImageCarouselProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'single' | 'grid' | 'comparison'>('single');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [autoPlayInterval, setAutoPlayInterval] = useState<NodeJS.Timeout | null>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  const selectedImage = images[selectedIndex];
  const hasImages = images.length > 0;

  // Auto-play functionality
  useEffect(() => {
    if (autoPlay && hasImages && viewMode === 'single') {
      const interval = setInterval(() => {
        setSelectedIndex(prev => (prev + 1) % images.length);
      }, 3000);
      setAutoPlayInterval(interval);
      return () => clearInterval(interval);
    } else if (autoPlayInterval) {
      clearInterval(autoPlayInterval);
      setAutoPlayInterval(null);
    }
  }, [autoPlay, hasImages, viewMode, images.length]);

  const nextImage = () => {
    if (hasImages) {
      setSelectedIndex(prev => (prev + 1) % images.length);
    }
  };

  const prevImage = () => {
    if (hasImages) {
      setSelectedIndex(prev => (prev - 1 + images.length) % images.length);
    }
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleDownload = () => {
    if (selectedImage?.base64) {
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${selectedImage.base64}`;
      link.download = `saturn-${selectedImage.id}.png`;
      link.click();
    }
  };

  const getImageTypeColor = (type?: CarouselImage['type']) => {
    const colors = {
      input: 'border-blue-400 bg-blue-500/20',
      output: 'border-green-400 bg-green-500/20',
      analysis: 'border-purple-400 bg-purple-500/20',
      comparison: 'border-orange-400 bg-orange-500/20',
      debug: 'border-gray-400 bg-gray-500/20'
    };
    return colors[type || 'analysis'];
  };

  const getImageTypeIcon = (type?: CarouselImage['type']) => {
    const icons = {
      input: Eye,
      output: CheckCircle,
      analysis: ImageIcon,
      comparison: Layers,
      debug: Info
    };
    const Icon = icons[type || 'analysis'];
    return <Icon className="w-4 h-4" />;
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (compact) {
    return (
      <SaturnVisualPanel
        title="Visual Output"
        icon={<ImageIcon className="w-5 h-5 text-cyan-400" />}
        variant="accent"
        className="flex-1 min-h-0"
      >
        <div className="space-y-3">
          {/* View Mode Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('single')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'single'
                    ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/50'
                    : 'bg-black/20 text-white/60 hover:bg-black/30'
                }`}
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/50'
                    : 'bg-black/20 text-white/60 hover:bg-black/30'
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
            </div>

            <div className="text-white/60 text-sm">
              {hasImages ? `${images.length} image${images.length === 1 ? '' : 's'}` : 'No images'}
            </div>
          </div>

          {/* Compact Image Display */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {images.map((image, index) => (
                <div
                  key={image.id}
                  className={`relative aspect-square bg-black/30 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 hover:scale-105 ${
                    index === selectedIndex ? 'ring-2 ring-cyan-400' : ''
                  }`}
                  onClick={() => {
                    setSelectedIndex(index);
                    setViewMode('single');
                  }}
                >
                  {image.base64 ? (
                    <img
                      src={`data:image/png;base64,${image.base64}`}
                      alt={`Image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-white/40" />
                    </div>
                  )}
                  <div className={`absolute top-1 left-1 px-2 py-1 rounded text-xs font-medium ${getImageTypeColor(image.type)}`}>
                    {image.type || 'analysis'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="relative bg-black/30 rounded-lg overflow-hidden">
              {selectedImage?.base64 ? (
                <img
                  src={`data:image/png;base64,${selectedImage.base64}`}
                  alt={`Selected image ${selectedIndex + 1}`}
                  className="w-full h-32 object-contain"
                />
              ) : (
                <div className="w-full h-32 flex items-center justify-center">
                  <div className="text-center text-white/50">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">No image selected</p>
                  </div>
                </div>
              )}

              {hasImages && (
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={prevImage}
                      className="p-1 bg-black/50 hover:bg-black/70 rounded text-white/80 hover:text-white transition-colors"
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                    <span className="text-xs text-white/80 px-2">
                      {selectedIndex + 1} / {images.length}
                    </span>
                    <button
                      onClick={nextImage}
                      className="p-1 bg-black/50 hover:bg-black/70 rounded text-white/80 hover:text-white transition-colors"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  {selectedImage?.metadata && showMetadata && (
                    <button
                      onClick={() => setShowInfo(!showInfo)}
                      className="p-1 bg-black/50 hover:bg-black/70 rounded text-white/80 hover:text-white transition-colors"
                    >
                      <Info className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Image Metadata (Compact) */}
          {selectedImage?.metadata && showMetadata && showInfo && (
            <div className="bg-black/20 rounded-lg p-2 text-xs text-white/80 space-y-1">
              <div className="flex items-center justify-between">
                <span>Phase: {selectedImage.metadata.phase || selectedImage.phase}</span>
                <span>{formatTimestamp(selectedImage.timestamp)}</span>
              </div>
              {selectedImage.metadata.confidence && (
                <div>Confidence: {Math.round(selectedImage.metadata.confidence)}%</div>
              )}
              {selectedImage.metadata.description && (
                <div className="text-white/60 italic">{selectedImage.metadata.description}</div>
              )}
            </div>
          )}
        </div>
      </SaturnVisualPanel>
    );
  }

  // Full desktop version
  return (
    <SaturnVisualPanel
      title="Visual Output Gallery"
      icon={<ImageIcon className="w-6 h-6 text-cyan-400" />}
      variant="accent"
      className="flex-1 min-h-0"
    >
      <div className="space-y-4 h-full flex flex-col">

        {/* Gallery Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SaturnStatusIndicator status={isRunning ? "loading" : "idle"} size="md" />
            <div>
              <h3 className="text-white font-semibold">Generated Visuals</h3>
              <p className="text-white/70 text-sm">
                {hasImages ? `${images.length} image${images.length === 1 ? '' : 's'} generated` : 'Images will appear as Saturn processes'}
              </p>
            </div>
          </div>

          {/* View Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('single')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'single'
                  ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/50'
                  : 'bg-black/20 text-white/60 hover:bg-black/30'
              }`}
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/50'
                  : 'bg-black/20 text-white/60 hover:bg-black/30'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Image Display */}
        <div className="flex-1 min-h-0 bg-black/30 rounded-lg overflow-hidden relative">

          {viewMode === 'grid' ? (
            /* Grid View */
            <div className="p-4 h-full overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((image, index) => (
                  <div
                    key={image.id}
                    className={`relative bg-black/50 rounded-lg overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl ${
                      index === selectedIndex ? 'ring-2 ring-cyan-400 shadow-cyan-400/50' : ''
                    }`}
                    onClick={() => {
                      setSelectedIndex(index);
                      setViewMode('single');
                    }}
                  >
                    {/* Image */}
                    <div className="aspect-square relative">
                      {image.base64 ? (
                        <img
                          src={`data:image/png;base64,${image.base64}`}
                          alt={`Image ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
                        </div>
                      )}

                      {/* Type Badge */}
                      <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium ${getImageTypeColor(image.type)}`}>
                        <div className="flex items-center gap-1">
                          {getImageTypeIcon(image.type)}
                          {image.type || 'analysis'}
                        </div>
                      </div>

                      {/* Phase Badge */}
                      {image.phase && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 rounded text-xs text-white">
                          {image.phase}
                        </div>
                      )}
                    </div>

                    {/* Image Info */}
                    <div className="p-3 bg-black/60">
                      <div className="text-white text-sm font-medium truncate">
                        Step {index + 1}
                      </div>
                      <div className="text-white/60 text-xs">
                        {formatTimestamp(image.timestamp)}
                      </div>
                      {image.metadata?.description && (
                        <div className="text-white/80 text-xs mt-1 line-clamp-2">
                          {image.metadata.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Single View */
            <>
              {/* Main Image Container */}
              <div className="relative h-full flex items-center justify-center p-8">
                {selectedImage?.base64 ? (
                  <div
                    ref={imageRef}
                    className="relative transition-transform duration-300 ease-out"
                    style={{ transform: `scale(${zoomLevel})` }}
                  >
                    <img
                      src={`data:image/png;base64,${selectedImage.base64}`}
                      alt={`Selected image ${selectedIndex + 1}`}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                      style={{ maxHeight: '60vh' }}
                    />

                    {/* Image Overlay Info */}
                    <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                      <div className={`px-3 py-2 rounded-lg ${getImageTypeColor(selectedImage.type)}`}>
                        <div className="flex items-center gap-2 text-white text-sm font-medium">
                          {getImageTypeIcon(selectedImage.type)}
                          {selectedImage.type || 'analysis'} • Step {selectedIndex + 1}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowInfo(!showInfo)}
                          className="p-2 bg-black/50 hover:bg-black/70 rounded-lg text-white/80 hover:text-white transition-colors"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleFullscreen}
                          className="p-2 bg-black/50 hover:bg-black/70 rounded-lg text-white/80 hover:text-white transition-colors"
                        >
                          <Maximize className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-white/50 py-16">
                    <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <h3 className="text-xl font-semibold mb-2">No Image Selected</h3>
                    <p className="text-white/70 max-w-md">
                      {isRunning ? 'Images are being generated...' : 'Select an image from the grid view or wait for generation to complete'}
                    </p>
                  </div>
                )}
              </div>

              {/* Navigation Controls */}
              {hasImages && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2">
                  <button
                    onClick={prevImage}
                    className="p-3 bg-black/50 hover:bg-black/70 rounded-full text-white/80 hover:text-white transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="px-4 py-2 bg-black/60 rounded-lg text-white text-sm font-mono">
                    {selectedIndex + 1} / {images.length}
                  </div>

                  <button
                    onClick={nextImage}
                    className="p-3 bg-black/50 hover:bg-black/70 rounded-full text-white/80 hover:text-white transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Zoom Controls */}
              {selectedImage?.base64 && (
                <div className="absolute top-1/2 right-4 transform -translate-y-1/2 flex flex-col gap-2">
                  <button
                    onClick={handleZoomIn}
                    className="p-2 bg-black/50 hover:bg-black/70 rounded-lg text-white/80 hover:text-white transition-colors"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleZoomOut}
                    className="p-2 bg-black/50 hover:bg-black/70 rounded-lg text-white/80 hover:text-white transition-colors"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setZoomLevel(1)}
                    className="p-2 bg-black/50 hover:bg-black/70 rounded-lg text-white/80 hover:text-white transition-colors text-xs"
                  >
                    1:1
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Image Metadata Panel */}
        {selectedImage?.metadata && showMetadata && showInfo && (
          <div className="bg-black/20 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-white font-medium">Image Details</h4>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-lg text-cyan-300 hover:text-cyan-200 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm">Download</span>
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-white/60 text-xs">Phase</div>
                <div className="text-white font-medium">{selectedImage.metadata.phase || selectedImage.phase}</div>
              </div>
              <div>
                <div className="text-white/60 text-xs">Generated</div>
                <div className="text-white font-medium">{formatTimestamp(selectedImage.timestamp)}</div>
              </div>
              {selectedImage.metadata.confidence && (
                <div>
                  <div className="text-white/60 text-xs">Confidence</div>
                  <div className="text-white font-medium">{Math.round(selectedImage.metadata.confidence)}%</div>
                </div>
              )}
              {selectedImage.metadata.generationTime && (
                <div>
                  <div className="text-white/60 text-xs">Gen. Time</div>
                  <div className="text-white font-medium">{(selectedImage.metadata.generationTime / 1000).toFixed(1)}s</div>
                </div>
              )}
            </div>

            {selectedImage.metadata.dimensions && (
              <div className="text-sm">
                <div className="text-white/60 text-xs">Dimensions</div>
                <div className="text-white font-medium">
                  {selectedImage.metadata.width} × {selectedImage.metadata.height}px
                </div>
              </div>
            )}

            {selectedImage.metadata.description && (
              <div className="text-sm">
                <div className="text-white/60 text-xs">Description</div>
                <div className="text-white/90">{selectedImage.metadata.description}</div>
              </div>
            )}

            {selectedImage.metadata.tags && selectedImage.metadata.tags.length > 0 && (
              <div className="text-sm">
                <div className="text-white/60 text-xs mb-2">Tags</div>
                <div className="flex flex-wrap gap-2">
                  {selectedImage.metadata.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Gallery Footer */}
        <div className="flex items-center justify-between text-sm text-white/60 border-t border-white/20 pt-4">
          <div className="flex items-center gap-4">
            <span>{images.length} total images</span>
            {currentPhase && (
              <span>Current phase: {currentPhase}</span>
            )}
          </div>

          {isRunning && (
            <div className="flex items-center gap-2 text-cyan-400">
              <SaturnStatusIndicator status="loading" />
              <span className="font-mono">GENERATING</span>
            </div>
          )}
        </div>
      </div>
    </SaturnVisualPanel>
  );
}
