/*
 * Author: Cascade (Claude)
 * Date: 2026-01-31
 * PURPOSE: Documentation page for creating ARCEngine games. Provides comprehensive
 *          guide on game development, the ARCEngine API, and best practices.
 * SRP/DRY check: Pass — single-purpose documentation component.
 */

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  BookOpen, 
  Code, 
  Gamepad2,
  Layers,
  Zap,
  FileCode,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Terminal
} from "lucide-react";

export default function GameCreationDocs() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      {/* Compact header bar */}
      <header className="border-b border-zinc-800 bg-zinc-900/80">
        <div className="max-w-5xl mx-auto px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/arc3">
              <Button variant="ghost" size="sm" className="h-6 px-2 text-zinc-400 hover:text-zinc-100">
                <ArrowLeft className="w-3 h-3 mr-1" />
                Back
              </Button>
            </Link>
            <span className="text-zinc-700">|</span>
            <Terminal className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-semibold">Game Creation Docs</span>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-3 py-4">

        <Tabs defaultValue="quickstart" className="space-y-4">
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="quickstart">Quick Start</TabsTrigger>
            <TabsTrigger value="concepts">Core Concepts</TabsTrigger>
            <TabsTrigger value="api">API Reference</TabsTrigger>
            <TabsTrigger value="examples">Examples</TabsTrigger>
          </TabsList>

          {/* Quick Start Tab */}
          <TabsContent value="quickstart" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  Quick Start Guide
                </CardTitle>
                <CardDescription>
                  Get your first game running in 5 minutes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">1. Basic Game Structure</h3>
                  <pre className="bg-slate-900 p-4 rounded-lg overflow-x-auto text-sm">
                    <code className="text-green-400">{`from arcengine import ARCBaseGame, Camera, Level, Sprite, GameAction

class MyPuzzleGame(ARCBaseGame):
    """Your game description here."""
    
    def __init__(self):
        camera = Camera(background=0, letter_box=1)
        levels = [self._create_level_1()]
        super().__init__(
            game_id="my-puzzle-game",
            levels=levels,
            camera=camera
        )
    
    def _create_level_1(self) -> Level:
        player = Sprite(name="player", x=5, y=5, grid=[[3]])
        goal = Sprite(name="goal", x=8, y=8, grid=[[4]])
        return Level(sprites=[player, goal], grid_size=(10, 10))
    
    def step(self):
        # Handle player input
        player = self.current_level.get_sprites_by_name("player")[0]
        
        if self.action.id == GameAction.ACTION1:  # Up
            player.move(0, -1)
        elif self.action.id == GameAction.ACTION2:  # Down
            player.move(0, 1)
        elif self.action.id == GameAction.ACTION3:  # Left
            player.move(-1, 0)
        elif self.action.id == GameAction.ACTION4:  # Right
            player.move(1, 0)
        
        # Check win condition
        goal = self.current_level.get_sprites_by_name("goal")[0]
        if player.collides_with(goal):
            self.win()
        
        self.complete_action()`}</code>
                  </pre>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">2. Key Components</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-900 p-4 rounded-lg">
                      <h4 className="text-cyan-400 font-medium mb-2">ARCBaseGame</h4>
                      <p className="text-slate-300 text-sm">
                        Base class for all games. Provides game loop, level management, and state handling.
                      </p>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-lg">
                      <h4 className="text-cyan-400 font-medium mb-2">Sprite</h4>
                      <p className="text-slate-300 text-sm">
                        Visual elements on the grid. Can be moved, tagged, and checked for collisions.
                      </p>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-lg">
                      <h4 className="text-cyan-400 font-medium mb-2">Level</h4>
                      <p className="text-slate-300 text-sm">
                        Contains sprites and grid configuration. Games can have multiple levels.
                      </p>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-lg">
                      <h4 className="text-cyan-400 font-medium mb-2">Camera</h4>
                      <p className="text-slate-300 text-sm">
                        Controls rendering: background color, letterboxing, and viewport.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">3. Game Actions</h3>
                  <div className="bg-slate-900 p-4 rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-700">
                          <th className="text-left py-2">Action</th>
                          <th className="text-left py-2">Default Meaning</th>
                          <th className="text-left py-2">Keyboard</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-300">
                        <tr className="border-b border-slate-800">
                          <td className="py-2"><code>ACTION1</code></td>
                          <td>Up / Primary</td>
                          <td>Arrow Up, W</td>
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="py-2"><code>ACTION2</code></td>
                          <td>Down</td>
                          <td>Arrow Down, S</td>
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="py-2"><code>ACTION3</code></td>
                          <td>Left</td>
                          <td>Arrow Left, A</td>
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="py-2"><code>ACTION4</code></td>
                          <td>Right</td>
                          <td>Arrow Right, D</td>
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="py-2"><code>ACTION5</code></td>
                          <td>Confirm / Action</td>
                          <td>Space, Enter</td>
                        </tr>
                        <tr className="border-b border-slate-800">
                          <td className="py-2"><code>ACTION6</code></td>
                          <td>Click (with coordinates)</td>
                          <td>Mouse Click</td>
                        </tr>
                        <tr>
                          <td className="py-2"><code>RESET</code></td>
                          <td>Reset level</td>
                          <td>R</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Core Concepts Tab */}
          <TabsContent value="concepts" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-purple-400" />
                  Core Concepts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">The Game Loop</h3>
                  <p className="text-slate-300 mb-4">
                    ARCEngine games are turn-based. Each player action triggers one call to your{" "}
                    <code className="text-cyan-400">step()</code> method:
                  </p>
                  <ol className="list-decimal list-inside text-slate-300 space-y-2">
                    <li>Player performs an action (keyboard or click)</li>
                    <li>Engine calls your <code className="text-cyan-400">step()</code> method</li>
                    <li>You update game state based on <code className="text-cyan-400">self.action</code></li>
                    <li>You call <code className="text-cyan-400">self.complete_action()</code></li>
                    <li>Engine renders the new frame</li>
                  </ol>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Sprites and Collision</h3>
                  <pre className="bg-slate-900 p-4 rounded-lg overflow-x-auto text-sm mb-4">
                    <code className="text-green-400">{`# Create a sprite with a 2x2 grid pattern
wall = Sprite(
    name="wall",
    x=3, y=3,
    grid=[[5, 5], [5, 5]],  # 5 = gray color
    tags=["solid", "obstacle"]
)

# Check collision
if player.collides_with(wall):
    # Handle collision
    pass

# Get sprites by tag
obstacles = level.get_sprites_by_tag("obstacle")
for obs in obstacles:
    if player.collides_with(obs):
        player.move(-dx, -dy)  # Undo movement`}</code>
                  </pre>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Win/Lose Conditions</h3>
                  <pre className="bg-slate-900 p-4 rounded-lg overflow-x-auto text-sm">
                    <code className="text-green-400">{`# Win the game
self.win()

# Lose the game  
self.lose()

# Advance to next level
if self.is_last_level():
    self.win()
else:
    self.next_level()`}</code>
                  </pre>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">ARC3 Color Palette (0-15)</h3>
                  <p className="text-slate-400 text-sm mb-3">
                    ARC3 uses a 16-color palette. Import from <code className="text-cyan-400">@shared/config/arc3Colors</code> for consistency.
                  </p>
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                    {[
                      { num: 0, name: 'White', color: '#FFFFFF' },
                      { num: 1, name: 'Light Gray', color: '#CCCCCC' },
                      { num: 2, name: 'Gray', color: '#999999' },
                      { num: 3, name: 'Dark Gray', color: '#666666' },
                      { num: 4, name: 'Darker Gray', color: '#333333' },
                      { num: 5, name: 'Black', color: '#000000' },
                      { num: 6, name: 'Pink', color: '#E53AA3' },
                      { num: 7, name: 'Light Pink', color: '#FF7BCC' },
                      { num: 8, name: 'Red', color: '#F93C31' },
                      { num: 9, name: 'Blue', color: '#1E93FF' },
                      { num: 10, name: 'Light Blue', color: '#88D8F1' },
                      { num: 11, name: 'Yellow', color: '#FFDC00' },
                      { num: 12, name: 'Orange', color: '#FF851B' },
                      { num: 13, name: 'Dark Red', color: '#921231' },
                      { num: 14, name: 'Green', color: '#4FCC30' },
                      { num: 15, name: 'Purple', color: '#A356D0' },
                    ].map(({ num, name, color }) => (
                      <div key={num} className="flex flex-col items-center bg-slate-900 p-2 rounded">
                        <div 
                          className="w-8 h-8 rounded border border-slate-600 mb-1" 
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-slate-300 text-xs font-mono">{num}</span>
                        <span className="text-slate-500 text-[10px] truncate w-full text-center">{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Reference Tab */}
          <TabsContent value="api" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Code className="w-5 h-5 text-cyan-400" />
                  API Reference
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-cyan-400 mb-3">ARCBaseGame</h3>
                  <div className="space-y-4">
                    <div className="bg-slate-900 p-4 rounded-lg">
                      <code className="text-yellow-400">__init__(game_id, levels, camera)</code>
                      <p className="text-slate-400 text-sm mt-1">Initialize the game with ID, levels list, and camera settings.</p>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-lg">
                      <code className="text-yellow-400">step() → None</code>
                      <p className="text-slate-400 text-sm mt-1">Override this method to implement your game logic. Called once per player action.</p>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-lg">
                      <code className="text-yellow-400">complete_action() → None</code>
                      <p className="text-slate-400 text-sm mt-1">Must be called at the end of step() to signal the action is complete.</p>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-lg">
                      <code className="text-yellow-400">win() / lose() → None</code>
                      <p className="text-slate-400 text-sm mt-1">End the game with a win or loss.</p>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-lg">
                      <code className="text-yellow-400">next_level() → None</code>
                      <p className="text-slate-400 text-sm mt-1">Advance to the next level.</p>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-lg">
                      <code className="text-yellow-400">is_last_level() → bool</code>
                      <p className="text-slate-400 text-sm mt-1">Returns True if current level is the last one.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-cyan-400 mb-3">Sprite</h3>
                  <div className="space-y-4">
                    <div className="bg-slate-900 p-4 rounded-lg">
                      <code className="text-yellow-400">Sprite(name, x, y, grid, tags=[])</code>
                      <p className="text-slate-400 text-sm mt-1">Create a sprite at position (x, y) with a 2D grid of colors.</p>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-lg">
                      <code className="text-yellow-400">move(dx, dy) → None</code>
                      <p className="text-slate-400 text-sm mt-1">Move the sprite by (dx, dy) cells.</p>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-lg">
                      <code className="text-yellow-400">collides_with(other) → bool</code>
                      <p className="text-slate-400 text-sm mt-1">Check if this sprite overlaps with another sprite.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-cyan-400 mb-3">Level</h3>
                  <div className="space-y-4">
                    <div className="bg-slate-900 p-4 rounded-lg">
                      <code className="text-yellow-400">Level(sprites, grid_size, data={})</code>
                      <p className="text-slate-400 text-sm mt-1">Create a level with sprites and grid dimensions.</p>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-lg">
                      <code className="text-yellow-400">get_sprites_by_name(name) → list[Sprite]</code>
                      <p className="text-slate-400 text-sm mt-1">Find all sprites with the given name.</p>
                    </div>
                    <div className="bg-slate-900 p-4 rounded-lg">
                      <code className="text-yellow-400">get_sprites_by_tag(tag) → list[Sprite]</code>
                      <p className="text-slate-400 text-sm mt-1">Find all sprites with the given tag.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Examples Tab */}
          <TabsContent value="examples" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5 text-green-400" />
                  Featured Community Games
                </CardTitle>
                <CardDescription>
                  Study these featured community games to learn best practices
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-900 p-6 rounded-lg">
                    <h3 className="text-xl font-semibold text-white mb-2">World Shifter</h3>
                    <Badge className="mb-3">v0.0.1</Badge>
                    <p className="text-slate-300 text-sm mb-4">
                      The world moves, not you. A puzzle game where player input moves the entire 
                      world in the opposite direction.
                    </p>
                    <div className="space-y-2 text-sm text-slate-400">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        Inverse movement mechanics
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        Collision detection with walls
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        Multiple levels with progression
                      </div>
                    </div>
                    <Link href="/arc3/play/world_shifter">
                      <Button className="mt-4 w-full">Play World Shifter</Button>
                    </Link>
                  </div>

                  <div className="bg-slate-900 p-6 rounded-lg">
                    <h3 className="text-xl font-semibold text-white mb-2">Chain Reaction</h3>
                    <Badge variant="secondary" className="mb-3">v0.0.1</Badge>
                    <p className="text-slate-300 text-sm mb-4">
                      Match colors. Clear the board. Escape. A Sokoban-style puzzle with 
                      color matching mechanics.
                    </p>
                    <div className="space-y-2 text-sm text-slate-400">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        Still in development
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        Color matching mechanics
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        Block pushing
                      </div>
                    </div>
                    <Link href="/arc3/play/chain_reaction">
                      <Button variant="secondary" className="mt-4 w-full">Try Chain Reaction</Button>
                    </Link>
                  </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-3">
                    <FileCode className="w-5 h-5 inline mr-2 text-cyan-400" />
                    View Source Code
                  </h3>
                  <p className="text-slate-300 text-sm mb-4">
                    These featured community games are open source. Study the code to learn 
                    best practices for your own games.
                  </p>
                  <p className="text-slate-500 text-xs">
                    Source code available in the external/ARCEngine/games directory.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Ready to Create?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300 mb-4">
                  Now that you understand the basics, create your own game and share it with the community!
                </p>
                <Link href="/arc3/upload">
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    Upload Your Game
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
