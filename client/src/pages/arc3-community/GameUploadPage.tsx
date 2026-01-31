/*
Author: GPT-5.2
Date: 2026-01-31
PURPOSE: ARC3 Studio upload page for Python developers to submit ARCEngine games. Provides a
         legible, ARC3-palette-locked (client/src/utils/arc3Colors.ts) pixel UI, clear expectations
         about what is being uploaded, validation before submission, and a review/publish note.
         Removes hard-coded editorial fields (difficulty) from the submission UI.
SRP/DRY check: Pass — focuses on upload UX; shared styling lives in Arc3PixelUI.tsx.
*/

import { useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Upload, Loader2, CheckCircle, XCircle, AlertTriangle, Github, ExternalLink, BookOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';
import { Arc3PixelPage, PixelButton, PixelPanel, SpriteMosaic } from '@/components/arc3-community/Arc3PixelUI';

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

const ARCENGINE_REPO_URL = 'https://github.com/arcprize/ARCEngine';

export default function GameUploadPage() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    gameId: '',
    displayName: '',
    description: '',
    authorName: '',
    authorEmail: '',
    tags: '',
    sourceCode: '',
  });
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [gameIdAvailable, setGameIdAvailable] = useState<boolean | null>(null);

  const inputClassName =
    'bg-[var(--arc3-bg-soft)] border-2 border-[var(--arc3-border)] text-[var(--arc3-text)] placeholder:text-[var(--arc3-dim)]';

  const validateMutation = useMutation({
    mutationFn: async (sourceCode: string) => {
      const response = await apiRequest('POST', '/api/arc3-community/validate', { sourceCode });
      return response.json() as Promise<{ success: boolean; data: ValidationResult }>;
    },
    onSuccess: (data) => {
      if (data.success) setValidationResult(data.data);
    },
  });

  const checkGameIdMutation = useMutation({
    mutationFn: async (gameId: string) => {
      const response = await apiRequest('GET', `/api/arc3-community/check-id/${gameId}`);
      return response.json() as Promise<{ success: boolean; data: { available: boolean; reason?: string } }>;
    },
    onSuccess: (data) => {
      setGameIdAvailable(Boolean(data.data?.available));
    },
    onError: () => setGameIdAvailable(false),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...formData,
        tags: formData.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };
      const response = await apiRequest('POST', '/api/arc3-community/games', payload);
      return response.json() as Promise<UploadResponse>;
    },
    onSuccess: (data) => {
      if (data.success && data.data) setLocation('/arc3/gallery');
    },
  });

  const handleValidate = () => {
    if (formData.sourceCode.trim().length < 100) {
      setValidationResult({
        isValid: false,
        errors: ['Source code must be at least 100 characters.'],
        warnings: [],
      });
      return;
    }
    validateMutation.mutate(formData.sourceCode);
  };

  const handleGameIdChange = (value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    setFormData((prev) => ({ ...prev, gameId: sanitized }));
    setGameIdAvailable(null);
    if (sanitized.length >= 3) checkGameIdMutation.mutate(sanitized);
  };

  const canSubmit =
    formData.gameId.length >= 3 &&
    formData.displayName.length >= 3 &&
    formData.authorName.length >= 2 &&
    formData.sourceCode.trim().length >= 100 &&
    Boolean(validationResult?.isValid) &&
    Boolean(gameIdAvailable) &&
    !uploadMutation.isPending;

  const requirementRows = useMemo(() => {
    const ok = 'var(--arc3-c14)';
    const off = 'var(--arc3-dim)';
    return [
      { label: 'Game ID (3+ chars)', ok: formData.gameId.length >= 3, okColor: ok, offColor: off },
      { label: 'Unique game ID', ok: Boolean(gameIdAvailable), okColor: ok, offColor: off },
      { label: 'Display name', ok: formData.displayName.length >= 3, okColor: ok, offColor: off },
      { label: 'Author name', ok: formData.authorName.length >= 2, okColor: ok, offColor: off },
      { label: 'Valid source code', ok: Boolean(validationResult?.isValid), okColor: ok, offColor: off },
    ];
  }, [formData.authorName.length, formData.displayName.length, formData.gameId.length, gameIdAvailable, validationResult?.isValid]);

  return (
    <Arc3PixelPage>
      {/* Header */}
      <header className="border-b-2 border-[var(--arc3-border)] bg-[var(--arc3-bg-soft)]">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/arc3" className="shrink-0">
              <span className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold border-2 border-[var(--arc3-border)] bg-[var(--arc3-c3)] text-[var(--arc3-c0)]">
                <ArrowLeft className="w-4 h-4" />
                Back
              </span>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-[var(--arc3-c15)]" />
                <h1 className="text-base font-semibold tracking-tight">Upload your ARCEngine game</h1>
              </div>
              <p className="text-[11px] text-[var(--arc3-dim)] leading-snug">
                ARC3 Studio submission: Python source, validated first, then reviewed before publish.
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <a
              href={ARCENGINE_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold border-2 border-[var(--arc3-border)] bg-[var(--arc3-c3)] text-[var(--arc3-c0)]"
              title="Open ARCEngine repository"
            >
              <Github className="w-4 h-4" />
              ARCEngine
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>
            <PixelButton tone="blue" onClick={() => setLocation('/arc3/docs')}>
              <BookOpen className="w-4 h-4" />
              Creator Docs
            </PixelButton>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            <PixelPanel
              tone="yellow"
              title="Submission checklist (Python dev friendly)"
              subtitle="Keep it simple: one game class, clear ID, no secrets."
              rightSlot={<SpriteMosaic seed={19} width={10} height={3} className="w-20" />}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)] p-3">
                  <p className="text-xs font-semibold mb-1">What you submit</p>
                  <div className="text-[11px] text-[var(--arc3-muted)] leading-snug space-y-1">
                    <div className="flex gap-2">
                      <span className="text-[var(--arc3-c11)] font-semibold">-</span>
                      <span>Python source for an ARCEngine game (subclass ARCBaseGame).</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[var(--arc3-c11)] font-semibold">-</span>
                      <span>Implement step() and call complete_action().</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[var(--arc3-c11)] font-semibold">-</span>
                      <span>Keep it deterministic and self-contained.</span>
                    </div>
                  </div>
                </div>
                <div className="border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)] p-3">
                  <p className="text-xs font-semibold mb-1">What happens after upload</p>
                  <div className="text-[11px] text-[var(--arc3-muted)] leading-snug space-y-1">
                    <div className="flex gap-2">
                      <span className="text-[var(--arc3-c11)] font-semibold">-</span>
                      <span>We validate the code (basic structural checks).</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[var(--arc3-c11)] font-semibold">-</span>
                      <span>Uploads are reviewed before becoming publicly visible.</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[var(--arc3-c11)] font-semibold">-</span>
                      <span>Once published, your game appears in the community gallery.</span>
                    </div>
                  </div>
                </div>
              </div>
            </PixelPanel>

            <PixelPanel tone="purple" title="Game details">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gameId" className="text-xs text-[var(--arc3-muted)]">
                    Game ID (required)
                  </Label>
                  <div className="relative">
                    <Input
                      id="gameId"
                      value={formData.gameId}
                      onChange={(e) => handleGameIdChange(e.target.value)}
                      placeholder="my-puzzle-game"
                      className={inputClassName}
                    />
                    {gameIdAvailable !== null && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        {gameIdAvailable ? (
                          <CheckCircle className="w-4 h-4" style={{ color: 'var(--arc3-c14)' }} />
                        ) : (
                          <XCircle className="w-4 h-4" style={{ color: 'var(--arc3-c8)' }} />
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--arc3-dim)]">Lowercase letters, numbers, dashes, underscores.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayName" className="text-xs text-[var(--arc3-muted)]">
                    Display name (required)
                  </Label>
                  <Input
                    id="displayName"
                    value={formData.displayName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, displayName: e.target.value }))}
                    placeholder="My Puzzle Game"
                    className={inputClassName}
                  />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label htmlFor="description" className="text-xs text-[var(--arc3-muted)]">
                  Description (optional)
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Explain what the player is trying to do and what actions matter."
                  className={inputClassName}
                />
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="authorName" className="text-xs text-[var(--arc3-muted)]">
                    Author name (required)
                  </Label>
                  <Input
                    id="authorName"
                    value={formData.authorName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, authorName: e.target.value }))}
                    placeholder="Your name"
                    className={inputClassName}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="authorEmail" className="text-xs text-[var(--arc3-muted)]">
                    Email (optional)
                  </Label>
                  <Input
                    id="authorEmail"
                    type="email"
                    value={formData.authorEmail}
                    onChange={(e) => setFormData((prev) => ({ ...prev, authorEmail: e.target.value }))}
                    placeholder="you@example.com"
                    className={inputClassName}
                  />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label htmlFor="tags" className="text-xs text-[var(--arc3-muted)]">
                  Tags (comma-separated, optional)
                </Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))}
                  placeholder="puzzle, sprite, logic"
                  className={inputClassName}
                />
              </div>
            </PixelPanel>

            <PixelPanel tone="blue" title="Source code" subtitle="Paste your ARCEngine Python game code below.">
              <Textarea
                value={formData.sourceCode}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, sourceCode: e.target.value }));
                  setValidationResult(null);
                }}
                placeholder={`from arcengine import ARCBaseGame, GameAction

class MyPuzzleGame(ARCBaseGame):
    game_id = "my-puzzle-game"

    def __init__(self):
        super().__init__()
        # Set up levels, sprites, camera, etc.

    def step(self):
        # Read self.action and update state
        # Then call self.complete_action()
        self.complete_action()
`}
                className={`${inputClassName} font-mono min-h-[320px]`}
              />

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <PixelButton
                  tone="yellow"
                  onClick={handleValidate}
                  disabled={formData.sourceCode.trim().length < 100 || validateMutation.isPending}
                  title="Run server-side validation"
                >
                  {validateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Validating…
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Validate code
                    </>
                  )}
                </PixelButton>
                <div className="text-[11px] text-[var(--arc3-dim)]">{formData.sourceCode.length} characters</div>
              </div>

              {validationResult && (
                <div className="mt-3">
                  <PixelPanel
                    tone={validationResult.isValid ? 'green' : 'danger'}
                    title={validationResult.isValid ? 'Validation passed' : 'Validation failed'}
                    subtitle={
                      validationResult.isValid
                        ? 'Looks structurally OK. Upload still requires review before publish.'
                        : 'Fix the issues below, then validate again.'
                    }
                  >
                    {validationResult.errors.length > 0 && (
                      <div className="text-[11px] text-[var(--arc3-muted)] leading-snug">
                        <p className="text-xs font-semibold mb-1">Errors</p>
                        <div className="space-y-1">
                          {validationResult.errors.map((err) => (
                            <div key={err} className="flex gap-2">
                              <span className="text-[var(--arc3-c8)] font-semibold">-</span>
                              <span>{err}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {validationResult.warnings.length > 0 && (
                      <div className="mt-3 text-[11px] text-[var(--arc3-muted)] leading-snug">
                        <p className="text-xs font-semibold mb-1">Warnings</p>
                        <div className="space-y-1">
                          {validationResult.warnings.map((warn) => (
                            <div key={warn} className="flex gap-2">
                              <span className="text-[var(--arc3-c11)] font-semibold">-</span>
                              <span>{warn}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {validationResult.metadata && (
                      <div className="mt-3 text-[11px] text-[var(--arc3-dim)]">
                        Class:{' '}
                        <span className="font-semibold text-[var(--arc3-text)]">
                          {validationResult.metadata.className || 'Unknown'}
                        </span>{' '}
                        | Complexity:{' '}
                        <span className="font-semibold text-[var(--arc3-text)]">
                          {validationResult.metadata.estimatedComplexity}
                        </span>
                      </div>
                    )}
                  </PixelPanel>
                </div>
              )}
            </PixelPanel>

            <PixelButton
              tone="green"
              onClick={() => uploadMutation.mutate()}
              disabled={!canSubmit}
              className="w-full py-3 text-sm"
              title="Upload your game for review"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Upload game
                </>
              )}
            </PixelButton>

            {uploadMutation.isError && (
              <PixelPanel tone="danger" title="Upload failed">
                <div className="text-[11px] text-[var(--arc3-muted)]">
                  {(uploadMutation.error as Error)?.message || 'Failed to upload game.'}
                </div>
              </PixelPanel>
            )}
          </div>

          <aside className="lg:col-span-4 space-y-4">
            <PixelPanel tone="neutral" title="Requirements">
              <div className="space-y-2">
                {requirementRows.map((row) => (
                  <div key={row.label} className="flex items-start gap-2">
                    <CheckCircle
                      className="w-4 h-4 mt-0.5"
                      style={{ color: row.ok ? row.okColor : row.offColor }}
                    />
                    <div className="text-[11px] text-[var(--arc3-muted)]">{row.label}</div>
                  </div>
                ))}
              </div>
            </PixelPanel>

            <PixelPanel
              tone="blue"
              title="Need help?"
              subtitle="Use the in-repo design docs and examples to match the engine’s conventions."
            >
              <div className="space-y-2">
                <PixelButton tone="blue" onClick={() => setLocation('/arc3/docs')} className="w-full">
                  <BookOpen className="w-4 h-4" />
                  Open creator docs
                </PixelButton>
                <a
                  href={ARCENGINE_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold border-2 border-[var(--arc3-border)] bg-[var(--arc3-c3)] text-[var(--arc3-c0)]"
                >
                  <Github className="w-4 h-4" />
                  ARCEngine repository
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>
              </div>
            </PixelPanel>

            <PixelPanel tone="orange" title="Review note">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5" style={{ color: 'var(--arc3-c11)' }} />
                <p className="text-[11px] text-[var(--arc3-muted)] leading-snug">
                  Games are reviewed before becoming publicly visible. Do not include secrets or private keys in source
                  code.
                </p>
              </div>
            </PixelPanel>
          </aside>
        </div>
      </main>
    </Arc3PixelPage>
  );
}

