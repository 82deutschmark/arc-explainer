/*
Author: Claude (Windsurf Cascade)
Date: 2025-11-06
PURPOSE: Component for selecting ARC-AGI-3 games by fetching real game data from /api/arc3/games.
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
  id: string;
  name: string;
  description: string;
  difficulty?: string;
  category?: string;
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
        // Auto-select first game if none selected
        if (!selectedGameId && data.data.length > 0) {
          onGameSelect(data.data[0].id);
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

  const selectedGame = games.find(game => game.id === selectedGameId);

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'hard':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

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
                    <span>{selectedGame.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {selectedGame.id}
                    </Badge>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {games.map((game) => (
                <SelectItem key={game.id} value={game.id}>
                  <div className="flex flex-col items-start py-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{game.name}</span>
                      {game.difficulty && (
                        <Badge className={`text-xs ${getDifficultyColor(game.difficulty)}`}>
                          {game.difficulty}
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {game.description}
                    </span>
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
                <h4 className="font-semibold text-sm">{selectedGame.name}</h4>
                <p className="text-sm text-muted-foreground mt-1">{selectedGame.description}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 pt-2">
              <Badge variant="outline" className="text-xs">{selectedGame.id}</Badge>
              {selectedGame.category && (
                <Badge variant="secondary" className="text-xs">{selectedGame.category}</Badge>
              )}
              {selectedGame.difficulty && (
                <Badge className={`text-xs ${getDifficultyColor(selectedGame.difficulty)}`}>
                  {selectedGame.difficulty}
                </Badge>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              asChild
            >
              <a
                href={`https://three.arcprize.org/games/${selectedGame.id}`}
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
