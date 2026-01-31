/*
Author: Cascade (Claude Sonnet 4)
Date: 2026-01-31
PURPOSE: ARC3 game submission page where community members can submit their ARCEngine games
         for review. Uses GitHub repo link approach (not paste-your-code) because ARCEngine
         games are multi-file Python projects. Submissions go into a review queue.
SRP/DRY check: Pass — single-purpose submission form; uses shared pixel UI primitives.
*/

import { useState, useMemo } from 'react';
import { useLocation, Link } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { Github, ExternalLink, Send, ArrowLeft, CheckCircle2, AlertCircle, BookOpen, Info } from 'lucide-react';
import { Arc3PixelPage, PixelButton, PixelPanel, SpriteMosaic, PixelLink } from '@/components/arc3-community/Arc3PixelUI';
import { apiRequest } from '@/lib/queryClient';

interface SubmissionData {
  gameId: string;
  displayName: string;
  description: string;
  authorName: string;
  authorEmail: string;
  githubRepoUrl: string;
  notes: string;
}

interface SubmissionResponse {
  success: boolean;
  data?: {
    submissionId: string;
    status: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

const ARCENGINE_REPO_URL = 'https://github.com/arcprize/ARCEngine';
const ARCENGINE_DOCS_URL = 'https://github.com/arcprize/ARCEngine#readme';

// Validate GitHub URL format
function isValidGitHubUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'github.com' && parsed.pathname.split('/').filter(Boolean).length >= 2;
  } catch {
    return false;
  }
}

// Validate game ID format
function isValidGameId(id: string): boolean {
  return /^[a-z][a-z0-9_-]{2,49}$/.test(id);
}

export default function GameSubmissionPage() {
  const [, setLocation] = useLocation();
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const [formData, setFormData] = useState<SubmissionData>({
    gameId: '',
    displayName: '',
    description: '',
    authorName: '',
    authorEmail: '',
    githubRepoUrl: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof SubmissionData, string>>>({});

  const submitMutation = useMutation({
    mutationFn: async (data: SubmissionData) => {
      const response = await apiRequest('POST', '/api/arc3-community/submissions', data);
      return response.json() as Promise<SubmissionResponse>;
    },
    onSuccess: (response) => {
      if (response.success && response.data) {
        setSubmitted(true);
        setSubmissionId(response.data.submissionId);
      }
    },
  });

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof SubmissionData, string>> = {};

    if (!formData.gameId.trim()) {
      newErrors.gameId = 'Game ID is required';
    } else if (!isValidGameId(formData.gameId)) {
      newErrors.gameId = 'Must be 3-50 chars, start with letter, lowercase + numbers + dashes only';
    }

    if (!formData.displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    } else if (formData.displayName.length > 100) {
      newErrors.displayName = 'Display name must be 100 characters or less';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length > 500) {
      newErrors.description = 'Description must be 500 characters or less';
    }

    if (!formData.authorName.trim()) {
      newErrors.authorName = 'Author name is required';
    }

    if (!formData.authorEmail.trim()) {
      newErrors.authorEmail = 'Email is required for review notifications';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.authorEmail)) {
      newErrors.authorEmail = 'Invalid email format';
    }

    if (!formData.githubRepoUrl.trim()) {
      newErrors.githubRepoUrl = 'GitHub repository URL is required';
    } else if (!isValidGitHubUrl(formData.githubRepoUrl)) {
      newErrors.githubRepoUrl = 'Must be a valid GitHub repository URL';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      submitMutation.mutate(formData);
    }
  };

  const handleChange = (field: keyof SubmissionData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const requirements = useMemo(
    () => [
      'Your game must subclass ARCBaseGame from the ARCEngine library',
      'Repository must contain a valid pyproject.toml or setup.py',
      'Main game class must be discoverable (follow ARCEngine conventions)',
      'Games render on a 64×64 grid using the ARC3 color palette (16 colors)',
      'Include a README with game description and win conditions',
    ],
    [],
  );

  // Success state
  if (submitted && submissionId) {
    return (
      <Arc3PixelPage>
        <header className="border-b-2 border-[var(--arc3-border)] bg-[var(--arc3-bg-soft)]">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
            <Link href="/arc3">
              <PixelButton tone="neutral">
                <ArrowLeft className="w-4 h-4" />
                Back to ARC3 Studio
              </PixelButton>
            </Link>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8">
          <PixelPanel tone="green" title="Submission Received" subtitle="Thank you for contributing to the ARC3 community!">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-[var(--arc3-c14)] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">Your game has been submitted for review</p>
                  <p className="text-[11px] text-[var(--arc3-muted)] mt-1">
                    Submission ID: <span className="font-mono">{submissionId}</span>
                  </p>
                </div>
              </div>

              <div className="border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)] p-3 space-y-2">
                <p className="text-xs font-semibold">What happens next?</p>
                <ul className="text-[11px] text-[var(--arc3-muted)] space-y-1">
                  <li>• We'll clone and review your repository for ARCEngine compatibility</li>
                  <li>• If approved, your game will appear in the community gallery</li>
                  <li>• You'll receive an email notification at the address you provided</li>
                  <li>• Review typically takes 1-3 business days</li>
                </ul>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <PixelButton tone="blue" onClick={() => setLocation('/arc3/gallery')}>
                  Browse Gallery
                </PixelButton>
                <PixelButton tone="purple" onClick={() => setLocation('/arc3')}>
                  Return to ARC3 Studio
                </PixelButton>
              </div>
            </div>
          </PixelPanel>
        </main>
      </Arc3PixelPage>
    );
  }

  return (
    <Arc3PixelPage>
      {/* Header */}
      <header className="border-b-2 border-[var(--arc3-border)] bg-[var(--arc3-bg-soft)]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/arc3">
              <PixelButton tone="neutral">
                <ArrowLeft className="w-4 h-4" />
                Back
              </PixelButton>
            </Link>
            <span className="text-[var(--arc3-dim)]">|</span>
            <div>
              <span className="text-sm font-semibold">Submit Your Game</span>
              <span className="text-[11px] text-[var(--arc3-dim)] ml-2">ARC3 Community</span>
            </div>
          </div>

          <nav className="flex items-center gap-2 shrink-0">
            <PixelLink href={ARCENGINE_DOCS_URL} tone="blue" title="ARCEngine Documentation">
              <BookOpen className="w-4 h-4" />
              Docs
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </PixelLink>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-7">
            <form onSubmit={handleSubmit}>
              <PixelPanel
                tone="purple"
                title="Game Submission Form"
                subtitle="Link your GitHub repository for review"
              >
                <div className="space-y-4">
                  {/* GitHub Repo URL - Most important field first */}
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      GitHub Repository URL <span className="text-[var(--arc3-c8)]">*</span>
                    </label>
                    <div className="flex gap-2">
                      <Github className="w-5 h-5 text-[var(--arc3-dim)] shrink-0 mt-2" />
                      <div className="flex-1">
                        <input
                          type="url"
                          value={formData.githubRepoUrl}
                          onChange={(e) => handleChange('githubRepoUrl', e.target.value)}
                          placeholder="https://github.com/username/my-arc3-game"
                          className="w-full px-3 py-2 text-xs font-mono border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)] text-[var(--arc3-text)] placeholder:text-[var(--arc3-dim)] focus:outline-none focus:border-[var(--arc3-focus)]"
                        />
                        {errors.githubRepoUrl && (
                          <p className="text-[11px] text-[var(--arc3-c8)] mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {errors.githubRepoUrl}
                          </p>
                        )}
                        <p className="text-[11px] text-[var(--arc3-dim)] mt-1">
                          Public repo containing your ARCEngine game. We'll clone and review it.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Game ID */}
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Game ID <span className="text-[var(--arc3-c8)]">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.gameId}
                      onChange={(e) => handleChange('gameId', e.target.value.toLowerCase())}
                      placeholder="my-awesome-game"
                      className="w-full px-3 py-2 text-xs font-mono border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)] text-[var(--arc3-text)] placeholder:text-[var(--arc3-dim)] focus:outline-none focus:border-[var(--arc3-focus)]"
                    />
                    {errors.gameId && (
                      <p className="text-[11px] text-[var(--arc3-c8)] mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.gameId}
                      </p>
                    )}
                    <p className="text-[11px] text-[var(--arc3-dim)] mt-1">
                      Unique identifier. Lowercase, 3-50 chars, letters/numbers/dashes.
                    </p>
                  </div>

                  {/* Display Name */}
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Display Name <span className="text-[var(--arc3-c8)]">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.displayName}
                      onChange={(e) => handleChange('displayName', e.target.value)}
                      placeholder="My Awesome Game"
                      className="w-full px-3 py-2 text-xs border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)] text-[var(--arc3-text)] placeholder:text-[var(--arc3-dim)] focus:outline-none focus:border-[var(--arc3-focus)]"
                    />
                    {errors.displayName && (
                      <p className="text-[11px] text-[var(--arc3-c8)] mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.displayName}
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Description <span className="text-[var(--arc3-c8)]">*</span>
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleChange('description', e.target.value)}
                      placeholder="Describe your game's mechanics, goals, and what makes it interesting..."
                      rows={3}
                      className="w-full px-3 py-2 text-xs border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)] text-[var(--arc3-text)] placeholder:text-[var(--arc3-dim)] focus:outline-none focus:border-[var(--arc3-focus)] resize-none"
                    />
                    {errors.description && (
                      <p className="text-[11px] text-[var(--arc3-c8)] mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.description}
                      </p>
                    )}
                    <p className="text-[11px] text-[var(--arc3-dim)] mt-1">
                      {formData.description.length}/500 characters
                    </p>
                  </div>

                  {/* Author Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Author Name <span className="text-[var(--arc3-c8)]">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.authorName}
                        onChange={(e) => handleChange('authorName', e.target.value)}
                        placeholder="Your name or handle"
                        className="w-full px-3 py-2 text-xs border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)] text-[var(--arc3-text)] placeholder:text-[var(--arc3-dim)] focus:outline-none focus:border-[var(--arc3-focus)]"
                      />
                      {errors.authorName && (
                        <p className="text-[11px] text-[var(--arc3-c8)] mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.authorName}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Email <span className="text-[var(--arc3-c8)]">*</span>
                      </label>
                      <input
                        type="email"
                        value={formData.authorEmail}
                        onChange={(e) => handleChange('authorEmail', e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-3 py-2 text-xs border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)] text-[var(--arc3-text)] placeholder:text-[var(--arc3-dim)] focus:outline-none focus:border-[var(--arc3-focus)]"
                      />
                      {errors.authorEmail && (
                        <p className="text-[11px] text-[var(--arc3-c8)] mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.authorEmail}
                        </p>
                      )}
                      <p className="text-[11px] text-[var(--arc3-dim)] mt-1">For review notifications only</p>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-semibold mb-1">Additional Notes (optional)</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => handleChange('notes', e.target.value)}
                      placeholder="Any special instructions for reviewers, known issues, or context..."
                      rows={2}
                      className="w-full px-3 py-2 text-xs border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)] text-[var(--arc3-text)] placeholder:text-[var(--arc3-dim)] focus:outline-none focus:border-[var(--arc3-focus)] resize-none"
                    />
                  </div>

                  {/* Error message */}
                  {submitMutation.isError && (
                    <div className="border-2 border-[var(--arc3-c8)] bg-[var(--arc3-panel-soft)] p-3 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-[var(--arc3-c8)] shrink-0 mt-0.5" />
                      <p className="text-[11px] text-[var(--arc3-c8)]">
                        {submitMutation.error instanceof Error
                          ? submitMutation.error.message
                          : 'Submission failed. Please try again.'}
                      </p>
                    </div>
                  )}

                  {/* Submit */}
                  <div className="pt-2">
                    <PixelButton
                      type="submit"
                      tone="green"
                      disabled={submitMutation.isPending}
                      className="w-full"
                    >
                      <Send className="w-4 h-4" />
                      {submitMutation.isPending ? 'Submitting...' : 'Submit for Review'}
                    </PixelButton>
                  </div>
                </div>
              </PixelPanel>
            </form>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-5 space-y-4">
            <PixelPanel tone="yellow" title="Requirements" subtitle="Your game must meet these criteria">
              <ul className="space-y-2">
                {requirements.map((req, idx) => (
                  <li key={idx} className="text-[11px] text-[var(--arc3-muted)] flex gap-2">
                    <span className="text-[var(--arc3-c11)] font-semibold shrink-0">{idx + 1}.</span>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </PixelPanel>

            <PixelPanel tone="blue" title="Why GitHub?">
              <div className="space-y-2 text-[11px] text-[var(--arc3-muted)]">
                <p>
                  ARCEngine games are <span className="font-semibold">multi-file Python projects</span>, not
                  single scripts. A typical game includes:
                </p>
                <ul className="space-y-1 pl-3">
                  <li>• <span className="font-mono">game.py</span> - Main game class</li>
                  <li>• <span className="font-mono">levels.py</span> - Level definitions</li>
                  <li>• <span className="font-mono">sprites.py</span> - Sprite assets</li>
                  <li>• <span className="font-mono">pyproject.toml</span> - Dependencies</li>
                </ul>
                <p className="pt-1">
                  GitHub lets us review your full project structure and ensure compatibility before adding it to
                  the gallery.
                </p>
              </div>
            </PixelPanel>

            <PixelPanel tone="green" title="Resources">
              <div className="space-y-2">
                <a
                  href={ARCENGINE_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs font-semibold text-[var(--arc3-c14)] hover:underline"
                >
                  <Github className="w-4 h-4" />
                  ARCEngine Repository
                  <ExternalLink className="w-3 h-3 opacity-80" />
                </a>
                <a
                  href={`${ARCENGINE_REPO_URL}/tree/main/examples`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs font-semibold text-[var(--arc3-c14)] hover:underline"
                >
                  <BookOpen className="w-4 h-4" />
                  Example Games
                  <ExternalLink className="w-3 h-3 opacity-80" />
                </a>
                <a
                  href={`${ARCENGINE_REPO_URL}/blob/main/arcengine/README.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs font-semibold text-[var(--arc3-c14)] hover:underline"
                >
                  <Info className="w-4 h-4" />
                  API Documentation
                  <ExternalLink className="w-3 h-3 opacity-80" />
                </a>
              </div>
            </PixelPanel>

            <SpriteMosaic seed={42} width={12} height={6} className="w-full" />
          </div>
        </div>
      </main>
    </Arc3PixelPage>
  );
}
