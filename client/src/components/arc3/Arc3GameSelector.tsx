/*
Author: Claude Code using Sonnet 4.5
Date: 2025-11-06
PURPOSE: Component for selecting ARC-AGI-3 games by fetching real game data from /api/arc3/games.
Matches ARC-AGI-3 API response structure (game_id, title).
SRP/DRY check: Pass — isolates game selection logic from agent configuration and execution.
*/

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Gamepad2, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface GameInfo {
  game_id: string;  // ARC3 API uses game_id (e.g., "ls20", "as66", "ft09", "lp85", "sp80", "vc33")
  title: string;     // ARC3 API uses title for display name
}

interface Arc3GameSelectorProps {
  selectedGameId: string;
  onGameSelect: (gameId: string) => void;
  disabled?: boolean;
  className?: string;
}

export const Arc3GameSelector: React.FC<Arc3GameSelectorProps> = ({
  selectedGameId,
  onGameSelect,
  disabled = false,
  className = '',
}) => {
  const [games, setGames] = useState<GameInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGames = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest('GET', '/api/arc3/games');
      const data = await response.json();
      
      if (data.success && data.data && Array.isArray(data.data)) {
        setGames(data.data);
        // Auto-select first game if none selected (default to ls20)
        if (!selectedGameId && data.data.length > 0) {
          const defaultGame = data.data.find((g: any) => g.game_id === 'ls20') || data.data[0];
          onGameSelect(defaultGame.game_id);
        }
      } else {
        throw new Error('Invalid response format from /api/arc3/games');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch games';
      setError(message);
      console.error('[Arc3GameSelector] Error fetching games:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  const selectedGame = games.find(game => game.game_id === selectedGameId);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5" />
            Loading Games...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5" />
            Game Selection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900 dark:text-red-100">Failed to load games</p>
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
            <Button onClick={fetchGames} variant="outline" className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (games.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5" />
            Game Selection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No games available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5" />
            Game Selection
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchGames}
            disabled={loading || disabled}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Choose a Game</label>
          <Select 
            value={selectedGameId} 
            onValueChange={onGameSelect}
            disabled={disabled || loading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a game">
                {selectedGame && (
                  <div className="flex items-center gap-2">
                    <span>{selectedGame.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {selectedGame.game_id}
                    </Badge>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {games.map((game) => (
                <SelectItem key={game.game_id} value={game.game_id}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{game.title}</span>
                    <Badge variant="outline" className="text-xs">{game.game_id}</Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedGame && (
          <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-sm">{selectedGame.title}</h4>
                <p className="text-xs text-muted-foreground">Game ID: {selectedGame.game_id}</p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              asChild
            >
              <a
                href={`https://three.arcprize.org/games/${selectedGame.game_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3 w-3 mr-2" />
                View on ARC-AGI-3 Platform
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Arc3GameSelector;
