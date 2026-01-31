/*
 * Author: Cascade (Claude)
 * Date: 2026-01-31
 * PURPOSE: Archived games browser for the 6 official ARC3 preview games.
 *          Displays game cards with metadata and links to individual spoiler pages.
 * SRP/DRY check: Pass — single-purpose browser for archived game metadata.
 */

import { useQuery } from '@tanstack/react-query';
import { Archive, Gamepad2, Star, Clock, Target, ChevronRight, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Arc3ArchiveBanner } from '@/components/arc3/Arc3ArchiveBanner';
import type { Arc3GameMetadata, DifficultyRating } from '@shared/arc3Games/types';

// Difficulty badge styling
const difficultyColors: Record<DifficultyRating, string> = {
  easy: 'bg-green-500/20 text-green-700 dark:text-green-400',
  medium: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  hard: 'bg-orange-500/20 text-orange-700 dark:text-orange-400',
  'very-hard': 'bg-red-500/20 text-red-700 dark:text-red-400',
  unknown: 'bg-gray-500/20 text-gray-700 dark:text-gray-400',
};

function GameCard({ game }: { game: Arc3GameMetadata }) {
  return (
    <Card className="hover:shadow-lg transition-shadow border-amber-500/20 group">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-amber-600" />
              {game.gameId.toUpperCase()}
            </CardTitle>
            <CardDescription className="mt-1">
              {game.officialTitle}
              {game.informalName && (
                <span className="ml-2 text-amber-600">({game.informalName})</span>
              )}
            </CardDescription>
          </div>
          <Badge className={difficultyColors[game.difficulty]}>
            {game.difficulty}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {game.description}
        </p>

        {/* Game Stats */}
        <div className="flex flex-wrap gap-4 text-sm">
          {game.winScore && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Target className="h-4 w-4" />
              <span>Win: {game.winScore}</span>
            </div>
          )}
          {game.maxActions && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Max: {game.maxActions} actions</span>
            </div>
          )}
          {game.levelCount && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Star className="h-4 w-4" />
              <span>{game.levelCount} levels</span>
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {game.tags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
          {game.tags.length > 4 && (
            <Badge variant="outline" className="text-xs">
              +{game.tags.length - 4}
            </Badge>
          )}
        </div>

        {/* Category Badge */}
        <div className="flex items-center justify-between pt-2">
          <Badge 
            variant="outline" 
            className={game.category === 'preview' 
              ? 'border-blue-500/50 text-blue-600' 
              : 'border-purple-500/50 text-purple-600'
            }
          >
            {game.category === 'preview' ? 'Preview Set' : 'Evaluation Set'}
          </Badge>

          <Link href={`/arc3/archive/games/${game.gameId}`}>
            <Button 
              variant="ghost" 
              size="sm" 
              className="group-hover:bg-amber-500/10"
            >
              View Spoilers
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Arc3ArchiveGamesBrowser() {
  const { data: games, isLoading, error } = useQuery<Arc3GameMetadata[]>({
    queryKey: ['arc3-archive-games'],
    queryFn: async () => {
      const response = await fetch('/api/arc3-archive/metadata/games');
      if (!response.ok) throw new Error('Failed to fetch archived games');
      const result = await response.json();
      return result.data;
    },
  });

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Archive className="h-8 w-8 text-amber-600" />
        <div>
          <h1 className="text-3xl font-bold">Archived ARC3 Games</h1>
          <p className="text-muted-foreground">
            The 6 official games from the ARC-AGI 3 preview period
          </p>
        </div>
      </div>

      {/* Archive Banner */}
      <Arc3ArchiveBanner compact />

      {/* Games Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
          <span className="ml-2 text-muted-foreground">Loading archived games...</span>
        </div>
      ) : error ? (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="py-6 text-center text-red-600">
            Failed to load archived games. Please try again later.
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {games?.map((game) => (
            <GameCard key={game.gameId} game={game} />
          ))}
        </div>
      )}

      {/* Back Link */}
      <div className="pt-4">
        <Link href="/arc3/archive">
          <Button variant="outline">
            Back to Archive
          </Button>
        </Link>
      </div>
    </div>
  );
}
