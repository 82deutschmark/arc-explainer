/**
 * client/src/components/saturn/SaturnPhaseTimeline.tsx
 *
 * Author: code-supernova
 * Date: 2025-10-14
 * PURPOSE: Visual timeline component for Saturn Visual Solver showing solving phases and progress.
 * Provides an animated, interactive timeline that visualizes the AI's problem-solving journey
 * with phase indicators, progress tracking, and visual markers for key events.
 *
 * KEY FEATURES:
 * - Animated progress bar with phase transitions
 * - Visual markers for image generation and key events
 * - Interactive phase details on click/hover
 * - Real-time progress updates
 * - Phase duration tracking and display
 * - Responsive design for different screen sizes
 *
 * VISUAL ELEMENTS:
 * - Gradient progress bars with smooth animations
 * - Pulsing indicators for active phases
 * - Color-coded phase states (upcoming, active, completed, failed)
 * - Interactive hover effects with tooltips
 * - Timeline markers for significant events
 *
 * SRP/DRY check: Pass - Specialized component for phase visualization
 * DaisyUI: Pass - Uses DaisyUI components with visual enhancements
 */

import React, { useEffect, useState } from 'react';
import { Clock, Image, CheckCircle, AlertCircle, Play, Pause, SkipForward, Camera } from 'lucide-react';
import { SaturnVisualPanel, SaturnStatusIndicator } from './SaturnVisualWorkbench';

export interface PhaseEvent {
  id: string;
  phase: string;
  timestamp: Date;
  duration?: number;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'skipped';
  description?: string;
  metadata?: {
    imagesGenerated?: number;
    tokensUsed?: number;
    confidence?: number;
  };
}

export interface SaturnPhaseTimelineProps {
  phases: PhaseEvent[];
  currentPhase?: string;
  progress?: number;
  isRunning: boolean;
  totalDuration?: number;
  onPhaseClick?: (phaseId: string) => void;
  onSkipPhase?: (phaseId: string) => void;
  compact?: boolean;
}

export default function SaturnPhaseTimeline({
  phases,
  currentPhase,
  progress = 0,
  isRunning,
  totalDuration,
  onPhaseClick,
  onSkipPhase,
  compact = false
}: SaturnPhaseTimelineProps) {
  const [hoveredPhase, setHoveredPhase] = useState<string | null>(null);
  const [animationProgress, setAnimationProgress] = useState(0);

  // Animate progress bar
  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => {
        setAnimationProgress(prev => (prev + 1) % 100);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isRunning]);

  const getPhaseIcon = (phase: string, status: PhaseEvent['status']) => {
    if (status === 'completed') return <CheckCircle className="w-4 h-4 text-green-400" />;
    if (status === 'failed') return <AlertCircle className="w-4 h-4 text-red-400" />;
    if (status === 'active') return <Play className="w-4 h-4 text-cyan-400 animate-pulse" />;
    if (status === 'pending') return <Clock className="w-4 h-4 text-gray-400" />;
    return <Pause className="w-4 h-4 text-yellow-400" />;
  };

  const getPhaseColor = (status: PhaseEvent['status'], isCurrent: boolean) => {
    if (isCurrent && status === 'active') return 'bg-gradient-to-r from-cyan-400 to-blue-400';
    if (status === 'completed') return 'bg-gradient-to-r from-green-400 to-emerald-400';
    if (status === 'failed') return 'bg-gradient-to-r from-red-400 to-rose-400';
    if (status === 'active') return 'bg-gradient-to-r from-blue-400 to-cyan-400';
    if (status === 'pending') return 'bg-gradient-to-r from-gray-400 to-slate-400';
    return 'bg-gradient-to-r from-yellow-400 to-orange-400';
  };

  const getPhaseTextColor = (status: PhaseEvent['status'], isCurrent: boolean) => {
    if (isCurrent && status === 'active') return 'text-cyan-300';
    if (status === 'completed') return 'text-green-300';
    if (status === 'failed') return 'text-red-300';
    if (status === 'active') return 'text-blue-300';
    if (status === 'pending') return 'text-gray-300';
    return 'text-yellow-300';
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const getPhaseDescription = (phase: string) => {
    const descriptions: Record<string, string> = {
      'initializing': 'Setting up analysis environment',
      'pattern_analysis': 'Analyzing input/output patterns',
      'rule_discovery': 'Identifying transformation rules',
      'solution_generation': 'Generating possible solutions',
      'verification': 'Verifying solution correctness',
      'image_generation': 'Creating visual representations',
      'finalization': 'Finalizing results and cleanup'
    };
    return descriptions[phase] || phase;
  };

  if (compact) {
    return (
      <SaturnVisualPanel
        title="Progress Timeline"
        icon={<Clock className="w-5 h-5 text-cyan-400" />}
        variant="secondary"
      >
        <div className="space-y-3">
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/80">Overall Progress</span>
              <span className="text-cyan-400 font-mono">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-black/30 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
              {isRunning && (
                <div
                  className="h-full bg-white/20 rounded-full animate-pulse"
                  style={{ width: `${animationProgress}%` }}
                />
              )}
            </div>
          </div>

          {/* Current Phase */}
          {currentPhase && (
            <div className="bg-black/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <SaturnStatusIndicator status={isRunning ? "loading" : "idle"} />
                <span className="text-cyan-300 font-medium text-sm">Current: {currentPhase}</span>
              </div>
              <p className="text-white/70 text-xs">{getPhaseDescription(currentPhase)}</p>
            </div>
          )}

          {/* Recent Phases */}
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {phases.slice(-3).map((phaseEvent) => (
              <div
                key={phaseEvent.id}
                className={`flex items-center gap-2 text-xs p-2 rounded cursor-pointer transition-colors ${
                  phaseEvent.phase === currentPhase
                    ? 'bg-cyan-500/20 border border-cyan-400/30'
                    : 'bg-black/20 hover:bg-black/30'
                }`}
                onClick={() => onPhaseClick?.(phaseEvent.id)}
              >
                {getPhaseIcon(phaseEvent.phase, phaseEvent.status)}
                <div className="flex-1 min-w-0">
                  <div className={`font-medium truncate ${getPhaseTextColor(phaseEvent.status, phaseEvent.phase === currentPhase)}`}>
                    {phaseEvent.phase}
                  </div>
                  {phaseEvent.duration && (
                    <div className="text-white/50">{formatDuration(phaseEvent.duration)}</div>
                  )}
                </div>
                {phaseEvent.metadata?.imagesGenerated && (
                  <div className="flex items-center gap-1 text-green-400">
                    <Image className="w-3 h-3" />
                    <span className="text-xs">{phaseEvent.metadata.imagesGenerated}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </SaturnVisualPanel>
    );
  }

  // Full desktop version
  return (
    <SaturnVisualPanel
      title="Solving Timeline"
      icon={<Clock className="w-6 h-6 text-cyan-400" />}
      variant="secondary"
    >
      <div className="space-y-6">

        {/* Timeline Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SaturnStatusIndicator status={isRunning ? "loading" : "idle"} size="lg" />
            <div>
              <h3 className="text-white font-semibold">Analysis Progress</h3>
              <p className="text-white/70 text-sm">
                {isRunning ? 'AI is actively solving the puzzle' : 'Ready to begin analysis'}
              </p>
            </div>
          </div>

          {totalDuration && (
            <div className="text-right">
              <div className="text-cyan-400 font-bold text-lg">{formatDuration(totalDuration)}</div>
              <div className="text-white/60 text-xs">Total Duration</div>
            </div>
          )}
        </div>

        {/* Overall Progress Bar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/80">Overall Completion</span>
            <span className="text-cyan-400 font-mono font-bold">{Math.round(progress)}%</span>
          </div>

          <div className="relative">
            <div className="w-full bg-black/30 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Animated pulse overlay for active progress */}
            {isRunning && (
              <div
                className="absolute top-0 h-full bg-white/20 rounded-full animate-pulse"
                style={{
                  width: `${animationProgress}%`,
                  left: `${Math.max(0, progress - 10)}%`
                }}
              />
            )}
          </div>
        </div>

        {/* Phase Timeline */}
        <div className="space-y-4">
          <h4 className="text-white font-medium flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Phase Progress
          </h4>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {phases.map((phaseEvent, index) => {
              const isCurrent = phaseEvent.phase === currentPhase;
              const isLast = index === phases.length - 1;

              return (
                <div
                  key={phaseEvent.id}
                  className={`relative transition-all duration-300 hover:scale-[1.02] ${
                    isCurrent ? 'transform scale-105' : ''
                  }`}
                  onMouseEnter={() => setHoveredPhase(phaseEvent.id)}
                  onMouseLeave={() => setHoveredPhase(null)}
                >
                  {/* Timeline Line */}
                  {!isLast && (
                    <div className="absolute left-6 top-12 w-0.5 h-16 bg-white/20" />
                  )}

                  {/* Phase Node */}
                  <div
                    className={`flex items-start gap-4 p-4 rounded-lg cursor-pointer transition-all duration-300 ${
                      isCurrent
                        ? 'bg-cyan-500/20 border border-cyan-400/50 shadow-lg shadow-cyan-500/20'
                        : hoveredPhase === phaseEvent.id
                        ? 'bg-white/10 border border-white/30'
                        : 'bg-black/20 border border-white/10 hover:bg-black/30'
                    }`}
                    onClick={() => onPhaseClick?.(phaseEvent.id)}
                  >
                    {/* Phase Icon */}
                    <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isCurrent
                        ? 'bg-cyan-400/30 border-2 border-cyan-400'
                        : phaseEvent.status === 'completed'
                        ? 'bg-green-400/20 border-2 border-green-400'
                        : phaseEvent.status === 'failed'
                        ? 'bg-red-400/20 border-2 border-red-400'
                        : 'bg-white/10 border-2 border-white/30'
                    }`}>
                      {getPhaseIcon(phaseEvent.phase, phaseEvent.status)}
                    </div>

                    {/* Phase Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className={`font-semibold transition-colors ${
                          isCurrent ? 'text-cyan-300' : 'text-white'
                        }`}>
                          {phaseEvent.phase}
                        </h5>

                        <div className="flex items-center gap-2">
                          {phaseEvent.metadata?.imagesGenerated && (
                            <div className="flex items-center gap-1 text-green-400 text-sm">
                              <Camera className="w-4 h-4" />
                              <span>{phaseEvent.metadata.imagesGenerated}</span>
                            </div>
                          )}

                          {phaseEvent.duration && (
                            <div className="text-white/60 text-sm">
                              {formatDuration(phaseEvent.duration)}
                            </div>
                          )}

                          {isCurrent && isRunning && (
                            <SaturnStatusIndicator status="loading" />
                          )}
                        </div>
                      </div>

                      <p className="text-white/80 text-sm mb-2">
                        {phaseEvent.description || getPhaseDescription(phaseEvent.phase)}
                      </p>

                      {/* Phase Metrics */}
                      {phaseEvent.metadata && (
                        <div className="flex items-center gap-4 text-xs text-white/60">
                          {phaseEvent.metadata.tokensUsed && (
                            <span>Tokens: {phaseEvent.metadata.tokensUsed.toLocaleString()}</span>
                          )}
                          {phaseEvent.metadata.confidence && (
                            <span>Confidence: {Math.round(phaseEvent.metadata.confidence)}%</span>
                          )}
                        </div>
                      )}

                      {/* Hover Tooltip */}
                      {hoveredPhase === phaseEvent.id && (
                        <div className="absolute bottom-full left-0 mb-2 p-3 bg-black/80 text-white text-xs rounded-lg border border-white/20 max-w-xs z-10">
                          <div className="font-medium mb-1">{phaseEvent.phase}</div>
                          <div>{phaseEvent.description || getPhaseDescription(phaseEvent.phase)}</div>
                          {phaseEvent.metadata && (
                            <div className="mt-2 space-y-1">
                              {phaseEvent.metadata.imagesGenerated && (
                                <div>Images: {phaseEvent.metadata.imagesGenerated}</div>
                              )}
                              {phaseEvent.metadata.tokensUsed && (
                                <div>Tokens: {phaseEvent.metadata.tokensUsed}</div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeline Footer */}
        <div className="flex items-center justify-between text-sm text-white/60 border-t border-white/20 pt-4">
          <div className="flex items-center gap-4">
            <span>{phases.length} phases</span>
            <span>
              {phases.filter(p => p.status === 'completed').length} completed
            </span>
            {phases.some(p => p.metadata?.imagesGenerated) && (
              <span>
                {phases.reduce((sum, p) => sum + (p.metadata?.imagesGenerated || 0), 0)} images generated
              </span>
            )}
          </div>

          {isRunning && (
            <div className="flex items-center gap-2 text-cyan-400">
              <SaturnStatusIndicator status="loading" />
              <span className="font-mono">ACTIVE</span>
            </div>
          )}
        </div>
      </div>
    </SaturnVisualPanel>
  );
}
