/*
 * Author: Claude (Windsurf Cascade)
 * Date: 2025-12-05
 * PURPOSE: Browse all ARC-AGI-3 games with metadata, difficulty ratings, and documentation status.
 *          Entry point to individual game spoiler pages. Shows preview vs evaluation categorization.
 * SRP/DRY check: Pass - Single responsibility (games listing), reuses shared game metadata.
 */

import React from 'react';
import { Link } from 'wouter';
import {
  Gamepad2,
  ArrowLeft,
  ExternalLink,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  BookOpen,
  Star,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
  getAllGames,
  getGamesByCategory,
  type Arc3GameMetadata,
  type DifficultyRating,
} from '../../../shared/arc3Games';

/**
 * Map difficulty to color variant
 */
function getDifficultyBadge(difficulty: DifficultyRating) {
  switch (difficulty) {
    case 'easy':
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Easy</Badge>;
    case 'medium':
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">Medium</Badge>;
    case 'hard':
      return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">Hard</Badge>;
    case 'very-hard':
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">Very Hard</Badge>;
    default:
      return <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-300">Unknown</Badge>;
  }
}

/**
 * Single game card component
 */
function GameCard({ game }: { game: Arc3GameMetadata }) {
  return (
    <Card className="h-full hover:shadow-lg transition-shadow overflow-hidden">
      {game.thumbnailUrl && (
        <div className="relative aspect-[4/3] w-full bg-muted border-b border-border/40">
          <img
            src={game.thumbnailUrl}
            alt={game.informalName ? `${game.informalName} (${game.gameId})` : game.gameId}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gamepad2 className="h-5 w-5 text-primary" />
              {game.informalName || game.gameId}
              {game.isFullyDocumented && (
                <span title="Fully documented">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </span>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{game.gameId}</code>
              {game.informalName && (
                <span className="ml-2 text-xs text-muted-foreground">
                  aka "{game.informalName}"
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-1 items-end">
            <Badge 
              variant={game.category === 'preview' ? 'default' : 'secondary'}
              className={game.category === 'preview' ? 'bg-blue-500' : 'bg-purple-500 text-white'}
            >
              {game.category === 'preview' ? (
                <><Unlock className="h-3 w-3 mr-1" /> Preview</>
              ) : (
                <><Lock className="h-3 w-3 mr-1" /> Evaluation</>
              )}
            </Badge>
            {getDifficultyBadge(game.difficulty)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-3">
          {game.description}
        </p>

        {/* Quick stats */}
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2 text-xs">
          {game.winScore !== undefined && (
            <div className="text-center p-2 bg-muted rounded">
              <div className="font-semibold text-primary">{game.winScore}</div>
              <div className="text-muted-foreground">Win Score</div>
            </div>
          )}
          {game.levelCount !== undefined && (
            <div className="text-center p-2 bg-muted rounded">
              <div className="font-semibold text-primary">{game.levelCount}</div>
              <div className="text-muted-foreground">Levels</div>
            </div>
          )}
          {game.hints.length > 0 && (
            <div className="text-center p-2 bg-muted rounded">
              <div className="font-semibold text-primary">{game.hints.length}</div>
              <div className="text-muted-foreground">Hints</div>
            </div>
          )}
          {game.resources.length > 0 && (
            <div className="text-center p-2 bg-muted rounded">
              <div className="font-semibold text-primary">{game.resources.length}</div>
              <div className="text-muted-foreground">Resources</div>
            </div>
          )}
        </div>

        {/* Notes / documentation status */}
        {game.notes && (
          <p className="text-xs text-muted-foreground">
            {game.notes}
          </p>
        )}

        {/* Tags */}
        {game.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {game.tags.slice(0, 4).map(tag => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {game.tags.length > 4 && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                +{game.tags.length - 4} more
              </Badge>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button asChild variant="default" size="sm" className="flex-1">
            <Link href={`/arc3/games/${game.gameId}`}>
              <BookOpen className="h-4 w-4 mr-1" />
              View Spoilers
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a
              href={`https://three.arcprize.org/games/${game.gameId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Arc3GamesBrowser() {
  usePageMeta({
    title: 'ARC Explainer – ARC-AGI-3 Games Browser',
    description:
      'Browse all ARC-AGI-3 games documentation. The ultimate community resource.',
    canonicalPath: '/arc3/games',
  });

  const allGames = getAllGames();
  const previewGames = getGamesByCategory('preview');
  const evaluationGames = getGamesByCategory('evaluation');

  const totalHints = allGames.reduce((sum, game) => sum + game.hints.length, 0);
  const fullyDocumentedCount = allGames.filter(game => game.isFullyDocumented).length;

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/arc3">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to ARC-AGI-3
          </Link>
        </Button>
      </div>

      {/* Coverage Summary */}
      <Card className="mb-8">
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="font-semibold text-foreground">Games covered</p>
            <p className="text-muted-foreground">{allGames.length} revealed ARC-AGI-3 games (preview + evaluation)</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Fully documented</p>
            <p className="text-muted-foreground">{fullyDocumentedCount} game(s) with complete mechanics and notes</p>
          </div>
          <div>
            <p className="font-semibold text-foreground">Hints captured</p>
            <p className="text-muted-foreground">{totalHints} hint(s) and strategy notes in this browser</p>
          </div>
        </CardContent>
      </Card>

      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Gamepad2 className="h-10 w-10 text-primary" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            ARC-AGI-3 Games Browser
          </h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          The ultimate spoilers resource. Everything we've learned about each game: 
          mechanics, hints, strategies, and community knowledge.
        </p>
      </div>

      {/* Spoiler Warning */}
      <Alert className="mb-6 border-amber-500 bg-amber-50 dark:bg-amber-950">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-900 dark:text-amber-100">
          Spoiler Warning
        </AlertTitle>
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          This page contains detailed spoilers about ARC-AGI-3 games. If you want the 
          authentic puzzle-solving experience, visit the{' '}
          <a 
            href="https://three.arcprize.org/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="underline font-medium"
          >
            official ARC-AGI-3 site
          </a>{' '}
          first.
        </AlertDescription>
      </Alert>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 justify-center mb-6">
        <Button asChild variant="outline">
          <Link href="/arc3/playground">
            <Gamepad2 className="h-4 w-4 mr-2" />
            Test with Agent
          </Link>
        </Button>
        <Button asChild variant="outline">
          <a
            href="https://three.arcprize.org/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Official Platform
          </a>
        </Button>
      </div>

      {/* Preview Games Section */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="h-5 w-5 text-blue-500" />
          <h2 className="text-2xl font-bold">Preview Games</h2>
          <Badge className="bg-blue-500">{previewGames.length}</Badge>
        </div>
        <p className="text-muted-foreground mb-6">
          These games were publicly available from the start of the ARC-AGI-3 preview. 
          The community has had the most time to study and document these.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {previewGames.map(game => (
            <GameCard key={game.gameId} game={game} />
          ))}
        </div>
      </section>

      {/* Evaluation Games Section */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <EyeOff className="h-5 w-5 text-purple-500" />
          <h2 className="text-2xl font-bold">Evaluation Games</h2>
          <Badge className="bg-purple-500">{evaluationGames.length}</Badge>
        </div>
        <p className="text-muted-foreground mb-6">
          These games were held back during the preview for evaluation purposes. 
          Less community documentation is available for these games.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {evaluationGames.map(game => (
            <GameCard key={game.gameId} game={game} />
          ))}
        </div>
      </section>

      {/* Legend */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-500">Preview</Badge>
              <span className="text-muted-foreground">Public from start</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-purple-500">Evaluation</Badge>
              <span className="text-muted-foreground">Held back</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">Fully documented</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-muted-foreground">Community favorite</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contribute CTA */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-2 border-primary/20">
        <CardHeader>
          <CardTitle>Help Document These Games</CardTitle>
          <CardDescription>
            Know something about an ARC-AGI-3 game that isn't documented here?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            We're building the ultimate community resource for ARC-AGI-3. If you've discovered 
            mechanics, hints, or strategies for any game, we'd love to include your knowledge!
          </p>
          <Button asChild variant="outline">
            <a
              href="https://github.com/82deutschmark/arc-explainer/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Submit via GitHub
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
