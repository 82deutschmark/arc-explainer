/*
 * Author: Cascade (Claude)
 * Date: 2026-01-31
 * PURPOSE: Gallery page for browsing community games with filtering and search.
 * SRP/DRY check: Pass — single-purpose game gallery component.
 */

import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search, 
  Gamepad2, 
  ArrowLeft,
  Filter,
  TrendingUp,
  Clock,
  SortAsc
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
  uploadedAt: string;
}

interface GamesResponse {
  success: boolean;
  data: {
    games: CommunityGame[];
    total: number;
    limit: number;
    offset: number;
  };
}

export default function CommunityGallery() {
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<string>("all");
  const [orderBy, setOrderBy] = useState<string>("playCount");

  // Build query params
  const queryParams = new URLSearchParams();
  if (search) queryParams.set("search", search);
  if (difficulty !== "all") queryParams.set("difficulty", difficulty);
  queryParams.set("orderBy", orderBy);
  queryParams.set("orderDir", "DESC");
  queryParams.set("limit", "24");

  const { data, isLoading } = useQuery<GamesResponse>({
    queryKey: [`/api/arc3-community/games?${queryParams.toString()}`],
  });

  const games = data?.data?.games || [];
  const total = data?.data?.total || 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/arc3">
              <Button variant="ghost" size="icon" className="text-slate-400">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                <Gamepad2 className="w-8 h-8 text-cyan-400" />
                Game Gallery
              </h1>
              <p className="text-slate-400">
                {total} games available
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-slate-800/50 border-slate-700 mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search games..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 bg-slate-900 border-slate-600 text-white"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger className="w-[140px] bg-slate-900 border-slate-600 text-white">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                    <SelectItem value="very-hard">Very Hard</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={orderBy} onValueChange={setOrderBy}>
                  <SelectTrigger className="w-[140px] bg-slate-900 border-slate-600 text-white">
                    <SortAsc className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="playCount">
                      <TrendingUp className="w-4 h-4 mr-2 inline" />
                      Most Played
                    </SelectItem>
                    <SelectItem value="uploadedAt">
                      <Clock className="w-4 h-4 mr-2 inline" />
                      Newest
                    </SelectItem>
                    <SelectItem value="displayName">
                      <SortAsc className="w-4 h-4 mr-2 inline" />
                      Name
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Games Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-slate-400">Loading games...</p>
          </div>
        ) : games.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="py-12 text-center">
              <Gamepad2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No games found</h3>
              <p className="text-slate-400 mb-4">
                {search ? "Try adjusting your search or filters" : "Be the first to upload a game!"}
              </p>
              <Link href="/arc3/upload">
                <Button className="bg-cyan-600 hover:bg-cyan-700">
                  Upload a Game
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {games.map((game) => (
              <Link key={game.gameId} href={`/arc3/play/${game.gameId}`}>
                <Card className="bg-slate-800/50 border-slate-700 hover:border-cyan-500/50 transition-colors cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-white text-lg">{game.displayName}</CardTitle>
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${
                          game.difficulty === 'easy' ? 'bg-green-900 text-green-300' :
                          game.difficulty === 'medium' ? 'bg-yellow-900 text-yellow-300' :
                          game.difficulty === 'hard' ? 'bg-orange-900 text-orange-300' :
                          game.difficulty === 'very-hard' ? 'bg-red-900 text-red-300' :
                          'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {game.difficulty}
                      </Badge>
                    </div>
                    <CardDescription className="text-slate-400">
                      by {game.authorName}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-300 text-sm line-clamp-2 mb-4 min-h-[40px]">
                      {game.description || "No description provided."}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {game.playCount} plays
                      </span>
                      <div className="flex gap-1">
                        {game.tags?.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs border-slate-600">
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
        )}
      </div>
    </div>
  );
}
