/*
 * Author: Claude (Windsurf Cascade)
 * Date: 2025-12-05
 * PURPOSE: Individual game spoiler page for ARC-AGI-3 games.
 *          Shows all known information: mechanics, hints, strategies, and embeds the playable game.
 *          This is the "ultimate spoilers" page - everything we know about a specific game.
 * SRP/DRY check: Pass - Single responsibility (game detail display), reuses shared game metadata.
 */

import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'wouter';
import {
  Gamepad2,
  ArrowLeft,
  ExternalLink,
  Play,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  BookOpen,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Keyboard,
  Info,
  Link2,
  Bot,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageMeta } from '@/hooks/usePageMeta';
import { 
  getGameById, 
  type Arc3GameMetadata,
  type DifficultyRating,
  type GameHint,
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
 * Map spoiler level to badge
 */
function getSpoilerBadge(level: 1 | 2 | 3) {
  switch (level) {
    case 1:
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Mild Hint</Badge>;
    case 2:
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">Moderate Spoiler</Badge>;
    case 3:
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">Full Solution</Badge>;
  }
}

/**
 * Hint card component with spoiler warning
 */
function HintCard({ hint, initiallyHidden = true }: { hint: GameHint; initiallyHidden?: boolean }) {
  const [isRevealed, setIsRevealed] = useState(!initiallyHidden);

  return (
    <Card className={`transition-all ${hint.spoilerLevel === 3 ? 'border-red-200' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            {hint.title}
          </CardTitle>
          {getSpoilerBadge(hint.spoilerLevel)}
        </div>
        {hint.contributor && (
          <CardDescription className="text-xs">
            Contributed by {hint.contributor}
            {hint.dateAdded && ` on ${hint.dateAdded}`}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {isRevealed ? (
          <>
            <p className="text-sm text-muted-foreground">{hint.content}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsRevealed(false)}
              className="mt-2 text-xs"
            >
              <EyeOff className="h-3 w-3 mr-1" />
              Hide
            </Button>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              {hint.spoilerLevel === 1 && 'This is a mild hint.'}
              {hint.spoilerLevel === 2 && 'This is a moderate spoiler.'}
              {hint.spoilerLevel === 3 && '⚠️ This reveals the full solution!'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRevealed(true)}
            >
              <Eye className="h-3 w-3 mr-1" />
              Reveal Hint
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
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
      ? `Complete spoilers, hints, and strategies for ARC-AGI-3 game ${game.gameId}${game.informalName ? ` (${game.informalName})` : ''}. ${game.description}`
      : `Game not found in the ARC-AGI-3 database.`,
    canonicalPath: `/arc3/games/${gameId}`,
  });

  if (!game) {
    return <GameNotFound gameId={gameId} />;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Hero Section */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
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
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <a
                href={`https://three.arcprize.org/games/${game.gameId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Play on Official Site
              </a>
            </Button>
            <Button asChild>
              <Link href={`/arc3/playground?game=${game.gameId}`}>
                <Bot className="h-4 w-4 mr-2" />
                Test with Agent
              </Link>
            </Button>
          </div>
        </div>
        <p className="text-lg text-muted-foreground mt-4">
          {game.description}
        </p>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="play" className="mb-8">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="play">
            <Play className="h-4 w-4 mr-2" />
            Play
          </TabsTrigger>
          <TabsTrigger value="mechanics">
            <Info className="h-4 w-4 mr-2" />
            Mechanics
          </TabsTrigger>
          <TabsTrigger value="screenshots">
            <Eye className="h-4 w-4 mr-2" />
            Screenshots ({game.levelScreenshots?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="resources">
            <Link2 className="h-4 w-4 mr-2" />
            Resources
          </TabsTrigger>
        </TabsList>

        {/* Play Tab - Embedded Game */}
        <TabsContent value="play" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Play {game.informalName || game.gameId}
              </CardTitle>
              <CardDescription>
                The game is embedded below from the official ARC-AGI-3 platform.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-square w-full max-w-3xl mx-auto rounded-lg overflow-hidden border bg-black">
                <iframe
                  src={`https://three.arcprize.org/games/${game.gameId}`}
                  className="w-full h-full"
                  title={`Play ${game.informalName || game.gameId}`}
                  allow="fullscreen"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Having trouble? Try{' '}
                <a
                  href={`https://three.arcprize.org/games/${game.gameId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  opening in a new tab
                </a>.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mechanics Tab */}
        <TabsContent value="mechanics" className="mt-6 space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Game Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {game.winScore !== undefined && (
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-primary">{game.winScore}</div>
                    <div className="text-sm text-muted-foreground">Win Score</div>
                  </div>
                )}
                {game.maxActions !== undefined && (
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-primary">{game.maxActions}</div>
                    <div className="text-sm text-muted-foreground">Max Actions</div>
                  </div>
                )}
                {game.levelCount !== undefined && (
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-primary">{game.levelCount}</div>
                    <div className="text-sm text-muted-foreground">Levels</div>
                  </div>
                )}
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary">{game.actionMappings.length}</div>
                  <div className="text-sm text-muted-foreground">Actions Available</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mechanics Explanation */}
          {game.mechanicsExplanation && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  How It Works
                </CardTitle>
                <CardDescription>
                  Detailed explanation of the game mechanics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground leading-relaxed">
                    {game.mechanicsExplanation.trim()}
                  </pre>
                </div>
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
                  {game.actionMappings.map(mapping => (
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

          {/* Tags */}
          {game.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {game.tags.map(tag => (
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
        </TabsContent>

        {/* Screenshots Tab */}
        <TabsContent value="screenshots" className="mt-6">
          {!game.levelScreenshots || game.levelScreenshots.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-semibold mb-2">No Screenshots Yet</h3>
                <p className="text-muted-foreground mb-4">
                  No level screenshots have been documented for this game yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {game.levelScreenshots
                .sort((a, b) => a.level - b.level)
                .map(screenshot => (
                  <Card key={screenshot.level} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          Level {screenshot.level}
                        </Badge>
                        {screenshot.caption && (
                          <span className="text-sm font-normal text-muted-foreground">
                            {screenshot.caption}
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="relative aspect-square bg-muted">
                        <img
                          src={screenshot.imageUrl}
                          alt={`Level ${screenshot.level}${screenshot.caption ? ` - ${screenshot.caption}` : ''}`}
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                      </div>
                      {screenshot.notes && (
                        <div className="p-4 pt-3">
                          <p className="text-xs text-muted-foreground italic">
                            {screenshot.notes}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources" className="mt-6">
          {game.resources.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Link2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Resources Yet</h3>
                <p className="text-muted-foreground mb-4">
                  We don't have any external resources documented for this game yet.
                </p>
                <Button asChild variant="outline">
                  <a
                    href="https://github.com/82deutschmark/arc-explainer/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Suggest a Resource
                  </a>
                </Button>
              </CardContent>
            </Card>
          ) : (
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
                  {game.resources.map((resource, idx) => (
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
        </TabsContent>
      </Tabs>

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
