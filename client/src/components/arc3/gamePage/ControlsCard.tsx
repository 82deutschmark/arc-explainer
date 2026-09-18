/*
 * Author: Claude Opus 5
 * Date: 2026-09-18
 * PURPOSE: A game's controls as a key-cap table (ACTION1 = Up, ...), the right-hand card of the
 *          "at a glance" band. Replaces the old full-width Action Mappings card near the bottom
 *          of the page, so the controls sit beside the plain-English summary, before the levels.
 * SRP/DRY check: Pass -- presentation of the game's actionMappings, nothing else.
 */

import { Keyboard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ActionMapping } from '@shared/arc3Games';

export function ControlsCard({ mappings }: { mappings: ActionMapping[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Keyboard className="h-4 w-4" />
          Controls
        </CardTitle>
      </CardHeader>
      <CardContent>
        {mappings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No controls recorded for this game.</p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-2 text-sm">
            {mappings.map((m) => (
              <div key={m.action} className="contents">
                <dt>
                  <kbd className="rounded border border-b-2 bg-muted px-1.5 py-px font-mono text-[11px] font-semibold">
                    {m.action}
                  </kbd>
                </dt>
                <dd className="m-0">
                  {m.commonName && <span className="font-semibold">{m.commonName} · </span>}
                  {m.description}
                  {m.notes && <span className="block text-xs text-muted-foreground">{m.notes}</span>}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
