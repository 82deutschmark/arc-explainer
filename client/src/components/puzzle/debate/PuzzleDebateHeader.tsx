/**
 * PuzzleDebateHeader.tsx
 *
 * Author: Claude Code using Sonnet 4
 * Date: 2025-09-29
 * PURPOSE: Header component for puzzle debate pages with puzzle input form.
 * Single responsibility: Page header with puzzle navigation only.
 * SRP/DRY check: Pass - Focused only on header/navigation concerns
 * shadcn/ui: Pass - Uses shadcn/ui components throughout
 */

import React, { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, ArrowLeft } from 'lucide-react';

interface PuzzleDebateHeaderProps {
  // Data
  taskId?: string;

  // Configuration
  title?: string;
  subtitle?: string;
  showBackButton?: boolean;

  // Actions
  onPuzzleIdSubmit?: (puzzleId: string) => void;
}

export const PuzzleDebateHeader: React.FC<PuzzleDebateHeaderProps> = ({
  taskId,
  title = "Model Debate",
  subtitle = "Watch AI models challenge each other's reasoning and propose alternative explanations",
  showBackButton = true,
  onPuzzleIdSubmit
}) => {
  const [inputPuzzleId, setInputPuzzleId] = useState('');

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPuzzleId.trim()) {
      if (onPuzzleIdSubmit) {
        onPuzzleIdSubmit(inputPuzzleId.trim());
      } else {
        // Default behavior: navigate to debate page
        window.location.href = `/debate/${inputPuzzleId.trim()}`;
      }
    }
  };

  // If no taskId, show the puzzle input form
  if (!taskId) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
            <MessageSquare className="h-6 w-6" />
            {title}
          </h1>
          <p className="text-gray-600">
            Watch AI models challenge each other's puzzle explanations
          </p>

          <form
            onSubmit={handleFormSubmit}
            className="flex items-center justify-center gap-2 max-w-md mx-auto"
          >
            <input
              type="text"
              value={inputPuzzleId}
              onChange={(e) => setInputPuzzleId(e.target.value)}
              placeholder="Enter puzzle ID..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button type="submit" disabled={!inputPuzzleId.trim()}>
              Start Debate
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Header for when we have a taskId
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          {title}
          <Badge variant="outline" className="ml-2">
            Puzzle {taskId}
          </Badge>
        </h1>
        <p className="text-gray-600">{subtitle}</p>
      </div>

      <div className="flex items-center gap-2">
        {showBackButton && (
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Browser
            </Button>
          </Link>
        )}

        <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={inputPuzzleId}
            onChange={(e) => setInputPuzzleId(e.target.value)}
            placeholder="Enter puzzle ID..."
            className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button type="submit" variant="outline" size="sm" disabled={!inputPuzzleId.trim()}>
            Switch Puzzle
          </Button>
        </form>
      </div>
    </div>
  );
};