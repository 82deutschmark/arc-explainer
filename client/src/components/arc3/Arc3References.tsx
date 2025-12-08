/*
Author: Codex
Date: 2025-12-07
PURPOSE: Provide a reusable reference card for ARC-AGI-3 external resources so browser pages can stay modular while remaining consistent.
SRP/DRY check: Pass - This component encapsulates only reference links and can be shared wherever ARC-AGI-3 resources are surfaced.
*/

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const references = [
  {
    href: 'https://github.com/arcprize/ARC-AGI-3-Agents',
    title: 'ARC-AGI-3-Agents GitHub Repository',
    description: 'Official agent framework and examples for building ARC-AGI-3 agents.',
    label: 'github.com/arcprize/ARC-AGI-3-Agents',
  },
  {
    href: 'https://arcprize.org/arc-agi/3/',
    title: 'ARC-AGI-3 Official Announcement',
    description: 'Introduction to Interactive Reasoning Benchmarks and the ARC-AGI-3 format.',
    label: 'arcprize.org',
  },
];

export default function Arc3References() {
  return (
    <Card className="mt-12">
      <CardHeader>
        <CardTitle>Reference Materials</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {references.map(reference => (
          <div key={reference.href} className="flex items-start gap-2">
            <ExternalLink className="h-4 w-4 mt-1 flex-shrink-0 text-muted-foreground" />
            <div>
              <a
                href={reference.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline font-medium"
              >
                {reference.title}
              </a>
              <p className="text-sm text-muted-foreground">{reference.description}</p>
              <p className="text-xs text-muted-foreground">{reference.label}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
