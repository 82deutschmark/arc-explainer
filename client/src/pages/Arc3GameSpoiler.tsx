/*
 * Author: Claude Haiku 4.5
 * Date: 2025-12-21
 * PURPOSE: Individual game spoiler page for ARC-AGI-3 games.
 *          Displays all known information on a single page: game mechanics (centerpiece),
 *          action mappings, level screenshots, and external resources.
 *          Optimized for developer comprehension and LLM parsing (no interactive tabs).
 * SRP/DRY check: Pass - Single responsibility (game detail display), reuses shared game metadata.
 */

import React from 'react';
import { Link, useParams } from 'wouter';
import {
  Gamepad2,
  ArrowLeft,
  ExternalLink,
  Eye,
  Lock,
  Unlock,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Keyboard,
  Link2,
  Bot,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
  getGameById,
  type Arc3GameMetadata,
  type DifficultyRating,
  type ActionMapping,
  type LevelScreenshot,
  type GameResource,
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
 * Game not found component
 */
function GameNotFound({ gameId }: { gameId: string }) {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link href="/arc3/games">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Games
        </Link>
      </Button>
      <Card className="text-center py-12">
        <CardContent>
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Game Not Found</h1>
          <p className="text-muted-foreground mb-4">
            We don't have information about game "{gameId}" yet.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            This game may exist on the ARC-AGI-3 platform but hasn't been documented here.
          </p>
          <div className="flex gap-3 justify-center">
            <Button asChild variant="outline">
              <a
                href={`https://three.arcprize.org/games/${gameId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Try on Official Site
              </a>
            </Button>
            <Button asChild>
              <Link href="/arc3/games">
                Browse Known Games
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Arc3GameSpoiler() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId || '';
  const game = getGameById(gameId);

  usePageMeta({
    title: game 
      ? `ARC Explainer – ${game.informalName || game.gameId} (ARC-AGI-3 Game)`
      : `ARC Explainer – Game Not Found`,
    description: game
      ? `Spoilers, mechanics, and any hints or resources we've documented so far for ARC-AGI-3 game ${game.gameId}${game.informalName ? ` (${game.informalName})` : ''}. ${game.description}`
      : `Game not found in the ARC-AGI-3 database.`,
    canonicalPath: `/arc3/games/${gameId}`,
  });

  if (!game) {
    return <GameNotFound gameId={gameId} />;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Hero Section */}
      <div className="mb-12">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Gamepad2 className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">
                {game.informalName || game.gameId}
              </h1>
              {game.isFullyDocumented && (
                <span title="Fully documented">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-sm bg-muted px-2 py-1 rounded">{game.gameId}</code>
              <Badge
                variant={game.category === 'preview' ? 'default' : 'secondary'}
                className={game.category === 'preview' ? 'bg-blue-500' : 'bg-purple-500 text-white'}
              >
                {game.category === 'preview' ? (
                  <><Unlock className="h-3 w-3 mr-1" /> Preview Game</>
                ) : (
                  <><Lock className="h-3 w-3 mr-1" /> Evaluation Game</>
                )}
              </Badge>
              {getDifficultyBadge(game.difficulty)}
            </div>
          </div>
          <div>
            <Button asChild>
              <Link href={`/arc3/playground?game=${game.gameId}`}>
                <Bot className="h-4 w-4 mr-2" />
                Test with Agent
              </Link>
            </Button>
          </div>
        </div>
        <p className="text-lg text-muted-foreground">
          {game.description}
        </p>
      </div>

      {/* How It Works - CENTERPIECE */}
      <div className="mb-12 space-y-6">
        {game.mechanicsExplanation && (
          <Card className="border-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-3xl font-bold flex items-center gap-3">
                <BookOpen className="h-8 w-8" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap font-sans text-base text-foreground font-semibold leading-relaxed">
                {game.mechanicsExplanation.trim()}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Action Mappings */}
        {game.actionMappings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Keyboard className="h-5 w-5" />
                Action Mappings
              </CardTitle>
              <CardDescription>
                What each action does in this game
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {game.actionMappings.map((mapping: ActionMapping) => (
                  <div
                    key={mapping.action}
                    className="flex items-start gap-3 p-3 bg-muted rounded-lg"
                  >
                    <Badge variant="default" className="font-mono">
                      {mapping.action}
                    </Badge>
                    {mapping.commonName && (
                      <Badge variant="outline">{mapping.commonName}</Badge>
                    )}
                    <div className="flex-1">
                      <p className="text-sm">{mapping.description}</p>
                      {mapping.notes && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {mapping.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Screenshots */}
        {game.levelScreenshots && game.levelScreenshots.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Level Screenshots
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {game.levelScreenshots
                  .sort((a: LevelScreenshot, b: LevelScreenshot) => a.level - b.level)
                  .map((screenshot: LevelScreenshot) => (
                    <div key={screenshot.level} className="border rounded-lg overflow-hidden bg-muted">
                      <div className="p-3 bg-muted/80 border-b">
                        <p className="font-semibold text-sm">
                          Level {screenshot.level}
                          {screenshot.caption && ` – ${screenshot.caption}`}
                        </p>
                      </div>
                      <div className="relative aspect-square">
                        <img
                          src={screenshot.imageUrl}
                          alt={`Level ${screenshot.level}${screenshot.caption ? ` - ${screenshot.caption}` : ''}`}
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                      </div>
                      {screenshot.notes && (
                        <div className="p-3 border-t">
                          <p className="text-xs text-muted-foreground italic">
                            {screenshot.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Replays */}
        {game.resources.filter((r: GameResource) => r.type === 'replay').length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gamepad2 className="h-5 w-5" />
                Notable Playthroughs
              </CardTitle>
              <CardDescription>
                Watch expert players complete this game
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {game.resources
                  .filter((r: GameResource) => r.type === 'replay')
                  .map((replay: GameResource, idx: number) => (
                    <a
                      key={idx}
                      href={replay.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg hover:from-primary/15 hover:to-primary/10 transition-colors border border-primary/20"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-semibold text-primary hover:underline">
                            {replay.title}
                          </h4>
                          {replay.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {replay.description}
                            </p>
                          )}
                        </div>
                        <Badge variant="default" className="ml-2 whitespace-nowrap">
                          Watch <ExternalLink className="h-3 w-3 ml-1" />
                        </Badge>
                      </div>
                    </a>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resources */}
        {game.resources.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                External Resources
              </CardTitle>
              <CardDescription>
                Articles, videos, and discussions about this game
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {game.resources
                  .filter((r: GameResource) => r.type !== 'replay')
                  .map((resource: GameResource, idx: number) => (
                    <a
                      key={idx}
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-medium text-primary hover:underline">
                            {resource.title}
                          </h4>
                          {resource.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {resource.description}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {resource.type}
                        </Badge>
                      </div>
                    </a>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tags */}
        {game.tags.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {game.tags.map((tag: string) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {game.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{game.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Links Footer */}
      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3 justify-center">
            <Button asChild variant="outline" size="sm">
              <Link href="/arc3/games">
                <ArrowLeft className="h-4 w-4 mr-1" />
                All Games
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/arc3/playground?game=${game.gameId}`}>
                <Bot className="h-4 w-4 mr-1" />
                Test with Agent
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a
                href={`https://three.arcprize.org/games/${game.gameId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Official Site
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
