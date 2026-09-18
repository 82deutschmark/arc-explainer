/*
 * Author: Claude Opus 5
 * Date: 2026-09-18
 * PURPOSE: A collapsed-by-default section at the foot of a game page: a title and a one-line
 *          summary always showing, the full content on click. Holds the Human Records table and
 *          the replays / sources / correction history, which used to be full cards stacked
 *          above and below the write-up.
 * SRP/DRY check: Pass -- a thin wrapper over the shadcn Collapsible; no content of its own.
 */

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export function FoldOut({
  title,
  summary,
  children,
}: {
  title: string;
  summary?: string | null;
  children: React.ReactNode;
}) {
  return (
    <Collapsible className="group rounded-md border bg-card">
      <CollapsibleTrigger className="flex w-full items-baseline gap-2 px-4 py-3 text-left">
        <ChevronRight className="h-4 w-4 shrink-0 self-center transition-transform group-data-[state=open]:rotate-90" />
        <span className="text-sm font-semibold">{title}</span>
        {summary && <span className="min-w-0 truncate text-xs text-muted-foreground">{summary}</span>}
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-4 py-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}
