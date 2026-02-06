/*
Author: Cascade (Claude Sonnet 4)
Date: 2026-02-01
PURPOSE: Displays validation requirements and safety information for ARC3 game submissions.
         Shows enforced checks mirroring CommunityGameValidator rules.
SRP/DRY check: Pass — single-purpose informational component for submission requirements.
*/

import { Shield, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { PixelPanel } from './Arc3PixelUI';

const VALIDATION_CHECKS = [
  { label: 'Must subclass ARCBaseGame', required: true },
  { label: 'Must import from arcengine', required: true },
  { label: 'No forbidden imports (os, subprocess, socket, etc.)', required: true },
  { label: 'No exec/eval calls', required: true },
  { label: 'No file operations (open)', required: true },
  { label: 'Max 2000 lines of code', required: true },
  { label: 'Max 500KB file size', required: true },
];

const ALLOWED_IMPORTS = [
  'arcengine',
  'numpy',
  'math',
  'random',
  'collections',
  'itertools',
  'functools',
  'typing',
  'dataclasses',
  'enum',
  'copy',
  're',
];

export function ValidationGuide() {
  return (
    <div className="space-y-4">
      <PixelPanel tone="yellow" title="Validation Requirements" subtitle="Your file must pass these checks">
        <div className="space-y-3">
          <div className="space-y-1">
            {VALIDATION_CHECKS.map((check, idx) => (
              <div key={idx} className="flex items-start gap-2 text-[11px]">
                {check.required ? (
                  <XCircle className="w-3.5 h-3.5 text-[var(--arc3-c8)] shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-[var(--arc3-c11)] shrink-0 mt-0.5" />
                )}
                <span className="text-[var(--arc3-muted)]">{check.label}</span>
              </div>
            ))}
          </div>
        </div>
      </PixelPanel>

      <PixelPanel tone="blue" title="Allowed Imports" subtitle="Safe modules you can use">
        <div className="flex flex-wrap gap-1.5">
          {ALLOWED_IMPORTS.map((module) => (
            <code
              key={module}
              className="px-2 py-0.5 text-[10px] bg-[var(--arc3-panel-soft)] border border-[var(--arc3-border)] text-[var(--arc3-c9)]"
            >
              {module}
            </code>
          ))}
        </div>
      </PixelPanel>

      <PixelPanel tone="purple" title="Safety & Review" subtitle="What happens after upload">
        <div className="space-y-2 text-[11px] text-[var(--arc3-muted)]">
          <div className="flex items-start gap-2">
            <Shield className="w-3.5 h-3.5 text-[var(--arc3-c15)] shrink-0 mt-0.5" />
            <p>
              All submissions are reviewed manually in an offline sandbox environment before execution.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--arc3-c14)] shrink-0 mt-0.5" />
            <p>
              Submissions remain private until approved by a moderator.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-[var(--arc3-c11)] shrink-0 mt-0.5" />
            <p>
              Review typically takes 1-3 business days. You'll be contacted via Discord or Twitter.
            </p>
          </div>
        </div>
      </PixelPanel>
    </div>
  );
}
