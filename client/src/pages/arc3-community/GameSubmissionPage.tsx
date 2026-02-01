/*
Author: Cascade (Claude Sonnet 4)
Date: 2026-02-01
PURPOSE: ARC3 game submission page where community members can submit single Python files
         for review. Uses direct file upload with client-side validation and server-side safety checks.
         Replaces email contact with social handles (Discord/Twitter) for community moderation.
SRP/DRY check: Pass — single-purpose submission form; uses shared pixel UI primitives and new uploader.
*/

import { useState, useMemo } from 'react';
import { useLocation, Link } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { Send, ArrowLeft, CheckCircle2, AlertCircle, BookOpen, ExternalLink, MessageCircle } from 'lucide-react';
import { Arc3PixelPage, PixelButton, PixelPanel, SpriteMosaic, PixelLink } from '@/components/arc3-community/Arc3PixelUI';
import { PythonFileUploader, type FileValidation } from '@/components/arc3-community/PythonFileUploader';
import { ValidationGuide } from '@/components/arc3-community/ValidationGuide';
import { apiRequest } from '@/lib/queryClient';

interface SubmissionData {
  gameId: string;
  displayName: string;
  description: string;
  authorName: string;
  creatorHandle: string;
  sourceCode: string;
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
const SAMPLE_GAME_URL = 'https://github.com/arcprize/ARCEngine/blob/main/games/official/ws01.py';
const DISCORD_URL = 'https://discord.gg/arcprize';

// Validate game ID format
function isValidGameId(id: string): boolean {
  return /^[a-z][a-z0-9_-]{2,49}$/.test(id);
}

// Validate creator handle (Discord or Twitter/X)
function isValidCreatorHandle(handle: string): boolean {
  const discordPattern = /^[A-Za-z0-9_.-]{2,32}(#[0-9]{4})?$/;
  const twitterPattern = /^https:\/\/(twitter|x)\.com\/[A-Za-z0-9_]{1,15}$/;
  return discordPattern.test(handle) || twitterPattern.test(handle);
}

export default function GameSubmissionPage() {
  const [, setLocation] = useLocation();
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [sourceCode, setSourceCode] = useState<string | null>(null);
  const [fileValidation, setFileValidation] = useState<FileValidation | null>(null);

  const [formData, setFormData] = useState<SubmissionData>({
    gameId: '',
    displayName: '',
    description: '',
    authorName: '',
    creatorHandle: '',
    sourceCode: '',
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

    if (!formData.creatorHandle.trim()) {
      newErrors.creatorHandle = 'Contact handle is required';
    } else if (!isValidCreatorHandle(formData.creatorHandle)) {
      newErrors.creatorHandle = 'Must be Discord handle (e.g., username#1234) or Twitter/X URL';
    }

    if (!sourceCode || !fileValidation?.isValid) {
      newErrors.sourceCode = 'Valid Python file is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm() && sourceCode) {
      submitMutation.mutate({ ...formData, sourceCode });
    }
  };

  const handleFileChange = (code: string | null, validation: FileValidation | null) => {
    setSourceCode(code);
    setFileValidation(validation);
    if (errors.sourceCode && validation?.isValid) {
      setErrors((prev) => ({ ...prev, sourceCode: undefined }));
    }
  };

  const handleChange = (field: keyof SubmissionData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const playbackSteps = useMemo(
    () => [
      'Upload your Python file containing an ARCBaseGame subclass',
      'Fill in game metadata (ID, name, description)',
      'Provide Discord or Twitter handle for contact',
      'Submit for validation and manual review',
      'Receive notification via social handle once approved',
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
                  <li>• Your game passed initial validation and is queued for manual review</li>
                  <li>• A moderator will test your game in a sandbox environment</li>
                  <li>• If approved, your game will appear in the community gallery</li>
                  <li>• You'll receive notification via Discord or Twitter at the handle you provided</li>
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
        {/* Hero Section */}
        <div className="mb-6">
          <PixelPanel tone="purple" className="text-center">
            <h1 className="text-lg font-bold mb-2">Submit Your ARC3 Game</h1>
            <p className="text-xs text-[var(--arc3-muted)] max-w-2xl mx-auto">
              Upload a single Python file with your ARCBaseGame subclass. We'll validate safety, review manually, and add it to the community gallery.
            </p>
          </PixelPanel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-7 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* File Upload Section */}
              <PixelPanel tone="blue" title="Upload File" subtitle="Single Python file (.py)">
                <PythonFileUploader onFileChange={handleFileChange} />
                {errors.sourceCode && (
                  <p className="text-[11px] text-[var(--arc3-c8)] mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.sourceCode}
                  </p>
                )}
              </PixelPanel>

              {/* Game Metadata Section */}
              <PixelPanel tone="green" title="Game Metadata" subtitle="Identify your game">
                <div className="space-y-4">
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
                </div>
              </PixelPanel>

              {/* Creator Contact Section */}
              <PixelPanel tone="pink" title="Creator Contact" subtitle="Discord or Twitter for moderation">
                <div className="space-y-4">
                  {/* Author Name */}
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Display Name (optional)
                    </label>
                    <input
                      type="text"
                      value={formData.authorName}
                      onChange={(e) => handleChange('authorName', e.target.value)}
                      placeholder="Your name or handle"
                      className="w-full px-3 py-2 text-xs border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)] text-[var(--arc3-text)] placeholder:text-[var(--arc3-dim)] focus:outline-none focus:border-[var(--arc3-focus)]"
                    />
                  </div>

                  {/* Creator Handle */}
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Contact Handle <span className="text-[var(--arc3-c8)]">*</span>
                    </label>
                    <div className="flex gap-2">
                      <MessageCircle className="w-5 h-5 text-[var(--arc3-dim)] shrink-0 mt-2" />
                      <div className="flex-1">
                        <input
                          type="text"
                          value={formData.creatorHandle}
                          onChange={(e) => handleChange('creatorHandle', e.target.value)}
                          placeholder="username#1234 or https://twitter.com/username"
                          className="w-full px-3 py-2 text-xs font-mono border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)] text-[var(--arc3-text)] placeholder:text-[var(--arc3-dim)] focus:outline-none focus:border-[var(--arc3-focus)]"
                        />
                        {errors.creatorHandle && (
                          <p className="text-[11px] text-[var(--arc3-c8)] mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {errors.creatorHandle}
                          </p>
                        )}
                        <p className="text-[11px] text-[var(--arc3-dim)] mt-1">
                          Moderators will contact you here. We use Discord/Twitter for faster community chat instead of email.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </PixelPanel>

              {/* Review Notes Section */}
              <PixelPanel tone="orange" title="Review Notes" subtitle="Optional context for moderators">
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Any special instructions for reviewers, known issues, or context..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)] text-[var(--arc3-text)] placeholder:text-[var(--arc3-dim)] focus:outline-none focus:border-[var(--arc3-focus)] resize-none"
                />
              </PixelPanel>

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
              <PixelButton
                type="submit"
                tone="green"
                disabled={submitMutation.isPending || !fileValidation?.isValid}
                className="w-full"
              >
                <Send className="w-4 h-4" />
                {submitMutation.isPending ? 'Submitting...' : 'Submit for Review'}
              </PixelButton>
            </form>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-5 space-y-4">
            <ValidationGuide />

            <PixelPanel tone="neutral" title="Submission Playbook" subtitle="Step by step">
              <ol className="space-y-2">
                {playbackSteps.map((step, idx) => (
                  <li key={idx} className="text-[11px] text-[var(--arc3-muted)] flex gap-2">
                    <span className="text-[var(--arc3-c11)] font-semibold shrink-0">{idx + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </PixelPanel>

            <PixelPanel tone="green" title="Resources" subtitle="Sample code and docs">
              <div className="space-y-2">
                <a
                  href={SAMPLE_GAME_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs font-semibold text-[var(--arc3-c14)] hover:underline"
                >
                  <BookOpen className="w-4 h-4" />
                  Sample Game (ws01.py)
                  <ExternalLink className="w-3 h-3 opacity-80" />
                </a>
                <a
                  href={ARCENGINE_DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs font-semibold text-[var(--arc3-c14)] hover:underline"
                >
                  <BookOpen className="w-4 h-4" />
                  ARCEngine Docs
                  <ExternalLink className="w-3 h-3 opacity-80" />
                </a>
                <a
                  href={DISCORD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs font-semibold text-[var(--arc3-c14)] hover:underline"
                >
                  <MessageCircle className="w-4 h-4" />
                  Join Discord
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
