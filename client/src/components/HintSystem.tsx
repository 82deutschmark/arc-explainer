import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Eye, EyeOff } from 'lucide-react';
import { getSpaceEmoji, getEmojiDescription } from '@/lib/spaceEmojis';

interface HintSystemProps {
  hints: string[];
  showEmojiLegend?: boolean;
}

export function HintSystem({ hints, showEmojiLegend = true }: HintSystemProps) {
  const [revealedHints, setRevealedHints] = useState<boolean[]>(new Array(hints.length).fill(false));
  const [showLegend, setShowLegend] = useState(false);

  const revealHint = (index: number) => {
    const newRevealed = [...revealedHints];
    newRevealed[index] = true;
    setRevealedHints(newRevealed);
  };

  const hideHint = (index: number) => {
    const newRevealed = [...revealedHints];
    newRevealed[index] = false;
    setRevealedHints(newRevealed);
  };

  const revealAllHints = () => {
    setRevealedHints(new Array(hints.length).fill(true));
  };

  const hideAllHints = () => {
    setRevealedHints(new Array(hints.length).fill(false));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Hints
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={revealAllHints}
              className="text-xs"
            >
              Reveal All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={hideAllHints}
              className="text-xs"
            >
              Hide All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {hints.map((hint, index) => (
              <div key={index} className="flex items-start gap-3">
                <Badge variant="outline" className="mt-1 min-w-0">
                  {index + 1}
                </Badge>
                <div className="flex-1">
                  {revealedHints[index] ? (
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm">{hint}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => hideHint(index)}
                        className="p-1 h-auto"
                      >
                        <EyeOff className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      onClick={() => revealHint(index)}
                      className="p-0 h-auto text-left justify-start text-gray-500 hover:text-gray-700"
                    >
                      <Eye className="h-3 w-3 mr-2" />
                      Click to reveal hint {index + 1}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {showEmojiLegend && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Alien Communication Guide</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLegend(!showLegend)}
            >
              {showLegend ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </CardHeader>
          {showLegend && (
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Array.from({ length: 10 }, (_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-lg">{getSpaceEmoji(i)}</span>
                    <span className="text-xs text-gray-600">
                      {i}: {getEmojiDescription(i)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
