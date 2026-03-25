/*
Author: Claude Sonnet 4.6 (Bubba)
Date: 25-March-2026
PURPOSE: /cc route — Claude Code OAuth guide for developers using subscription tokens to power AI agents.
         Based on Egon's content doc from events/2026/mar/25/claude-code-oauth-guide.md.
SRP/DRY check: Pass — static content page, no state/effects needed.
*/

import React from 'react';
import { Link } from 'wouter';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function ClaudeCodeGuide() {
  usePageMeta({
    title: 'Claude Code OAuth for AI Agents – ARC Explainer',
    description:
      'Using your Claude subscription to power AI agents — no per-token billing. OAuth token format, required headers, model names, usage checking, Python + TypeScript implementations.',
    canonicalPath: '/cc',
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-10 border-b border-slate-800 pb-8">
          <h1 className="text-4xl font-bold text-slate-100 mb-3">
            Claude Code OAuth for AI Agents
          </h1>
          <p className="text-lg text-slate-400">
            Using your Claude subscription to power agents — no per-token billing
          </p>
          <p className="text-sm text-slate-500 mt-3">
            Written by Egon · Compiled from swarm experience · March 2026 ·{' '}
            <a
              href="https://arc.markbarney.net"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              arc.markbarney.net
            </a>
          </p>
        </div>

        {/* Intro */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-3">What This Is</h2>
          <p className="text-slate-300 leading-relaxed">
            If you have a Claude subscription (Claude.ai Pro or Max), you can use that subscription
            to make API calls directly — just like Claude Code does. No separate Anthropic API
            billing. Your subscription's usage limits apply.
          </p>
          <p className="text-slate-300 leading-relaxed mt-3">
            This guide documents everything we learned building this into multiple projects:
            AutoResearchClaw, ARC-Explainer, planexe-cli, and OpenClaw.
          </p>
        </section>

        {/* The Token */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">The Token</h2>
          <p className="text-slate-300 leading-relaxed mb-4">
            Claude Code OAuth tokens look like this:
          </p>
          <pre className="bg-slate-800 rounded p-4 text-sm font-mono text-green-400 overflow-x-auto mb-4">
            <code>sk-ant-oat01-...</code>
          </pre>
          <p className="text-slate-300 leading-relaxed mb-4">
            They're <strong className="text-slate-100">NOT</strong> the same as Anthropic API keys (
            <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm font-mono text-amber-400">
              sk-ant-api03-...
            </code>
            ). They're generated through Claude Code's OAuth flow and represent your Claude
            subscription.
          </p>
          <div className="border-l-4 border-blue-500 pl-4">
            <p className="text-sm text-slate-400 font-semibold mb-1">How to get one:</p>
            <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
              <li>Install Claude Code CLI and authenticate</li>
              <li>
                Find the token in{' '}
                <code className="bg-slate-800 px-1 py-0.5 rounded font-mono text-xs">
                  ~/.claude/credentials.json
                </code>{' '}
                or equivalent
              </li>
              <li>
                Or use the env var:{' '}
                <code className="bg-slate-800 px-1 py-0.5 rounded font-mono text-xs text-green-400">
                  CODEBUFF_CLAUDE_OAUTH_TOKEN=sk-ant-oat01-...
                </code>{' '}
                if working with a Claude Code-based project
              </li>
            </ul>
          </div>
        </section>

        {/* Required Header */}
        <section className="mb-10 rounded-lg border border-amber-700/40 bg-amber-950/20 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">The Required Header</h2>
          <p className="text-slate-300 leading-relaxed mb-4">
            Every API call with an OAuth token <strong className="text-amber-300">must include</strong>:
          </p>
          <pre className="bg-slate-800 rounded p-4 text-sm font-mono text-green-400 overflow-x-auto mb-4">
            <code>anthropic-beta: oauth-2025-04-20</code>
          </pre>
          <p className="text-slate-400 text-sm">
            Without it: <code className="bg-slate-800 px-1 py-0.5 rounded font-mono">401 Unauthorized</code>.
            This is the most common failure mode.
          </p>
        </section>

        {/* Required System Prompt Prefix */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">The Required System Prompt Prefix</h2>
          <p className="text-slate-300 leading-relaxed mb-4">
            For models to work correctly with OAuth tokens — especially for Sonnet-specific quota
            tracking — the system prompt must start with:
          </p>
          <pre className="bg-slate-800 rounded p-4 text-sm font-mono text-green-400 overflow-x-auto mb-4">
            <code>{"You are Claude Code, Anthropic's official CLI for Claude."}</code>
          </pre>
          <p className="text-slate-300 text-sm mb-2">This is not optional. Without it:</p>
          <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside ml-2">
            <li>Standard API calls work but you won't see Sonnet usage tracked separately</li>
            <li>Some internal routing may behave differently</li>
          </ul>
        </section>

        {/* Checking Usage */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">Checking Your Usage</h2>
          <p className="text-slate-300 leading-relaxed mb-6">
            Two API probes needed to get the full picture:
          </p>

          <div className="mb-6">
            <p className="text-sm font-semibold text-slate-400 mb-2">
              Probe 1 — any model (gives overall 5h and 7d usage):
            </p>
            <pre className="bg-slate-800 rounded p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
              <code>{`curl https://api.anthropic.com/v1/messages \\
  -H "Authorization: Bearer sk-ant-oat01-..." \\
  -H "anthropic-beta: oauth-2025-04-20" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "content-type: application/json" \\
  -d '{"model":"claude-haiku-4-6","max_tokens":1,"messages":[{"role":"user","content":"x"}]}'`}</code>
            </pre>
            <p className="text-sm text-slate-400 mt-2">Response headers contain:</p>
            <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside ml-2 mt-1">
              <li>
                <code className="bg-slate-800 px-1 py-0.5 rounded font-mono text-xs">
                  anthropic-ratelimit-unified-5h-utilization
                </code>{' '}
                — percentage of 5h budget used
              </li>
              <li>
                <code className="bg-slate-800 px-1 py-0.5 rounded font-mono text-xs">
                  anthropic-ratelimit-unified-7d-utilization
                </code>{' '}
                — percentage of 7d budget used
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-400 mb-2">
              Probe 2 — Sonnet only (gives Sonnet-specific 7d usage):
            </p>
            <pre className="bg-slate-800 rounded p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
              <code>{`curl https://api.anthropic.com/v1/messages \\
  -H "Authorization: Bearer sk-ant-oat01-..." \\
  -H "anthropic-beta: oauth-2025-04-20" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "content-type: application/json" \\
  -d '{"model":"claude-sonnet-4-6","max_tokens":1,"system":"You are Claude Code, Anthropic'\''s official CLI for Claude.","messages":[{"role":"user","content":"x"}]}'`}</code>
            </pre>
            <p className="text-sm text-slate-400 mt-2">Response headers contain:</p>
            <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside ml-2 mt-1">
              <li>
                <code className="bg-slate-800 px-1 py-0.5 rounded font-mono text-xs">
                  anthropic-ratelimit-unified-7d_sonnet-utilization
                </code>{' '}
                — Sonnet-specific budget
              </li>
            </ul>
          </div>
        </section>

        {/* Python Implementation */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">Implementation — Python</h2>
          <pre className="bg-slate-800 rounded p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
            <code>{`import anthropic

def build_client(api_key: str) -> anthropic.Anthropic:
    is_oauth = api_key.startswith('sk-ant-oat01-')
    return anthropic.Anthropic(
        api_key=api_key,
        default_headers={'anthropic-beta': 'oauth-2025-04-20'} if is_oauth else None,
    )

CLAUDE_CODE_PREAMBLE = "You are Claude Code, Anthropic's official CLI for Claude."

def call_llm(api_key: str, system: str, user: str, model: str = 'claude-sonnet-4-6') -> str:
    client = build_client(api_key)
    is_oauth = api_key.startswith('sk-ant-oat01-')
    
    response = client.messages.create(
        model=model,
        max_tokens=4096,
        system=f"{CLAUDE_CODE_PREAMBLE}\\n\\n{system}" if is_oauth else system,
        messages=[{"role": "user", "content": user}],
    )
    return response.content[0].text`}</code>
          </pre>
        </section>

        {/* TypeScript Implementation */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">Implementation — TypeScript</h2>
          <pre className="bg-slate-800 rounded p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
            <code>{`import Anthropic from '@anthropic-ai/sdk';

const OAUTH_PREAMBLE = "You are Claude Code, Anthropic's official CLI for Claude.";

function buildClient(apiKey: string): Anthropic {
    const isOAuth = apiKey.startsWith('sk-ant-oat01-');
    return new Anthropic({
        apiKey,
        defaultHeaders: isOAuth
            ? { 'anthropic-beta': 'oauth-2025-04-20' }
            : undefined,
    });
}

async function callLLM(
    apiKey: string,
    system: string,
    user: string,
    model = 'claude-sonnet-4-6',
): Promise<string> {
    const client = buildClient(apiKey);
    const isOAuth = apiKey.startsWith('sk-ant-oat01-');
    
    const response = await client.messages.create({
        model,
        max_tokens: 4096,
        system: isOAuth ? \`\${OAUTH_PREAMBLE}\\n\\n\${system}\` : system,
        messages: [{ role: 'user', content: user }],
    });
    
    return (response.content[0] as { text: string }).text;
}`}</code>
          </pre>
        </section>

        {/* Model Names */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-2">
            Model Names (Current as of March 2026)
          </h2>
          <p className="text-slate-400 text-sm mb-5">
            The model ID format changed between generations. This tripped us up repeatedly.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 pr-6 font-semibold text-slate-400">
                    Old format (Claude 3 era)
                  </th>
                  <th className="text-left py-2 font-semibold text-slate-400">
                    New format (Claude 4 era)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr>
                  <td className="py-2.5 pr-6">
                    <code className="font-mono text-amber-400">claude-3-5-haiku-20241022</code>
                  </td>
                  <td className="py-2.5">
                    <code className="font-mono text-green-400">claude-haiku-4-6</code>
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-6">
                    <code className="font-mono text-amber-400">claude-3-5-sonnet-20241022</code>
                  </td>
                  <td className="py-2.5">
                    <code className="font-mono text-green-400">claude-sonnet-4-6</code>
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-6">
                    <code className="font-mono text-amber-400">claude-3-opus-20240229</code>
                  </td>
                  <td className="py-2.5">
                    <code className="font-mono text-green-400">claude-opus-4-6</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 border-l-4 border-amber-500 pl-4">
            <p className="text-sm text-slate-300">
              <strong className="text-amber-300">The new models do NOT have date suffixes.</strong>{' '}
              <code className="bg-slate-800 px-1 py-0.5 rounded font-mono text-xs text-green-400">
                claude-sonnet-4-6
              </code>{' '}
              is correct.{' '}
              <code className="bg-slate-800 px-1 py-0.5 rounded font-mono text-xs text-red-400">
                claude-sonnet-4-6-20250514
              </code>{' '}
              does not exist and will 404.
            </p>
            <p className="text-sm text-slate-400 mt-2">
              If routing through OpenRouter:{' '}
              <code className="bg-slate-800 px-1 py-0.5 rounded font-mono text-xs">
                anthropic/claude-sonnet-4-6
              </code>
              ,{' '}
              <code className="bg-slate-800 px-1 py-0.5 rounded font-mono text-xs">
                anthropic/claude-haiku-4-6
              </code>
              ,{' '}
              <code className="bg-slate-800 px-1 py-0.5 rounded font-mono text-xs">
                anthropic/claude-opus-4-6
              </code>
              .
            </p>
          </div>
        </section>

        {/* Common Failure Modes */}
        <section className="mb-10 rounded-lg border border-red-800/40 bg-red-950/10 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-5">Common Failure Modes</h2>
          <ol className="space-y-6">
            <li>
              <p className="font-semibold text-slate-200 mb-1">
                1.{' '}
                <code className="bg-slate-800 px-1.5 py-0.5 rounded font-mono text-sm text-red-400">
                  401 Unauthorized
                </code>
              </p>
              <p className="text-sm text-slate-400 mb-1">
                <span className="text-slate-500">Cause:</span> Missing{' '}
                <code className="bg-slate-800 px-1 py-0.5 rounded font-mono text-xs">
                  anthropic-beta: oauth-2025-04-20
                </code>{' '}
                header.
              </p>
              <p className="text-sm text-slate-300">
                <span className="text-green-400">Fix:</span> Add the header. It's required for all
                OAuth token calls.
              </p>
            </li>
            <li>
              <p className="font-semibold text-slate-200 mb-1">
                2.{' '}
                <code className="bg-slate-800 px-1.5 py-0.5 rounded font-mono text-sm text-red-400">
                  404 Not Found
                </code>{' '}
                on model
              </p>
              <p className="text-sm text-slate-400 mb-1">
                <span className="text-slate-500">Cause:</span> Using old-format model IDs with date
                suffixes, or the wrong model string entirely.
              </p>
              <p className="text-sm text-slate-300">
                <span className="text-green-400">Fix:</span> Use{' '}
                <code className="bg-slate-800 px-1 py-0.5 rounded font-mono text-xs text-green-400">
                  claude-sonnet-4-6
                </code>{' '}
                /{' '}
                <code className="bg-slate-800 px-1 py-0.5 rounded font-mono text-xs text-green-400">
                  claude-haiku-4-6
                </code>{' '}
                /{' '}
                <code className="bg-slate-800 px-1 py-0.5 rounded font-mono text-xs text-green-400">
                  claude-opus-4-6
                </code>
                .
              </p>
            </li>
            <li>
              <p className="font-semibold text-slate-200 mb-1">3. Usage appears on wrong account</p>
              <p className="text-sm text-slate-400 mb-1">
                <span className="text-slate-500">Cause:</span> Multiple Claude accounts with
                different tokens. The token prefix tells you which account.
              </p>
              <p className="text-sm text-slate-300">
                <span className="text-green-400">Fix:</span> Check which Claude.ai account the
                token came from. Usage shows up on the account that owns the token.
              </p>
            </li>
            <li>
              <p className="font-semibold text-slate-200 mb-1">
                4. Sonnet 7d utilization not showing in response headers
              </p>
              <p className="text-sm text-slate-400 mb-1">
                <span className="text-slate-500">Cause:</span> Not using the system prompt prefix{' '}
                <code className="bg-slate-800 px-1 py-0.5 rounded font-mono text-xs">
                  "You are Claude Code..."
                </code>
              </p>
              <p className="text-sm text-slate-300">
                <span className="text-green-400">Fix:</span> Prepend the preamble to your system
                prompt. The Sonnet-specific quota bucket only activates with this prefix.
              </p>
            </li>
            <li>
              <p className="font-semibold text-slate-200 mb-1">
                5. Rate limit hit even though "usage isn't that high"
              </p>
              <p className="text-sm text-slate-400 mb-1">
                <span className="text-slate-500">Cause:</span> Multiple projects sharing the same
                OAuth token. The 7d window accumulates across all callers.
              </p>
              <p className="text-sm text-slate-300">
                <span className="text-green-400">Fix:</span> Each project (or team member) should
                use their own Claude subscription token. Don't share tokens across unrelated
                workloads.
              </p>
            </li>
            <li>
              <p className="font-semibold text-slate-200 mb-1">
                6.{' '}
                <code className="bg-slate-800 px-1.5 py-0.5 rounded font-mono text-sm text-red-400">
                  403 Forbidden
                </code>{' '}
                on specific models
              </p>
              <p className="text-sm text-slate-400 mb-1">
                <span className="text-slate-500">Cause:</span> Your subscription tier doesn't
                include that model (e.g., Opus requires Max or higher).
              </p>
              <p className="text-sm text-slate-300">
                <span className="text-green-400">Fix:</span> Check your Claude subscription tier.
                Pro includes Sonnet and Haiku. Max includes all models.
              </p>
            </li>
            <li>
              <p className="font-semibold text-slate-200 mb-1">
                7. "I have a subscription but still getting billing errors"
              </p>
              <p className="text-sm text-slate-400 mb-1">
                <span className="text-slate-500">Cause:</span> OAuth tokens route through your
                subscription, not the Anthropic API billing system. If you're getting billing
                errors, you may be accidentally using an API key (
                <code className="bg-slate-800 px-1 py-0.5 rounded font-mono text-xs text-red-400">
                  sk-ant-api03-
                </code>
                ) instead of an OAuth token (
                <code className="bg-slate-800 px-1 py-0.5 rounded font-mono text-xs text-green-400">
                  sk-ant-oat01-
                </code>
                ).
              </p>
              <p className="text-sm text-slate-300">
                <span className="text-green-400">Fix:</span> Verify your token starts with{' '}
                <code className="bg-slate-800 px-1 py-0.5 rounded font-mono text-xs text-green-400">
                  sk-ant-oat01-
                </code>
                .
              </p>
            </li>
          </ol>
        </section>

        {/* Environment Variables */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-2">
            Environment Variable Conventions
          </h2>
          <p className="text-slate-400 text-sm mb-5">
            Different tools use different env var names for the same thing:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 pr-6 font-semibold text-slate-400">Tool</th>
                  <th className="text-left py-2 font-semibold text-slate-400">Env var name</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {[
                  ['Claude Code', 'ANTHROPIC_API_KEY (accepts both API keys and OAuth tokens)'],
                  ['OpenClaw', 'ANTHROPIC_API_KEY or stored in auth-profiles.json'],
                  ['AutoResearchClaw / planexe', 'ANTHROPIC_OAUTHTOKEN or CODEBUFF_CLAUDE_OAUTH_TOKEN'],
                  ['Arc-Explainer', 'ANTHROPIC_API_KEY'],
                  ['Direct Python/TS apps', 'Your choice — detect prefix in code'],
                ].map(([tool, envVar]) => (
                  <tr key={tool}>
                    <td className="py-2.5 pr-6 text-slate-300 font-medium">{tool}</td>
                    <td className="py-2.5">
                      <code className="font-mono text-xs text-amber-400">{envVar}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* The Quota System */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">The Quota System</h2>
          <p className="text-slate-300 text-sm mb-4">Claude Max subscriptions have:</p>
          <ul className="text-sm text-slate-300 space-y-1.5 list-disc list-inside mb-5">
            <li>
              <strong className="text-slate-200">5-hour rolling window</strong> — resets every 5
              hours from first use
            </li>
            <li>
              <strong className="text-slate-200">7-day rolling window</strong> — resets 7 days
              after the window opened
            </li>
            <li>
              <strong className="text-slate-200">7-day Sonnet-specific window</strong> — separate
              bucket for Sonnet models only
            </li>
          </ul>
          <p className="text-sm text-slate-400 font-semibold mb-2">Practical advice:</p>
          <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
            <li>Route heavy Sonnet workloads earlier in the 5h window when it's fresh</li>
            <li>Use Haiku for high-volume low-complexity calls (cheaper on the 7d budget)</li>
            <li>Monitor both windows before starting long pipeline runs</li>
            <li>
              If 5h &gt; 80%: slow down or wait for reset
            </li>
            <li>If 7d &gt; 85%: prioritize essential tasks only</li>
          </ul>
        </section>

        {/* What We Built With This */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">What We Built With This</h2>
          <ul className="space-y-2 text-sm text-slate-300">
            {[
              ['OpenClaw', 'runs entirely on Claude OAuth tokens, no per-token billing'],
              ['AutoResearchClaw', 'AI research pipeline, OAuth tokens for model calls'],
              ['ARC-Explainer', 'agent runner for ARC-AGI-3 games, BYOK with OAuth support'],
              ['planexe-cli', 'plan execution CLI with Claude Code OAuth authentication'],
              ['sonpham-arc3', 'web platform with Anthropic proxy that handles OAuth detection'],
            ].map(([name, desc]) => (
              <li key={name} className="flex gap-2">
                <span className="font-semibold text-slate-200 min-w-[160px]">{name}</span>
                <span className="text-slate-400">— {desc}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Footer */}
        <div className="border-t border-slate-800 pt-8 mt-4">
          <p className="text-sm text-slate-500 mb-4">
            This guide reflects swarm experience as of March 2026.
          </p>
          <Link
            href="/"
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            ← Back to ARC Explainer
          </Link>
        </div>
      </div>
    </div>
  );
}
