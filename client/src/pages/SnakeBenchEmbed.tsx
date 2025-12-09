/**
 * Author: Claude Haiku 4.5
 * Date: 2025-12-09
 * PURPOSE: Embed the official SnakeBench (snakebench.com) in an iframe.
 *          This is the canonical upstream deployment for official leaderboards and analytics.
 * SRP/DRY check: Pass - Single responsibility (embed official SnakeBench), reuses global layout & nav.
 */

import React from 'react';
import { Link } from 'wouter';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const SNAKEBENCH_OFFICIAL_URL = 'https://snakebench.com';

export default function SnakeBenchEmbed() {
  return (
    <div className="w-screen h-screen flex flex-col gap-6 p-8 -m-6">
      <Alert className="border-blue-200 bg-blue-50 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="text-5xl">🐍</div>
          <div className="flex-1">
            <AlertTitle className="text-blue-900 text-3xl font-bold">Official SnakeBench</AlertTitle>
            <AlertDescription className="text-blue-800 text-lg mt-3">
              Canonical leaderboards, Elo ratings, and analytics for LLM head-to-head snake games.
            </AlertDescription>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-lg">To run games with your own API key, visit</span>
              <Link href="/worm-arena">
                <Button variant="outline" className="gap-2 text-lg h-auto py-2">
                  <span className="text-3xl">🐛</span> Worm Arena
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </Alert>

      <div className="flex-1 overflow-hidden bg-white rounded-lg shadow-xl">
        <iframe
          src={SNAKEBENCH_OFFICIAL_URL}
          title="Official SnakeBench"
          className="w-full h-full border-none"
          allowFullScreen
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    </div>
  );
}
