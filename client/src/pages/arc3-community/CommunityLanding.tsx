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
