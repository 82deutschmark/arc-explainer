<<<<<<< C:/Projects/arc-explainer/client/src/pages/arc3-community/CommunityLanding.tsx
/*
 * Author: Cascade (Claude)
 * Date: 2026-01-31
 * PURPOSE: Landing page for the ARC3 Community Games platform. Showcases featured
 *          games, provides navigation to gallery, upload, and documentation.
 * SRP/DRY check: Pass — single-purpose landing page component.
 */

import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Gamepad2, 
  Upload, 
  BookOpen, 
  TrendingUp, 
  Users, 
  Sparkles,
  ArrowRight,
  Archive
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
}

interface StatsResponse {
  success: boolean;
  data: {
    totalGames: number;
    approvedGames: number;
    pendingGames: number;
  };
}

interface GamesResponse {
  success: boolean;
  data: CommunityGame[];
}

export default function CommunityLanding() {
  // Fetch featured games
  const { data: featuredGames } = useQuery<GamesResponse>({
    queryKey: ["/api/arc3-community/games/featured"],
  });

  // Fetch stats
  const { data: stats } = useQuery<StatsResponse>({
    queryKey: ["/api/arc3-community/stats"],
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 via-blue-900/20 to-cyan-900/20" />
        <div className="container mx-auto px-4 py-16 relative">
          <div className="text-center max-w-3xl mx-auto">
            <Badge variant="outline" className="mb-4 text-cyan-400 border-cyan-400/50">
              <Sparkles className="w-3 h-3 mr-1" />
              Community Platform
            </Badge>
            <h1 className="text-5xl font-bold text-white mb-4">
              ARC3 Community Games
            </h1>
            <p className="text-xl text-slate-300 mb-8">
              Create, share, and play puzzle games built with ARCEngine. 
              Join our community of game creators exploring the boundaries of abstract reasoning.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/arc3/gallery">
                <Button size="lg" className="bg-cyan-600 hover:bg-cyan-700">
                  <Gamepad2 className="w-5 h-5 mr-2" />
                  Browse Games
                </Button>
              </Link>
              <Link href="/arc3/upload">
                <Button size="lg" variant="outline" className="border-cyan-500 text-cyan-400 hover:bg-cyan-950">
                  <Upload className="w-5 h-5 mr-2" />
                  Upload Your Game
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6 text-center">
              <Gamepad2 className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
              <div className="text-3xl font-bold text-white">
                {stats?.data?.approvedGames || 0}
              </div>
              <div className="text-slate-400">Games Available</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6 text-center">
              <Users className="w-8 h-8 text-purple-400 mx-auto mb-2" />
              <div className="text-3xl font-bold text-white">
                {stats?.data?.totalGames || 0}
              </div>
              <div className="text-slate-400">Total Submissions</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6 text-center">
              <TrendingUp className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <div className="text-3xl font-bold text-white">
                {stats?.data?.pendingGames || 0}
              </div>
              <div className="text-slate-400">Pending Review</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Featured Games Section */}
      {featuredGames?.data && featuredGames.data.length > 0 && (
        <div className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-yellow-400" />
              Featured Games
            </h2>
            <Link href="/arc3/gallery">
              <Button variant="ghost" className="text-cyan-400 hover:text-cyan-300">
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredGames.data.slice(0, 6).map((game) => (
              <Link key={game.gameId} href={`/arc3/play/${game.gameId}`}>
                <Card className="bg-slate-800/50 border-slate-700 hover:border-cyan-500/50 transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-white">{game.displayName}</CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {game.difficulty}
                      </Badge>
                    </div>
                    <CardDescription className="text-slate-400">
                      by {game.authorName}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-300 text-sm line-clamp-2 mb-4">
                      {game.description || "No description provided."}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">
                        {game.playCount} plays
                      </span>
                      <div className="flex gap-1">
                        {game.tags?.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Links Section */}
      <div className="container mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-white mb-8 text-center">Get Started</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Link href="/arc3/gallery">
            <Card className="bg-slate-800/50 border-slate-700 hover:border-cyan-500/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <Gamepad2 className="w-10 h-10 text-cyan-400 mb-2" />
                <CardTitle className="text-white">Play Games</CardTitle>
                <CardDescription>
                  Browse and play community-created puzzle games
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/arc3/upload">
            <Card className="bg-slate-800/50 border-slate-700 hover:border-purple-500/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <Upload className="w-10 h-10 text-purple-400 mb-2" />
                <CardTitle className="text-white">Upload Your Game</CardTitle>
                <CardDescription>
                  Share your ARCEngine creation with the community
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/arc3/docs">
            <Card className="bg-slate-800/50 border-slate-700 hover:border-green-500/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <BookOpen className="w-10 h-10 text-green-400 mb-2" />
                <CardTitle className="text-white">Documentation</CardTitle>
                <CardDescription>
                  Learn how to create games with ARCEngine
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>

      {/* Archive Link */}
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <Link href="/arc3/archive">
            <Button variant="ghost" className="text-slate-400 hover:text-slate-300">
              <Archive className="w-4 h-4 mr-2" />
              View Original ARC3 Preview Games
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
=======
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
      {/* Compact header bar */}
      <header className="border-b border-zinc-800 bg-zinc-900/80">
        <div className="max-w-7xl mx-auto px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-semibold tracking-tight">ARC3 Community Games</span>
            <span className="text-xs text-zinc-500">by ARC Explainer</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
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

      <div className="max-w-7xl mx-auto px-3 py-4">
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
>>>>>>> C:/Users/markb/.windsurf/worktrees/arc-explainer/arc-explainer-55ac97c0/client/src/pages/arc3-community/CommunityLanding.tsx
