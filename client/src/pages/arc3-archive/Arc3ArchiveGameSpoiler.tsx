/*
 * Author: Cascade (Claude)
 * Date: 2026-01-31
 * PURPOSE: Archived game spoiler page showing detailed mechanics, hints, and level screenshots
 *          for a specific ARC3 preview game.
 * SRP/DRY check: Pass — single-purpose spoiler display for archived games.
 */

import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'wouter';
import { 
  Archive, ArrowLeft, Gamepad2, Target, Clock, Star, 
  Lightbulb, ExternalLink, Video, Loader2 
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Arc3ArchiveBanner } from '@/components/arc3/Arc3ArchiveBanner';
import type { Arc3GameMetadata, DifficultyRating } from '@shared/arc3Games/types';

const difficultyColors: Record<DifficultyRating, string> = {
  easy: 'bg-green-500/20 text-green-700 dark:text-green-400',
  medium: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  hard: 'bg-orange-500/20 text-orange-700 dark:text-orange-400',
  'very-hard': 'bg-red-500/20 text-red-700 dark:text-red-400',
  unknown: 'bg-gray-500/20 text-gray-700 dark:text-gray-400',
};

export default function Arc3ArchiveGameSpoiler() {
  const { gameId } = useParams<{ gameId: string }>();

  const { data: game, isLoading, error } = useQuery<Arc3GameMetadata>({
    queryKey: ['arc3-archive-game', gameId],
    queryFn: async () => {
      const response = await fetch(`/api/arc3-archive/metadata/games/${gameId}`);
      if (!response.ok) throw new Error('Failed to fetch game');
      const result = await response.json();
      return result.data;
    },
    enabled: !!gameId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        <span className="ml-2 text-muted-foreground">Loading game data...</span>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="py-6 text-center text-red-600">
            Game not found or failed to load.
            <div className="mt-4">
              <Link href="/arc3/archive/games">
                <Button variant="outline">Back to Games</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Back Navigation */}
      <Link href="/arc3/archive/games">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Archived Games
        </Button>
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Archive className="h-8 w-8 text-amber-600" />
            <h1 className="text-3xl font-bold">{game.gameId.toUpperCase()}</h1>
            <Badge className={difficultyColors[game.difficulty]}>
              {game.difficulty}
            </Badge>
          </div>
          <p className="text-xl text-muted-foreground mt-1">
            {game.officialTitle}
            {game.informalName && (
              <span className="ml-2 text-amber-600">({game.informalName})</span>
            )}
          </p>
        </div>
        <Badge 
          variant="outline" 
          className={game.category === 'preview' 
            ? 'border-blue-500/50 text-blue-600' 
            : 'border-purple-500/50 text-purple-600'
          }
        >
          {game.category === 'preview' ? 'Preview Set' : 'Evaluation Set'}
        </Badge>
      </div>

      {/* Archive Banner */}
      <Arc3ArchiveBanner compact />

      {/* Game Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {game.winScore && (
          <Card className="border-amber-500/20">
            <CardContent className="pt-4 text-center">
              <Target className="h-6 w-6 mx-auto text-amber-600 mb-2" />
              <div className="text-2xl font-bold">{game.winScore}</div>
              <div className="text-sm text-muted-foreground">Win Score</div>
            </CardContent>
          </Card>
        )}
        {game.maxActions && (
          <Card className="border-amber-500/20">
            <CardContent className="pt-4 text-center">
              <Clock className="h-6 w-6 mx-auto text-amber-600 mb-2" />
              <div className="text-2xl font-bold">{game.maxActions}</div>
              <div className="text-sm text-muted-foreground">Max Actions</div>
            </CardContent>
          </Card>
        )}
        {game.levelCount && (
          <Card className="border-amber-500/20">
            <CardContent className="pt-4 text-center">
              <Star className="h-6 w-6 mx-auto text-amber-600 mb-2" />
              <div className="text-2xl font-bold">{game.levelCount}</div>
              <div className="text-sm text-muted-foreground">Levels</div>
            </CardContent>
          </Card>
        )}
        <Card className="border-amber-500/20">
          <CardContent className="pt-4 text-center">
            <Gamepad2 className="h-6 w-6 mx-auto text-amber-600 mb-2" />
            <div className="text-2xl font-bold">{game.actionMappings.length}</div>
            <div className="text-sm text-muted-foreground">Actions</div>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      <Card className="border-amber-500/20">
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{game.description}</p>
          {game.mechanicsExplanation && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Mechanics (Spoiler)</h4>
              <p className="text-sm">{game.mechanicsExplanation}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Mappings */}
      <Card className="border-amber-500/20">
        <CardHeader>
          <CardTitle>Action Mappings</CardTitle>
          <CardDescription>What each action does in this game</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {game.actionMappings.map((mapping) => (
              <div 
                key={mapping.action} 
                className="flex items-start gap-3 p-3 rounded-lg bg-muted"
              >
                <Badge variant="outline" className="shrink-0">
                  {mapping.action}
                </Badge>
                <div>
                  <div className="font-medium">
                    {mapping.commonName || mapping.description}
                  </div>
                  {mapping.commonName && (
                    <div className="text-sm text-muted-foreground">
                      {mapping.description}
                    </div>
                  )}
                  {mapping.notes && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {mapping.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Hints */}
      {game.hints.length > 0 && (
        <Card className="border-amber-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-600" />
              Hints & Strategies
            </CardTitle>
            <CardDescription>Community-contributed tips (may contain spoilers)</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {game.hints.map((hint, index) => (
                <AccordionItem key={hint.id} value={hint.id}>
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={
                          hint.spoilerLevel === 1 ? 'border-green-500/50' :
                          hint.spoilerLevel === 2 ? 'border-yellow-500/50' :
                          'border-red-500/50'
                        }
                      >
                        Level {hint.spoilerLevel}
                      </Badge>
                      {hint.title}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p>{hint.content}</p>
                    {hint.contributor && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Contributed by: {hint.contributor}
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Level Screenshots */}
      {game.levelScreenshots && game.levelScreenshots.length > 0 && (
        <Card className="border-amber-500/20">
          <CardHeader>
            <CardTitle>Level Screenshots</CardTitle>
            <CardDescription>Visual reference for each level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {game.levelScreenshots.map((screenshot) => (
                <div key={screenshot.level} className="space-y-2">
                  <img 
                    src={screenshot.imageUrl} 
                    alt={`Level ${screenshot.level}`}
                    className="w-full aspect-square object-contain rounded-lg border bg-black"
                  />
                  <div className="text-sm text-center">
                    <Badge variant="outline">Level {screenshot.level}</Badge>
                    {screenshot.caption && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {screenshot.caption}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Video */}
      {game.video && (
        <Card className="border-amber-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-amber-600" />
              Featured Replay
            </CardTitle>
          </CardHeader>
          <CardContent>
            <video 
              src={game.video.src}
              poster={game.video.poster}
              controls
              className="w-full max-w-2xl mx-auto rounded-lg"
            />
            {game.video.caption && (
              <p className="text-sm text-center text-muted-foreground mt-2">
                {game.video.caption}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Resources */}
      {game.resources.length > 0 && (
        <Card className="border-amber-500/20">
          <CardHeader>
            <CardTitle>External Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {game.resources.map((resource, index) => (
                <a 
                  key={index}
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <Badge variant="outline">{resource.type}</Badge>
                  <span className="flex-1">{resource.title}</span>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        {game.tags.map((tag) => (
          <Badge key={tag} variant="secondary">
            {tag}
          </Badge>
        ))}
      </div>
    </div>
  );
}
