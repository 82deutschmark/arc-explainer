/**
 * Minimal PuzzleOverview to test if the page works at all
 */

import React from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export function MinimalOverview() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Puzzle Overview</h1>
            <Link href="/">
              <Button variant="outline">← Back</Button>
            </Link>
          </div>
        </header>
        
        <div className="bg-white rounded-lg p-6">
          <p>Testing minimal overview page...</p>
        </div>
      </div>
    </div>
  );
}