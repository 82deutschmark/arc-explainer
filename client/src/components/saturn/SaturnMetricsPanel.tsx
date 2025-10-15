/**
 * client/src/components/saturn/SaturnMetricsPanel.tsx
 *
 * Author: code-supernova
 * Date: 2025-10-14
 * PURPOSE: Real-time metrics panel for Saturn Visual Solver displaying performance indicators,
 * token usage, cost tracking, and system statistics. Provides comprehensive monitoring
 * of the AI analysis process with visual charts and live updates.
 *
 * KEY FEATURES:
 * - Real-time token usage visualization with animated charts
 * - Processing speed and performance indicators
 * - Cost calculation and tracking
 * - System resource monitoring
 * - Model performance metrics and comparisons
 * - Session statistics and history
 * - Responsive design for different screen sizes
 *
 * VISUAL ELEMENTS:
 * - Animated progress bars and circular indicators
 * - Color-coded performance metrics
 * - Mini charts for token usage trends
 * - Glass-morphism design with gradient backgrounds
 * - Interactive hover effects for detailed metrics
 *
 * SRP/DRY check: Pass - Specialized component for metrics visualization
 * DaisyUI: Pass - Uses DaisyUI components with visual enhancements
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Zap,
  Clock,
  Database,
  Cpu,
  Activity,
  BarChart3,
  PieChart,
  Target,
  Award
} from 'lucide-react';
import { SaturnVisualPanel, SaturnStatusIndicator } from './SaturnVisualWorkbench';

export interface PerformanceMetrics {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  processingTime: number;
  cost: number;
  tokensPerSecond: number;
  phaseProgress: number;
  memoryUsage?: number;
  cpuUsage?: number;
  confidence?: number;
  accuracy?: number;
}

export interface SessionMetrics {
  sessionId: string;
  startTime: Date;
  duration: number;
  totalPhases: number;
  completedPhases: number;
  imagesGenerated: number;
  modelName: string;
  temperature: number;
}

export interface SaturnMetricsPanelProps {
  metrics?: PerformanceMetrics;
  session?: SessionMetrics;
  isRunning: boolean;
  historicalData?: PerformanceMetrics[];
  onMetricClick?: (metricType: string) => void;
  compact?: boolean;
}

export default function SaturnMetricsPanel({
  metrics,
  session,
  isRunning,
  historicalData = [],
  onMetricClick,
  compact = false
}: SaturnMetricsPanelProps) {
  const [animatedValues, setAnimatedValues] = useState<Partial<PerformanceMetrics>>({});
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  // Animate metric values on change
  useEffect(() => {
    if (metrics) {
      const animateValue = (key: keyof PerformanceMetrics, target: number) => {
        const start = animatedValues[key] || 0;
        const increment = (target - start) / 20;

        let current = start;
        const timer = setInterval(() => {
          current += increment;
          if (Math.abs(current - target) < Math.abs(increment)) {
            current = target;
            clearInterval(timer);
          }

          setAnimatedValues(prev => ({ ...prev, [key]: current }));
        }, 50);

        return () => clearInterval(timer);
      };

      const timers = Object.entries(metrics).map(([key, value]) =>
        animateValue(key as keyof PerformanceMetrics, value)
      );

      return () => timers.forEach(timer => timer?.());
    }
  }, [metrics]);

  const currentMetrics = { ...metrics, ...animatedValues } as PerformanceMetrics;

  const formatNumber = (num: number, decimals = 0) => {
    return num.toLocaleString(undefined, { maximumFractionDigits: decimals });
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(6)}`;
  };

  const getPerformanceColor = (value: number, thresholds: { good: number; average: number }) => {
    if (value >= thresholds.good) return 'text-green-400';
    if (value >= thresholds.average) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getPerformanceBgColor = (value: number, thresholds: { good: number; average: number }) => {
    if (value >= thresholds.good) return 'bg-green-500/20 border-green-400/30';
    if (value >= thresholds.average) return 'bg-yellow-500/20 border-yellow-400/30';
    return 'bg-red-500/20 border-red-400/30';
  };

  const MetricCard = ({
    title,
    value,
    unit,
    icon: Icon,
    color = 'cyan',
    trend,
    thresholds,
    description
  }: {
    title: string;
    value: number;
    unit: string;
    icon: any;
    color?: string;
    trend?: number;
    thresholds?: { good: number; average: number };
    description?: string;
  }) => (
    <div
      className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:scale-105 ${
        thresholds ? getPerformanceBgColor(value, thresholds) : `bg-${color}-500/20 border-${color}-400/30`
      }`}
      onClick={() => {
        setSelectedMetric(title);
        onMetricClick?.(title);
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 text-${color}-400`} />
          <span className="text-white/80 text-sm">{title}</span>
        </div>
        {trend && (
          <div className={`text-xs ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend > 0 ? '↗' : '↘'} {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>

      <div className={`text-2xl font-bold mb-1 text-${color}-300`}>
        {formatNumber(value)}
        <span className="text-sm text-white/60 ml-1">{unit}</span>
      </div>

      {description && (
        <div className="text-xs text-white/60">{description}</div>
      )}
    </div>
  );

  if (compact) {
    return (
      <SaturnVisualPanel
        title="Performance Metrics"
        icon={<Activity className="w-5 h-5 text-cyan-400" />}
        variant="secondary"
      >
        <div className="space-y-3">
          {/* Key Metrics Row */}
          <div className="grid grid-cols-2 gap-2">
            {currentMetrics.totalTokens > 0 && (
              <MetricCard
                title="Tokens"
                value={currentMetrics.totalTokens}
                unit=""
                icon={Database}
                color="cyan"
                description={`${currentMetrics.inputTokens} in, ${currentMetrics.outputTokens} out`}
              />
            )}

            {currentMetrics.processingTime > 0 && (
              <MetricCard
                title="Time"
                value={currentMetrics.processingTime / 1000}
                unit="s"
                icon={Clock}
                color="green"
                description="Processing duration"
              />
            )}
          </div>

          {/* Performance Indicators */}
          <div className="grid grid-cols-3 gap-2">
            {currentMetrics.tokensPerSecond > 0 && (
              <div className="text-center p-2 bg-black/20 rounded">
                <div className="text-cyan-400 font-bold text-sm">
                  {formatNumber(currentMetrics.tokensPerSecond, 1)}
                </div>
                <div className="text-white/60 text-xs">tokens/s</div>
              </div>
            )}

            {currentMetrics.cost > 0 && (
              <div className="text-center p-2 bg-black/20 rounded">
                <div className="text-yellow-400 font-bold text-sm">
                  {formatCost(currentMetrics.cost)}
                </div>
                <div className="text-white/60 text-xs">cost</div>
              </div>
            )}

            {currentMetrics.confidence !== undefined && (
              <div className="text-center p-2 bg-black/20 rounded">
                <div className={`font-bold text-sm ${getPerformanceColor(currentMetrics.confidence, { good: 80, average: 60 })}`}>
                  {Math.round(currentMetrics.confidence)}%
                </div>
                <div className="text-white/60 text-xs">confidence</div>
              </div>
            )}
          </div>

          {/* Session Info */}
          {session && (
            <div className="bg-black/20 rounded-lg p-2 text-xs text-white/80 space-y-1">
              <div className="flex justify-between">
                <span>Model:</span>
                <span>{session.modelName}</span>
              </div>
              <div className="flex justify-between">
                <span>Duration:</span>
                <span>{formatDuration(session.duration)}</span>
              </div>
              <div className="flex justify-between">
                <span>Images:</span>
                <span>{session.imagesGenerated}</span>
              </div>
            </div>
          )}
        </div>
      </SaturnVisualPanel>
    );
  }

  // Full desktop version
  return (
    <SaturnVisualPanel
      title="Performance Analytics"
      icon={<BarChart3 className="w-6 h-6 text-cyan-400" />}
      variant="secondary"
    >
      <div className="space-y-6">

        {/* Header with Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SaturnStatusIndicator status={isRunning ? "loading" : "idle"} size="lg" />
            <div>
              <h3 className="text-white font-semibold">Live Performance Metrics</h3>
              <p className="text-white/70 text-sm">
                Real-time monitoring of AI analysis performance
              </p>
            </div>
          </div>

          {isRunning && (
            <div className="flex items-center gap-2 text-cyan-400">
              <Activity className="w-4 h-4 animate-pulse" />
              <span className="font-mono text-sm">MONITORING</span>
            </div>
          )}
        </div>

        {/* Token Usage Section */}
        {currentMetrics.totalTokens > 0 && (
          <div className="space-y-4">
            <h4 className="text-white font-medium flex items-center gap-2">
              <Database className="w-5 h-5 text-cyan-400" />
              Token Usage
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                title="Input Tokens"
                value={currentMetrics.inputTokens}
                unit=""
                icon={TrendingUp}
                color="blue"
                description="Prompt and context tokens"
              />

              <MetricCard
                title="Output Tokens"
                value={currentMetrics.outputTokens}
                unit=""
                icon={Zap}
                color="green"
                description="Generated response tokens"
              />

              <MetricCard
                title="Reasoning Tokens"
                value={currentMetrics.reasoningTokens}
                unit=""
                icon={Cpu}
                color="purple"
                description="AI thinking process tokens"
              />
            </div>

            {/* Token Distribution Chart */}
            <div className="bg-black/20 rounded-lg p-4">
              <h5 className="text-white/80 text-sm mb-3">Token Distribution</h5>
              <div className="flex h-4 rounded-full overflow-hidden bg-black/30">
                <div
                  className="bg-blue-500"
                  style={{ width: `${(currentMetrics.inputTokens / currentMetrics.totalTokens) * 100}%` }}
                />
                <div
                  className="bg-green-500"
                  style={{ width: `${(currentMetrics.outputTokens / currentMetrics.totalTokens) * 100}%` }}
                />
                <div
                  className="bg-purple-500"
                  style={{ width: `${(currentMetrics.reasoningTokens / currentMetrics.totalTokens) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-white/60 mt-2">
                <span>Input: {Math.round((currentMetrics.inputTokens / currentMetrics.totalTokens) * 100)}%</span>
                <span>Output: {Math.round((currentMetrics.outputTokens / currentMetrics.totalTokens) * 100)}%</span>
                <span>Reasoning: {Math.round((currentMetrics.reasoningTokens / currentMetrics.totalTokens) * 100)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Performance Metrics */}
        <div className="space-y-4">
          <h4 className="text-white font-medium flex items-center gap-2">
            <Target className="w-5 h-5 text-cyan-400" />
            Performance Indicators
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MetricCard
              title="Processing Speed"
              value={currentMetrics.tokensPerSecond}
              unit="tokens/s"
              icon={Zap}
              color="yellow"
              thresholds={{ good: 50, average: 20 }}
              description="Tokens processed per second"
            />

            <MetricCard
              title="Processing Time"
              value={currentMetrics.processingTime / 1000}
              unit="s"
              icon={Clock}
              color="green"
              description="Total analysis duration"
            />

            <MetricCard
              title="Cost"
              value={currentMetrics.cost}
              unit="USD"
              icon={DollarSign}
              color="yellow"
              description="API usage cost"
            />

            {currentMetrics.confidence !== undefined && (
              <MetricCard
                title="Confidence"
                value={currentMetrics.confidence}
                unit="%"
                icon={Award}
                color="cyan"
                thresholds={{ good: 80, average: 60 }}
                description="AI confidence in solution"
              />
            )}
          </div>
        </div>

        {/* System Resources */}
        {(currentMetrics.memoryUsage || currentMetrics.cpuUsage) && (
          <div className="space-y-4">
            <h4 className="text-white font-medium flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyan-400" />
              System Resources
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentMetrics.memoryUsage && (
                <div className="bg-black/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/80 text-sm">Memory Usage</span>
                    <span className="text-cyan-400 font-mono">{Math.round(currentMetrics.memoryUsage)}%</span>
                  </div>
                  <div className="w-full bg-black/30 rounded-full h-2">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full transition-all duration-300"
                      style={{ width: `${currentMetrics.memoryUsage}%` }}
                    />
                  </div>
                </div>
              )}

              {currentMetrics.cpuUsage && (
                <div className="bg-black/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/80 text-sm">CPU Usage</span>
                    <span className="text-green-400 font-mono">{Math.round(currentMetrics.cpuUsage)}%</span>
                  </div>
                  <div className="w-full bg-black/30 rounded-full h-2">
                    <div
                      className="h-full bg-gradient-to-r from-green-400 to-emerald-400 rounded-full transition-all duration-300"
                      style={{ width: `${currentMetrics.cpuUsage}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Session Information */}
        {session && (
          <div className="space-y-4">
            <h4 className="text-white font-medium flex items-center gap-2">
              <PieChart className="w-5 h-5 text-cyan-400" />
              Session Statistics
            </h4>

            <div className="bg-black/20 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-white/60 text-xs">Session ID</div>
                  <div className="text-white font-mono text-xs">{session.sessionId.slice(-8)}</div>
                </div>

                <div>
                  <div className="text-white/60 text-xs">Model</div>
                  <div className="text-cyan-400 font-medium">{session.modelName}</div>
                </div>

                <div>
                  <div className="text-white/60 text-xs">Duration</div>
                  <div className="text-white font-medium">{formatDuration(session.duration)}</div>
                </div>

                <div>
                  <div className="text-white/60 text-xs">Temperature</div>
                  <div className="text-white font-medium">{session.temperature}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm pt-2 border-t border-white/20">
                <div className="text-center">
                  <div className="text-2xl font-bold text-cyan-400">{session.totalPhases}</div>
                  <div className="text-white/60 text-xs">Total Phases</div>
                </div>

                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{session.completedPhases}</div>
                  <div className="text-white/60 text-xs">Completed</div>
                </div>

                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">{session.imagesGenerated}</div>
                  <div className="text-white/60 text-xs">Images</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Historical Trends (if available) */}
        {historicalData.length > 1 && (
          <div className="space-y-4">
            <h4 className="text-white font-medium flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              Performance Trends
            </h4>

            <div className="bg-black/20 rounded-lg p-4">
              <div className="text-sm text-white/60 mb-2">Token Usage Over Time</div>
              <div className="flex items-end gap-1 h-16">
                {historicalData.slice(-10).map((data, index) => (
                  <div
                    key={index}
                    className="bg-gradient-to-t from-cyan-500 to-blue-400 rounded-t flex-1"
                    style={{
                      height: `${Math.min((data.totalTokens / Math.max(...historicalData.map(d => d.totalTokens))) * 100, 100)}%`
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Metrics Footer */}
        <div className="flex items-center justify-between text-sm text-white/60 border-t border-white/20 pt-4">
          <div className="flex items-center gap-4">
            <span>Real-time monitoring active</span>
            {metrics && (
              <span>Last updated: {new Date().toLocaleTimeString()}</span>
            )}
          </div>

          {isRunning && (
            <div className="flex items-center gap-2 text-cyan-400">
              <SaturnStatusIndicator status="loading" />
              <span className="font-mono">LIVE</span>
            </div>
          )}
        </div>
      </div>
    </SaturnVisualPanel>
  );
}
