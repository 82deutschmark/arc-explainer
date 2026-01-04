/*
Author: Claude Sonnet 4
Date: 2026-01-03
PURPOSE: Display Haiku's learned observations, descriptions, and hypotheses.
         Part of the vision-first, child-like learning UI for Haiku 4.5 agent.
SRP/DRY check: Pass — display component only.
*/

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Eye, Lightbulb, BookOpen } from 'lucide-react';

interface Arc3ObservationsListProps {
  observations: string[];
  descriptions?: string[];
  hypotheses?: string[];
}

export function Arc3ObservationsList({
  observations,
  descriptions = [],
  hypotheses = [],
}: Arc3ObservationsListProps) {
  const hasContent = observations.length > 0 || descriptions.length > 0 || hypotheses.length > 0;

  if (!hasContent) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-purple-500" />
            Haiku's Learning Journal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground italic">
            Haiku will record observations and patterns here as it learns...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-purple-500" />
            Haiku's Learning Journal
          </span>
          <Badge variant="outline" className="text-[9px]">
            {observations.length} learned
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[200px]">
          <div className="p-3 space-y-3">
            {/* Learned Observations - what Haiku discovered */}
            {observations.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1 text-[10px] font-medium text-green-700">
                  <Lightbulb className="h-3 w-3" />
                  Learned Patterns
                </div>
                {observations.slice(-5).map((obs, i) => (
                  <div
                    key={`obs-${i}`}
                    className="text-xs bg-green-50 border border-green-200 rounded px-2 py-1 text-green-800"
                  >
                    {obs}
                  </div>
                ))}
              </div>
            )}

            {/* Recent Hypotheses - what Haiku thinks */}
            {hypotheses.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1 text-[10px] font-medium text-amber-700">
                  <Lightbulb className="h-3 w-3" />
                  Recent Hypotheses
                </div>
                {hypotheses.slice(-3).map((hyp, i) => (
                  <div
                    key={`hyp-${i}`}
                    className="text-xs bg-amber-50 border border-amber-200 rounded px-2 py-1 text-amber-800 italic"
                  >
                    "{hyp.slice(0, 150)}{hyp.length > 150 ? '...' : ''}"
                  </div>
                ))}
              </div>
            )}

            {/* Recent Descriptions - what Haiku saw */}
            {descriptions.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1 text-[10px] font-medium text-blue-700">
                  <Eye className="h-3 w-3" />
                  What Haiku Saw
                </div>
                {descriptions.slice(-2).map((desc, i) => (
                  <div
                    key={`desc-${i}`}
                    className="text-xs bg-blue-50 border border-blue-200 rounded px-2 py-1 text-blue-800"
                  >
                    {desc.slice(0, 200)}{desc.length > 200 ? '...' : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
