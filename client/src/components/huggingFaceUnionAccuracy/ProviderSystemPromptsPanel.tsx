/**
 * Author: Cascade
 * Date: 2025-12-17
 * PURPOSE: Provider system prompt panel for the Hugging Face union-accuracy page.
 *          Owns fetching the latest raw prompt texts from GitHub raw URLs and displaying them.
 * SRP/DRY check: Pass - Fetch + present provider prompt documents.
 */

import React, { useEffect, useState } from 'react';

const SYSTEM_PROMPT_SOURCES = [
  {
    key: 'gemini',
    label: 'Gemini 2.5 Pro (Apr 18, 2025)',
    url: 'https://raw.githubusercontent.com/elder-plinius/CL4R1T4S/main/GOOGLE/Gemini-2.5-Pro-04-18-2025.md',
  },
  {
    key: 'anthropic',
    label: 'Claude Sonnet 4.5 (Sep 29, 2025)',
    url: 'https://raw.githubusercontent.com/elder-plinius/CL4R1T4S/main/ANTHROPIC/Claude_Sonnet-4.5_Sep-29-2025.txt',
  },
  {
    key: 'openai',
    label: 'OpenAI ChatGPT5 (Aug 7, 2025)',
    url: 'https://raw.githubusercontent.com/elder-plinius/CL4R1T4S/main/OPENAI/ChatGPT5-08-07-2025.mkd',
  },
  {
    key: 'grok',
    label: 'Grok 4.1 (Nov 17, 2025)',
    url: 'https://raw.githubusercontent.com/elder-plinius/CL4R1T4S/main/XAI/GROK-4.1_Nov-17-2025.txt',
  },
];

export const ProviderSystemPromptsPanel: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    const fetchSystemPrompts = async () => {
      setError(null);
      setLoading(true);
      try {
        const entries = await Promise.all(
          SYSTEM_PROMPT_SOURCES.map(async (src) => {
            const resp = await fetch(src.url);
            if (!resp.ok) {
              throw new Error(`Failed to fetch ${src.label}`);
            }
            const text = await resp.text();
            return [src.key, text] as const;
          })
        );

        if (cancelled) {
          return;
        }

        setData(Object.fromEntries(entries));
        setVisible(true);
      } catch (err) {
        if (cancelled) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Failed to load system prompts';
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchSystemPrompts();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div id="provider-system-prompts" className="border-t border-purple-200 pt-3 mt-3 space-y-2">
      <div className="flex flex-col gap-1">
        <span className="text-base font-semibold text-gray-800">Provider system prompts (developer note)</span>
        <span className="text-base text-gray-600">
          All major provider system prompts can be read at{' '}
          <a
            className="text-purple-700 underline font-semibold"
            href="https://github.com/elder-plinius/CL4R1T4S/tree/main"
            target="_blank"
            rel="noreferrer"
          >
            github.com/elder-plinius/CL4R1T4S
          </a>
          . These are the defaults providers may apply when no custom system prompt is supplied. Grok notes that system messages take precedence over user messages; the impact on ARC harness testing is unknown.
        </span>
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </div>
      )}

      {loading && !visible && (
        <div className="text-xs text-gray-600">Loading latest provider prompts…</div>
      )}

      {visible && (
        <div className="grid gap-2 md:grid-cols-2">
          {SYSTEM_PROMPT_SOURCES.map((src) => {
            const content = data[src.key] || 'Not loaded';
            return (
              <div key={src.key} className="border border-gray-200 rounded p-2 bg-white">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-base font-semibold text-gray-800">{src.label}</span>
                  <a
                    href={src.url
                      .replace('raw.githubusercontent.com', 'github.com')
                      .replace('/main/', '/blob/main/')}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-purple-700 underline"
                  >
                    View on GitHub
                  </a>
                </div>
                <pre className="text-xs text-gray-700 bg-gray-50 rounded p-2 overflow-x-auto max-h-52 whitespace-pre-wrap">
                  {content}
                </pre>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
