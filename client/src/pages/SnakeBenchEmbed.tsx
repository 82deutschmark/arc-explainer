/**
 * Author: Claude Haiku 4.5
 * Date: 2025-12-09
 * PURPOSE: Embed the official SnakeBench (snakebench.com) in an iframe.
 *          This is the canonical upstream deployment for official leaderboards and analytics.
 * SRP/DRY check: Pass - Single responsibility (embed official SnakeBench), reuses global layout & nav.
 */

import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

const SNAKEBENCH_OFFICIAL_URL = 'https://snakebench.com';

export default function SnakeBenchEmbed() {
  return (
    <div className="w-full h-full flex flex-col gap-4 p-6">
      <Alert className="border-blue-200 bg-blue-50">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-900">Official SnakeBench</AlertTitle>
        <AlertDescription className="text-blue-800">
          This is the official SnakeBench deployment with canonical leaderboards, Elo ratings, and analytics.
          To run games with your own API key, visit <strong>Worm Arena</strong> instead.
        </AlertDescription>
      </Alert>

      <div className="flex-1 border rounded-lg overflow-hidden bg-white">
        <iframe
          src={SNAKEBENCH_OFFICIAL_URL}
          title="Official SnakeBench Arena"
          className="w-full h-full border-none"
          allowFullScreen
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    </div>
  );
}
