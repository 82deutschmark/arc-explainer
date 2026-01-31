/*
 * Author: Cascade (Claude)
 * Date: 2026-01-31
 * PURPOSE: Game upload page for submitting community games. Includes form validation,
 *          source code validation, and submission handling.
 * SRP/DRY check: Pass — single-purpose upload form component.
 */

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  ArrowLeft, 
  Upload,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  FileCode,
  BookOpen
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    hasBaseGameClass: boolean;
    className: string | null;
    importedModules: string[];
    estimatedComplexity: string;
  };
}

interface UploadResponse {
  success: boolean;
  data?: {
    game: { gameId: string };
    message: string;
  };
  error?: string;
  message?: string;
}

export default function GameUploadPage() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    gameId: '',
    displayName: '',
    description: '',
    authorName: '',
    authorEmail: '',
    difficulty: 'unknown',
    tags: '',
    sourceCode: '',
  });
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [gameIdAvailable, setGameIdAvailable] = useState<boolean | null>(null);

  // Validate source code
  const validateMutation = useMutation({
    mutationFn: async (sourceCode: string) => {
      const response = await apiRequest("POST", "/api/arc3-community/validate", { sourceCode });
      return response.json() as Promise<{ success: boolean; data: ValidationResult }>;
    },
    onSuccess: (data) => {
      if (data.success) {
        setValidationResult(data.data);
      }
    },
  });

  // Check game ID availability
  const checkGameIdMutation = useMutation({
    mutationFn: async (gameId: string) => {
      const response = await apiRequest("GET", `/api/arc3-community/check-id/${gameId}`);
      return response.json() as Promise<{ success: boolean; data: { available: boolean; reason?: string } }>;
    },
    onSuccess: (data) => {
      setGameIdAvailable(data.data?.available || false);
    },
  });

  // Upload game
  const uploadMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...formData,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      };
      const response = await apiRequest("POST", "/api/arc3-community/games", payload);
      return response.json() as Promise<UploadResponse>;
    },
    onSuccess: (data) => {
      if (data.success && data.data) {
        setLocation(`/arc3/gallery`);
      }
    },
  });

  const handleValidate = () => {
    if (formData.sourceCode.length < 100) {
      setValidationResult({
        isValid: false,
        errors: ['Source code must be at least 100 characters'],
        warnings: [],
      });
      return;
    }
    setIsValidating(true);
    validateMutation.mutate(formData.sourceCode);
    setIsValidating(false);
  };

  const handleGameIdChange = (value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    setFormData(prev => ({ ...prev, gameId: sanitized }));
    setGameIdAvailable(null);
    if (sanitized.length >= 3) {
      checkGameIdMutation.mutate(sanitized);
    }
  };

  const canSubmit = 
    formData.gameId.length >= 3 &&
    formData.displayName.length >= 3 &&
    formData.authorName.length >= 2 &&
    formData.sourceCode.length >= 100 &&
    validationResult?.isValid &&
    gameIdAvailable;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/arc3">
            <Button variant="ghost" size="icon" className="text-slate-400">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <Upload className="w-8 h-8 text-purple-400" />
              Upload Your Game
            </h1>
            <p className="text-slate-400">
              Share your ARCEngine creation with the community
            </p>
          </div>
        </div>

        {uploadMutation.isSuccess && (
          <Alert className="mb-6 bg-green-900/50 border-green-700">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <AlertTitle className="text-green-300">Success!</AlertTitle>
            <AlertDescription className="text-green-400">
              Your game has been uploaded and is pending review.
            </AlertDescription>
          </Alert>
        )}

        {uploadMutation.isError && (
          <Alert className="mb-6 bg-red-900/50 border-red-700">
            <XCircle className="w-4 h-4 text-red-400" />
            <AlertTitle className="text-red-300">Upload Failed</AlertTitle>
            <AlertDescription className="text-red-400">
              {(uploadMutation.error as Error)?.message || 'Failed to upload game'}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Game Details</CardTitle>
                <CardDescription>Basic information about your game</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gameId" className="text-slate-300">
                      Game ID *
                    </Label>
                    <div className="relative">
                      <Input
                        id="gameId"
                        value={formData.gameId}
                        onChange={(e) => handleGameIdChange(e.target.value)}
                        placeholder="my-puzzle-game"
                        className="bg-slate-900 border-slate-600 text-white"
                      />
                      {gameIdAvailable !== null && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {gameIdAvailable ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400" />
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      Lowercase letters, numbers, dashes only
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="displayName" className="text-slate-300">
                      Display Name *
                    </Label>
                    <Input
                      id="displayName"
                      value={formData.displayName}
                      onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                      placeholder="My Puzzle Game"
                      className="bg-slate-900 border-slate-600 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-slate-300">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your game and how to play it..."
                    className="bg-slate-900 border-slate-600 text-white min-h-[100px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="authorName" className="text-slate-300">
                      Author Name *
                    </Label>
                    <Input
                      id="authorName"
                      value={formData.authorName}
                      onChange={(e) => setFormData(prev => ({ ...prev, authorName: e.target.value }))}
                      placeholder="Your name"
                      className="bg-slate-900 border-slate-600 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="authorEmail" className="text-slate-300">
                      Email (optional)
                    </Label>
                    <Input
                      id="authorEmail"
                      type="email"
                      value={formData.authorEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, authorEmail: e.target.value }))}
                      placeholder="you@example.com"
                      className="bg-slate-900 border-slate-600 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Difficulty</Label>
                    <Select 
                      value={formData.difficulty} 
                      onValueChange={(v) => setFormData(prev => ({ ...prev, difficulty: v }))}
                    >
                      <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                        <SelectItem value="very-hard">Very Hard</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tags" className="text-slate-300">
                      Tags (comma-separated)
                    </Label>
                    <Input
                      id="tags"
                      value={formData.tags}
                      onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                      placeholder="puzzle, pattern, logic"
                      className="bg-slate-900 border-slate-600 text-white"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-cyan-400" />
                  Source Code
                </CardTitle>
                <CardDescription>
                  Paste your ARCEngine Python game code below
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={formData.sourceCode}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, sourceCode: e.target.value }));
                    setValidationResult(null);
                  }}
                  placeholder={`from arcengine import ARCBaseGame, ActionInput, GameAction

class MyPuzzleGame(ARCBaseGame):
    game_id = "my-puzzle-game"
    
    def __init__(self):
        super().__init__()
        # Initialize your game here
        ...`}
                  className="bg-slate-900 border-slate-600 text-white font-mono min-h-[300px]"
                />

                <div className="flex items-center gap-4">
                  <Button
                    onClick={handleValidate}
                    disabled={formData.sourceCode.length < 100 || validateMutation.isPending}
                    variant="outline"
                  >
                    {validateMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Validate Code
                      </>
                    )}
                  </Button>
                  <span className="text-sm text-slate-500">
                    {formData.sourceCode.length} characters
                  </span>
                </div>

                {validationResult && (
                  <Alert className={validationResult.isValid ? 'bg-green-900/50 border-green-700' : 'bg-red-900/50 border-red-700'}>
                    {validationResult.isValid ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <AlertTitle className={validationResult.isValid ? 'text-green-300' : 'text-red-300'}>
                      {validationResult.isValid ? 'Validation Passed' : 'Validation Failed'}
                    </AlertTitle>
                    <AlertDescription>
                      {validationResult.errors.length > 0 && (
                        <ul className="text-red-400 text-sm mt-2 space-y-1">
                          {validationResult.errors.map((err, i) => (
                            <li key={i}>• {err}</li>
                          ))}
                        </ul>
                      )}
                      {validationResult.warnings.length > 0 && (
                        <ul className="text-yellow-400 text-sm mt-2 space-y-1">
                          {validationResult.warnings.map((warn, i) => (
                            <li key={i}>• {warn}</li>
                          ))}
                        </ul>
                      )}
                      {validationResult.metadata && (
                        <div className="mt-2 text-slate-400 text-sm">
                          Class: {validationResult.metadata.className || 'Unknown'} · 
                          Complexity: {validationResult.metadata.estimatedComplexity}
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button
              onClick={() => uploadMutation.mutate()}
              disabled={!canSubmit || uploadMutation.isPending}
              className="w-full bg-purple-600 hover:bg-purple-700"
              size="lg"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  Upload Game
                </>
              )}
            </Button>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">Requirements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle className={`w-4 h-4 mt-0.5 ${formData.gameId.length >= 3 ? 'text-green-400' : 'text-slate-600'}`} />
                  <span className="text-slate-300">Game ID (3+ chars)</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className={`w-4 h-4 mt-0.5 ${gameIdAvailable ? 'text-green-400' : 'text-slate-600'}`} />
                  <span className="text-slate-300">Unique game ID</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className={`w-4 h-4 mt-0.5 ${formData.displayName.length >= 3 ? 'text-green-400' : 'text-slate-600'}`} />
                  <span className="text-slate-300">Display name</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className={`w-4 h-4 mt-0.5 ${formData.authorName.length >= 2 ? 'text-green-400' : 'text-slate-600'}`} />
                  <span className="text-slate-300">Author name</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className={`w-4 h-4 mt-0.5 ${validationResult?.isValid ? 'text-green-400' : 'text-slate-600'}`} />
                  <span className="text-slate-300">Valid source code</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-green-400" />
                  Need Help?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-400 mb-4">
                  Check out the ARCEngine documentation to learn how to create games.
                </p>
                <Link href="/arc3/docs">
                  <Button variant="outline" className="w-full">
                    View Documentation
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="bg-yellow-900/30 border-yellow-700/50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-yellow-300">
                    Games are reviewed before becoming publicly visible. 
                    Please ensure your code follows the community guidelines.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
