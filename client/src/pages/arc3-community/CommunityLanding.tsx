/*
 * Author: Cascade (Claude)
 * Date: 2026-01-31
 * PURPOSE: Landing page for the ARC3 Community Games platform. Information-dense,
 *          terminal-style design for researchers. Shows games table, quick actions,
 *          and links to ARCEngine GitHub.
 * SRP/DRY check: Pass — single-purpose landing page component.
 */

import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { 
  ExternalLink,
  Play,
  Upload,
  BookOpen,
  Github,
  ChevronRight,
  Terminal,
  Zap
} from "lucide-react";

interface CommunityGame {
  id: number;
  gameId: string;
  displayName: string;
  description: string | null;
  authorName: string;
  difficulty: string;
  playCount: number;
  tags: string[];
  levelCount?: number;
}

interface GamesResponse {
  success: boolean;
  data: CommunityGame[];
}

// Difficulty color mapping - muted, professional
const difficultyColor: Record<string, string> = {
  easy: "text-green-500",
  medium: "text-amber-500",
  hard: "text-red-500",
};

export default function CommunityLanding() {
  const { data: featuredGames, isLoading } = useQuery<GamesResponse>({
    queryKey: ["/api/arc3-community/games/featured"],
  });

  const games = featuredGames?.data || [];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      {/* Header bar */}
      <header className="border-b border-zinc-800 bg-zinc-900/80">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-semibold tracking-tight">ARC3 Community</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <a 
              href="https://github.com/voynow/ARCEngine" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              ARCEngine
              <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-zinc-700">|</span>
            <Link href="/arc3/docs" className="text-zinc-400 hover:text-zinc-100 transition-colors">
              Docs
            </Link>
            <span className="text-zinc-700">|</span>
            <Link href="/arc3/upload">
              <Button size="sm" variant="outline" className="h-6 px-2 text-xs border-zinc-700 hover:bg-zinc-800">
                <Upload className="w-3 h-3 mr-1" />
                Submit Game
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="border-b border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded bg-emerald-500/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold text-zinc-100">Community Puzzle Games</h1>
          </div>
          <p className="text-zinc-400 text-sm max-w-2xl mb-4">
            Play ARC-style reasoning puzzles created by the community using ARCEngine. 
            Test your abstract reasoning skills or create and share your own puzzle games.
          </p>
          <div className="flex gap-2">
            <Link href="/arc3/gallery">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs h-8">
                <Play className="w-3 h-3 mr-1" />
                Browse Games
              </Button>
            </Link>
            <Link href="/arc3/upload">
              <Button size="sm" variant="outline" className="border-zinc-700 hover:bg-zinc-800 text-xs h-8">
                <Upload className="w-3 h-3 mr-1" />
                Submit Your Game
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Two-column layout: Games list + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          
          {/* Main content: Games table */}
          <div className="lg:col-span-3">
            <div className="border border-zinc-800 rounded bg-zinc-900/50">
              {/* Table header */}
              <div className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                <div className="col-span-4">Game</div>
                <div className="col-span-3">Author</div>
                <div className="col-span-2">Difficulty</div>
                <div className="col-span-1 text-right">Levels</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              
              {/* Game rows */}
              {isLoading ? (
                <div className="px-3 py-8 text-center text-zinc-500 text-sm">Loading games...</div>
              ) : games.length === 0 ? (
                <div className="px-3 py-8 text-center text-zinc-500 text-sm">No games available</div>
              ) : (
                games.map((game, idx) => (
                  <div 
                    key={game.gameId}
                    className={`grid grid-cols-12 gap-2 px-3 py-2 items-center text-sm hover:bg-zinc-800/50 transition-colors ${
                      idx !== games.length - 1 ? "border-b border-zinc-800/50" : ""
                    }`}
                  >
                    <div className="col-span-4">
                      <Link href={`/arc3/play/${game.gameId}`} className="group">
                        <span className="text-zinc-100 group-hover:text-emerald-400 transition-colors font-medium">
                          {game.displayName}
                        </span>
                        {game.tags?.includes("featured") && (
                          <Zap className="w-3 h-3 inline ml-1.5 text-amber-500" title="Featured" />
                        )}
                      </Link>
                      <p className="text-xs text-zinc-500 truncate mt-0.5" title={game.description || ""}>
                        {game.description || "No description"}
                      </p>
                    </div>
                    <div className="col-span-3 text-zinc-400 text-xs">
                      {game.authorName}
                    </div>
                    <div className={`col-span-2 text-xs ${difficultyColor[game.difficulty] || "text-zinc-400"}`}>
                      {game.difficulty}
                    </div>
                    <div className="col-span-1 text-right text-zinc-400 text-xs">
                      {game.levelCount || "?"}
                    </div>
                    <div className="col-span-2 text-right">
                      <Link href={`/arc3/play/${game.gameId}`}>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-emerald-500 hover:text-emerald-400 hover:bg-emerald-950/30">
                          <Play className="w-3 h-3 mr-1" />
                          Play
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))
              )}
              
              {/* Footer with view all */}
              <div className="px-3 py-2 border-t border-zinc-800 flex justify-between items-center">
                <span className="text-xs text-zinc-500">{games.length} games loaded</span>
                <Link href="/arc3/gallery" className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center gap-1">
                  View all games <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>

          {/* Sidebar: Quick info + Create your own */}
          <div className="lg:col-span-1 space-y-4">
            {/* Quick actions */}
            <div className="border border-zinc-800 rounded bg-zinc-900/50 p-3">
              <h3 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Link href="/arc3/gallery" className="block">
                  <Button variant="outline" size="sm" className="w-full justify-start h-8 text-xs border-zinc-700 hover:bg-zinc-800">
                    <Play className="w-3 h-3 mr-2 text-emerald-500" />
                    Browse All Games
                  </Button>
                </Link>
                <Link href="/arc3/upload" className="block">
                  <Button variant="outline" size="sm" className="w-full justify-start h-8 text-xs border-zinc-700 hover:bg-zinc-800">
                    <Upload className="w-3 h-3 mr-2 text-blue-500" />
                    Submit Your Game
                  </Button>
                </Link>
                <Link href="/arc3/docs" className="block">
                  <Button variant="outline" size="sm" className="w-full justify-start h-8 text-xs border-zinc-700 hover:bg-zinc-800">
                    <BookOpen className="w-3 h-3 mr-2 text-amber-500" />
                    Documentation
                  </Button>
                </Link>
              </div>
            </div>

            {/* Create your own game */}
            <div className="border border-zinc-800 rounded bg-zinc-900/50 p-3">
              <h3 className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Create Your Own</h3>
              <p className="text-xs text-zinc-400 mb-3">
                Build puzzle games with ARCEngine - a Python framework for creating ARC-style reasoning challenges.
              </p>
              <div className="space-y-1.5 text-xs">
                <a 
                  href="https://github.com/voynow/ARCEngine"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  <Github className="w-3 h-3" />
                  <span>ARCEngine Repository</span>
                  <ExternalLink className="w-3 h-3 ml-auto" />
                </a>
                <a 
                  href="https://pypi.org/project/arcengine/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  <Terminal className="w-3 h-3" />
                  <span>pip install arcengine</span>
                  <ExternalLink className="w-3 h-3 ml-auto" />
                </a>
              </div>
              <div className="mt-3 p-2 bg-zinc-950 rounded border border-zinc-800">
                <code className="text-[10px] text-emerald-400 block">
                  from arcengine import ARCBaseGame
                </code>
              </div>
            </div>

            {/* Archive link */}
            <div className="border border-zinc-800 rounded bg-zinc-900/50 p-3">
              <Link href="/arc3/archive" className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1">
                View legacy ARC3 preview games <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
