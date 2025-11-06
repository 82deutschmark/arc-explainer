/*
Author: Claude (Windsurf Cascade)
Date: 2025-11-06
PURPOSE: Main ARC-AGI-3 Agent Playground page - integrates all components for watching agents play real ARC3 games.
SRP/DRY check: Pass — orchestrates components without duplicating their internal logic.
*/

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Gamepad2, Info, ExternalLink, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { useArc3AgentStream } from '@/hooks/useArc3AgentStream';
import { Arc3GameSelector } from '@/components/arc3/Arc3GameSelector';
import { Arc3AgentConfigPanel } from '@/components/arc3/Arc3AgentConfigPanel';
import { Arc3GridVisualization } from '@/components/arc3/Arc3GridVisualization';
import { Arc3GridLegend } from '@/components/arc3/Arc3GridLegend';
import { Arc3ChatTimeline } from '@/components/arc3/Arc3ChatTimeline';

export default function ARC3AgentPlayground() {
  // Agent configuration state
  const [gameId, setGameId] = useState('ls20');
  const [agentName, setAgentName] = useState('ARC3 Explorer');
  const [model, setModel] = useState('gpt-5-nano');
  const [maxTurns, setMaxTurns] = useState(24);
  const [instructions, setInstructions] = useState(
    'Explore the game systematically. Start by using RESET to initialize, then use inspect_game_state to observe the grid. Try different actions to learn the rules. Be methodical and document your observations.'
  );

  // Streaming state
  const { state, start, cancel, setCurrentFrame, currentFrame, isPlaying } = useArc3AgentStream();

  const handleStart = () => {
    start({
      gameId,
      agentName,
      instructions,
      model,
      maxTurns,
    });
  };

  const handleCancel = () => {
    cancel();
  };

  const handleClearTimeline = () => {
    // Timeline clearing would require resetting the hook state
    // For now, user must start a new run
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-[1800px]">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/arc3">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to ARC-AGI-3
            </Link>
          </Button>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Gamepad2 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">ARC-AGI-3 Agent Playground</h1>
              <p className="text-muted-foreground">
                Watch OpenAI Agents SDK agents play real ARC-AGI-3 games
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline">Live</Badge>
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://three.arcprize.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3 w-3 mr-2" />
                ARC-AGI-3 Platform
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Info Alert */}
      <Card className="mb-6 border-blue-500 bg-blue-50 dark:bg-blue-950">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100 space-y-1">
              <p className="font-medium">How this works:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                <li>Select a game and configure your agent's instructions below</li>
                <li>The agent will play the real game via the ARC-AGI-3 API at three.arcprize.org</li>
                <li>Watch the grid update in real-time as the agent explores and learns</li>
                <li>See the agent's reasoning and actions in the chat timeline</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Layout: 3-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Configuration (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          <Arc3GameSelector
            selectedGameId={gameId}
            onGameSelect={setGameId}
            disabled={isPlaying}
          />
          
          <Arc3AgentConfigPanel
            agentName={agentName}
            setAgentName={setAgentName}
            model={model}
            setModel={setModel}
            maxTurns={maxTurns}
            setMaxTurns={setMaxTurns}
            instructions={instructions}
            setInstructions={setInstructions}
            isRunning={isPlaying}
            onStart={handleStart}
            onCancel={handleCancel}
          />
        </div>

        {/* Middle Column: Grid Visualization (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gamepad2 className="h-5 w-5" />
                  Game Grid
                </div>
                {state.status !== 'idle' && (
                  <Badge variant={
                    state.status === 'running' ? 'default' :
                    state.status === 'completed' ? 'secondary' :
                    state.status === 'error' ? 'destructive' : 'outline'
                  }>
                    {state.status}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentFrame ? (
                <div className="space-y-4">
                  <Arc3GridVisualization
                    grid={[currentFrame.frame]}
                    frameIndex={0}
                    cellSize={24}
                    showGrid={true}
                  />
                  
                  {/* Game Stats */}
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Score</p>
                      <p className="text-2xl font-bold">{currentFrame.score}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Actions</p>
                      <p className="text-2xl font-bold">
                        {currentFrame.action_counter} / {currentFrame.max_actions}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-muted-foreground">State</p>
                      <Badge className="mt-1">
                        {currentFrame.state}
                      </Badge>
                    </div>
                  </div>

                  {/* Frame Navigation */}
                  {state.frames.length > 1 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Frame: {state.currentFrameIndex + 1} / {state.frames.length}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max={state.frames.length - 1}
                        value={state.currentFrameIndex}
                        onChange={(e) => setCurrentFrame(Number(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Gamepad2 className="h-16 w-16 text-muted-foreground opacity-50 mb-4" />
                  <p className="text-muted-foreground">
                    {state.status === 'running' ? 'Waiting for game to start...' : 'Configure and start an agent run to see the game grid'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Color Legend */}
          {currentFrame && (
            <Arc3GridLegend
              title="Grid Color Palette"
              showValues={true}
              showNames={true}
              compact={true}
            />
          )}

          {/* Summary Stats */}
          {state.summary && (
            <Card>
              <CardHeader>
                <CardTitle>Run Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Final State</p>
                    <Badge className="mt-1">{state.summary.state}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Final Score</p>
                    <p className="text-lg font-bold">{state.summary.score}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Steps Taken</p>
                    <p className="text-lg font-bold">{state.summary.stepsTaken}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Game</p>
                    <p className="text-sm font-mono">{state.summary.scenarioId}</p>
                  </div>
                </div>
                
                {state.usage && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground mb-2">Token Usage</p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Input</p>
                        <p className="font-mono">{state.usage.inputTokens.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Output</p>
                        <p className="font-mono">{state.usage.outputTokens.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-mono">{state.usage.totalTokens.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Chat Timeline (4 cols) */}
        <div className="lg:col-span-4">
          <Arc3ChatTimeline
            timeline={state.timeline}
            isStreaming={isPlaying}
            streamingMessage={state.streamingMessage}
            error={state.error}
            onClear={state.timeline.length > 0 ? handleClearTimeline : undefined}
          />
        </div>
      </div>

      {/* Final Output */}
      {state.finalOutput && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Agent's Final Report</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="whitespace-pre-wrap">{state.finalOutput}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
