/**
 * client/src/components/saturn/SaturnStreamingVisualizer.tsx
 *
 * Author: code-supernova
 * Date: 2025-10-14
 * PURPOSE: Enhanced AI reasoning display with rich visual elements for Saturn Visual Solver.
 * Transforms basic terminal output into a sophisticated visual reasoning experience with
 * animations, syntax highlighting, and interactive elements.
 *
 * KEY FEATURES:
 * - Animated reasoning flow visualization with pulsing indicators
 * - Syntax highlighting for code patterns and structured thinking
 * - Progress indicators for different reasoning phases
 * - Interactive expandable sections for detailed analysis
 * - Visual distinction between reasoning types (analytical, creative, pattern recognition)
 * - Real-time token usage and performance metrics
 *
 * VISUAL ELEMENTS:
 * - Gradient backgrounds with glass-morphism effects
 * - Animated progress bars and status indicators
 * - Color-coded reasoning sections
 * - Interactive hover effects and animations
 *
 * SRP/DRY check: Pass - Specialized component for reasoning visualization
 * DaisyUI: Pass - Uses DaisyUI components with custom visual enhancements
 */

import React, { useEffect, useRef, useState } from 'react';
import { Brain, Code2, Lightbulb, Search, Zap, ChevronDown, ChevronUp, Activity } from 'lucide-react';
import { SaturnVisualPanel, SaturnStatusIndicator } from './SaturnVisualWorkbench';

interface ReasoningSection {
  id: string;
  type: 'analytical' | 'creative' | 'pattern' | 'synthesis' | 'verification';
  title: string;
  content: string;
  confidence?: number;
  tokens?: number;
  timestamp: Date;
}

interface StreamingMetrics {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  processingTime: number;
  cost?: number;
}

interface SaturnStreamingVisualizerProps {
  streamingText?: string;
  streamingReasoning?: string;
  isRunning: boolean;
  phase?: string;
  metrics?: StreamingMetrics;
  reasoningSections?: ReasoningSection[];
  onSectionExpand?: (sectionId: string) => void;
  compact?: boolean;
}

export default function SaturnStreamingVisualizer({
  streamingText,
  streamingReasoning,
  isRunning,
  phase,
  metrics,
  reasoningSections = [],
  onSectionExpand,
  compact = false
}: SaturnStreamingVisualizerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Auto-scroll functionality
  useEffect(() => {
    if (scrollRef.current && autoScroll) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamingText, streamingReasoning, autoScroll]);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
      onSectionExpand?.(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const getReasoningIcon = (type: ReasoningSection['type']) => {
    const icons = {
      analytical: Brain,
      creative: Lightbulb,
      pattern: Search,
      synthesis: Zap,
      verification: Activity
    };
    const Icon = icons[type];
    return <Icon className="w-4 h-4" />;
  };

  const getReasoningColor = (type: ReasoningSection['type']) => {
    const colors = {
      analytical: 'from-blue-500/20 to-cyan-500/20 border-blue-400/30',
      creative: 'from-purple-500/20 to-pink-500/20 border-purple-400/30',
      pattern: 'from-green-500/20 to-emerald-500/20 border-green-400/30',
      synthesis: 'from-orange-500/20 to-yellow-500/20 border-orange-400/30',
      verification: 'from-red-500/20 to-rose-500/20 border-red-400/30'
    };
    return colors[type];
  };

  if (compact) {
    return (
      <SaturnVisualPanel
        title="AI Reasoning Stream"
        icon={<Activity className="w-5 h-5 text-cyan-400" />}
        variant="primary"
        className="flex-1 min-h-0"
      >
        <div className="space-y-3">
          {/* Compact Metrics Bar */}
          {metrics && (
            <div className="flex items-center justify-between text-xs text-white/80 bg-black/20 rounded-lg p-2">
              <span>Tokens: {metrics.totalTokens.toLocaleString()}</span>
              <span>Time: {(metrics.processingTime / 1000).toFixed(1)}s</span>
              {metrics.cost && <span>Cost: ${metrics.cost.toFixed(4)}</span>}
            </div>
          )}

          {/* Streaming Content */}
          <div
            ref={scrollRef}
            className="max-h-64 overflow-y-auto bg-black/30 rounded-lg p-3 space-y-3"
          >
            {!streamingText && !streamingReasoning && !isRunning ? (
              <div className="text-center text-white/50 py-8">
                <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">AI reasoning will appear here</p>
              </div>
            ) : (
              <>
                {/* Live Reasoning Indicator */}
                {isRunning && (
                  <div className="flex items-center gap-2 text-cyan-400 text-sm">
                    <SaturnStatusIndicator status="loading" />
                    <span className="animate-pulse">Processing...</span>
                    {phase && <span className="text-white/60">• {phase}</span>}
                  </div>
                )}

                {/* Reasoning Sections */}
                {reasoningSections.map((section) => (
                  <div
                    key={section.id}
                    className={`bg-gradient-to-r ${getReasoningColor(section.type)} rounded-lg p-3 border cursor-pointer transition-all duration-200 hover:shadow-lg`}
                    onClick={() => toggleSection(section.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getReasoningIcon(section.type)}
                        <span className="font-medium text-white text-sm">{section.title}</span>
                        {section.confidence && (
                          <span className="text-xs text-white/70">({Math.round(section.confidence)}%)</span>
                        )}
                      </div>
                      {expandedSections.has(section.id) ?
                        <ChevronUp className="w-4 h-4 text-white/70" /> :
                        <ChevronDown className="w-4 h-4 text-white/70" />
                      }
                    </div>
                    {expandedSections.has(section.id) && (
                      <div className="mt-2 text-sm text-white/90 leading-relaxed">
                        {section.content}
                      </div>
                    )}
                  </div>
                ))}

                {/* Raw Streaming Text */}
                {streamingText && (
                  <div className="bg-green-500/20 border border-green-400/30 rounded-lg p-3">
                    <div className="text-green-300 text-xs font-bold mb-2 flex items-center gap-2">
                      <Code2 className="w-4 h-4" />
                      OUTPUT
                    </div>
                    <div className="text-green-100 font-mono text-sm whitespace-pre-wrap">
                      {streamingText}
                      {isRunning && <span className="inline-block w-2 h-4 bg-green-400 ml-1 animate-pulse" />}
                    </div>
                  </div>
                )}

                {/* Raw Reasoning */}
                {streamingReasoning && (
                  <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-3">
                    <div className="text-blue-300 text-xs font-bold mb-2 flex items-center gap-2">
                      <Brain className="w-4 h-4" />
                      REASONING
                    </div>
                    <div className="text-blue-100 font-mono text-sm whitespace-pre-wrap">
                      {streamingReasoning}
                      {isRunning && <span className="inline-block w-2 h-4 bg-blue-400 ml-1 animate-pulse" />}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </SaturnVisualPanel>
    );
  }

  // Full desktop version
  return (
    <SaturnVisualPanel
      title="AI Reasoning Visualizer"
      icon={<Brain className="w-6 h-6 text-cyan-400" />}
      variant="primary"
      className="flex-1 min-h-0"
    >
      <div className="space-y-4 h-full flex flex-col">

        {/* Header with Controls and Metrics */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SaturnStatusIndicator status={isRunning ? "loading" : "idle"} size="lg" />
            <div>
              <h3 className="text-white font-semibold">Live AI Reasoning</h3>
              {phase && (
                <p className="text-white/70 text-sm">Current Phase: {phase}</p>
              )}
            </div>
          </div>

          {/* Live Metrics */}
          {metrics && (
            <div className="flex items-center gap-4 text-sm">
              <div className="text-center">
                <div className="text-cyan-400 font-bold">{metrics.totalTokens.toLocaleString()}</div>
                <div className="text-white/60 text-xs">Total Tokens</div>
              </div>
              <div className="text-center">
                <div className="text-green-400 font-bold">{(metrics.processingTime / 1000).toFixed(1)}s</div>
                <div className="text-white/60 text-xs">Processing</div>
              </div>
              {metrics.cost && (
                <div className="text-center">
                  <div className="text-yellow-400 font-bold">${metrics.cost.toFixed(4)}</div>
                  <div className="text-white/60 text-xs">Cost</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main Streaming Area */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 bg-black/30 rounded-lg p-4 overflow-y-auto"
        >
          {!streamingText && !streamingReasoning && !isRunning ? (
            <div className="text-center text-white/50 py-16">
              <Brain className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-xl font-semibold mb-2">AI Reasoning Stream</h3>
              <p className="text-white/70">Advanced AI analysis and pattern recognition will appear here in real-time</p>
            </div>
          ) : (
            <div className="space-y-6">

              {/* Live Status Banner */}
              {isRunning && (
                <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400/30 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <SaturnStatusIndicator status="loading" size="md" />
                      <div>
                        <div className="text-cyan-300 font-semibold">AI Processing Active</div>
                        <div className="text-white/80 text-sm">
                          {phase ? `Phase: ${phase}` : 'Analyzing puzzle patterns...'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                      <span className="text-cyan-400 text-sm font-mono">LIVE</span>
                    </div>
                  </div>

                  {/* Animated Progress Bar */}
                  <div className="mt-3 w-full bg-black/30 rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                </div>
              )}

              {/* Structured Reasoning Sections */}
              {reasoningSections.map((section) => (
                <div
                  key={section.id}
                  className={`bg-gradient-to-br ${getReasoningColor(section.type)} border rounded-lg p-4 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] cursor-pointer`}
                  onClick={() => toggleSection(section.id)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-lg">
                        {getReasoningIcon(section.type)}
                      </div>
                      <div>
                        <h4 className="text-white font-semibold text-lg">{section.title}</h4>
                        <div className="flex items-center gap-4 text-sm text-white/80">
                          <span>{section.type.charAt(0).toUpperCase() + section.type.slice(1)} Analysis</span>
                          {section.confidence && (
                            <span>Confidence: {Math.round(section.confidence)}%</span>
                          )}
                          {section.tokens && (
                            <span>{section.tokens} tokens</span>
                          )}
                          <span className="text-xs opacity-60">
                            {section.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {expandedSections.has(section.id) ?
                        <ChevronUp className="w-5 h-5 text-white/70" /> :
                        <ChevronDown className="w-5 h-5 text-white/70" />
                      }
                    </div>
                  </div>

                  {expandedSections.has(section.id) && (
                    <div className="mt-4 pt-4 border-t border-white/20">
                      <div className="text-white/90 leading-relaxed whitespace-pre-wrap font-mono text-sm">
                        {section.content}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Raw Streaming Output */}
              {streamingText && (
                <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-400/30 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Code2 className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold">Final Output</h4>
                      <div className="text-white/80 text-sm">Generated response and solution</div>
                    </div>
                  </div>
                  <div className="text-green-100 font-mono text-sm whitespace-pre-wrap leading-relaxed bg-black/20 rounded p-3">
                    {streamingText}
                    {isRunning && <span className="inline-block w-3 h-5 bg-green-400 ml-2 animate-pulse" />}
                  </div>
                </div>
              )}

              {/* Raw Reasoning Stream */}
              {streamingReasoning && (
                <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-400/30 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Brain className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold">Reasoning Process</h4>
                      <div className="text-white/80 text-sm">Step-by-step analytical thinking</div>
                    </div>
                  </div>
                  <div className="text-blue-100 font-mono text-sm whitespace-pre-wrap leading-relaxed bg-black/20 rounded p-3">
                    {streamingReasoning}
                    {isRunning && <span className="inline-block w-3 h-5 bg-blue-400 ml-2 animate-pulse" />}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="flex items-center justify-between text-sm text-white/60 border-t border-white/20 pt-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-3 py-1 rounded text-xs transition-colors ${
                autoScroll
                  ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/50'
                  : 'bg-white/10 text-white/60 border border-white/20'
              }`}
            >
              Auto-scroll {autoScroll ? 'ON' : 'OFF'}
            </button>
            <span>{reasoningSections.length} reasoning sections</span>
          </div>
          {isRunning && (
            <div className="flex items-center gap-2 text-cyan-400">
              <SaturnStatusIndicator status="loading" />
              <span className="font-mono">STREAMING</span>
            </div>
          )}
        </div>
      </div>
    </SaturnVisualPanel>
  );
}
