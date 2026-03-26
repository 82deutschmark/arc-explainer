/*
Author: Claude Sonnet 4.6 (Bubba)
Date: 25-March-2026
PURPOSE: /cc route — Claude Code OAuth technical reference for developers. Facts only, no project references.
SRP/DRY check: Pass — static content page, no state/effects needed.
*/

import React from 'react';
import { Link } from 'wouter';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function ClaudeCodeGuide() {
  usePageMeta({
    title: 'Claude Code OAuth — Technical Reference',
    description:
      'Technical reference for using Claude Code OAuth tokens with the Anthropic API. Token format, required headers, system prompt requirements, model names, usage headers, code examples.',
    canonicalPath: '/cc',
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-10 border-b border-slate-800 pb-8">
          <h1 className="text-4xl font-bold text-slate-100 mb-3">
            Claude Code OAuth — Technical Reference
          </h1>
          <p className="text-lg text-slate-400">
            What's mechanically different from a normal Anthropic API key
          </p>
        </div>

        {/* Token Format */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">Token Format</h2>
          <p className="text-slate-300 leading-relaxed mb-4">
            Claude Code OAuth tokens have the prefix{' '}
            <code className="bg-slate-800 px-1.5 py-0.5 rounded font-mono text-sm text-green-400">
              sk-ant-oat01-
            </code>
            . They are distinct from Anthropic API keys, which have the prefix{' '}
            <code className="bg-slate-800 px-1.5 py-0.5 rounded font-mono text-sm text-amber-400">
              sk-ant-api03-
            </code>
            . OAuth tokens represent a Claude subscription (Claude.ai Pro or Max) and route usage
            against that subscription's quota rather than per-token API billing.
          </p>
          <p className="text-slate-300 leading-relaxed">
            OAuth tokens are generated through Claude Code's authentication flow and are stored in{' '}
            <code className="bg-slate-800 px-1.5 py-0.5 rounded font-mono text-sm">
              ~/.claude/credentials.json
            </code>{' '}
            after login.
          </p>
        </section>

        {/* Required Header */}
        <section className="mb-10 rounded-lg border border-amber-700/40 bg-amber-950/20 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">Required HTTP Header</h2>
          <p className="text-slate-300 leading-relaxed mb-4">
            Every API call using an OAuth token must include:
          </p>
          <pre className="bg-slate-800 rounded p-4 text-sm font-mono text-green-400 overflow-x-auto mb-4">
            <code>anthropic-beta: oauth-2025-04-20</code>
          </pre>
          <p className="text-slate-400 text-sm">
            Without this header, the API returns{' '}
            <code className="bg-slate-800 px-1 py-0.5 rounded font-mono">401 Unauthorized</code>.
          </p>
        </section>

        {/* Required System Prompt */}
        <section className="mb-10 rounded-lg border border-red-800/50 bg-red-950/10 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">Required System Prompt Prefix</h2>
          <p className="text-slate-300 leading-relaxed mb-4">
            To use <code className="bg-slate-800 px-1.5 py-0.5 rounded font-mono text-sm text-green-400">claude-sonnet-4-6</code>{' '}
            (or any model that draws from the Sonnet quota bucket), the system prompt{' '}
            <strong className="text-red-300">must begin with</strong>:
          </p>
          <pre className="bg-slate-800 rounded p-4 text-sm font-mono text-green-400 overflow-x-auto mb-4">
            <code>{"You are Claude Code, Anthropic's official CLI for Claude."}</code>
          </pre>
          <p className="text-slate-300 text-sm">
            This is not optional. Without it, Sonnet 4.6 calls fail or behave incorrectly.
            The prefix is what activates the Sonnet-specific quota bucket and correct model routing.
          </p>
        </section>

        {/* Model Names */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">Model Names</h2>
          <p className="text-slate-300 text-sm mb-5">
            Claude 4.x model IDs do not have date suffixes. The old pattern (
            <code className="bg-slate-800 px-1 py-0.5 rounded font-mono text-xs text-amber-400">
              claude-3-5-haiku-20241022
            </code>
            ) does not apply.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 pr-6 font-semibold text-slate-400">Model</th>
                  <th className="text-left py-2 font-semibold text-slate-400">ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr>
                  <td className="py-2.5 pr-6 text-slate-300">Haiku</td>
                  <td className="py-2.5">
                    <code className="font-mono text-green-400">claude-haiku-4-6</code>
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-6 text-slate-300">Sonnet</td>
                  <td className="py-2.5">
                    <code className="font-mono text-green-400">claude-sonnet-4-6</code>
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-6 text-slate-300">Opus</td>
                  <td className="py-2.5">
                    <code className="font-mono text-green-400">claude-opus-4-6</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-slate-500 mt-4">
            Using a date-suffixed ID (e.g.{' '}
            <code className="bg-slate-800 px-1 py-0.5 rounded font-mono text-xs text-red-400">
              claude-sonnet-4-6-20250514
            </code>
            ) returns 404.
          </p>
        </section>

        {/* Usage Headers */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">Usage Response Headers</h2>
          <p className="text-slate-300 text-sm mb-5">
            Successful API responses include quota utilization headers. Two probes are needed to get
            the full picture because the Sonnet-specific header only appears on Sonnet calls with the
            required system prefix.
          </p>

          <div className="mb-8">
            <p className="text-sm font-semibold text-slate-300 mb-3">
              Any model call — returns overall utilization:
            </p>
            <pre className="bg-slate-800 rounded p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed mb-4">
              <code>{`curl https://api.anthropic.com/v1/messages \\
  -H "Authorization: Bearer sk-ant-oat01-..." \\
  -H "anthropic-beta: oauth-2025-04-20" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "content-type: application/json" \\
  -d '{"model":"claude-haiku-4-6","max_tokens":1,"messages":[{"role":"user","content":"x"}]}'`}</code>
            </pre>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 pr-6 font-semibold text-slate-400">Response header</th>
                    <th className="text-left py-2 font-semibold text-slate-400">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  <tr>
                    <td className="py-2.5 pr-6">
                      <code className="font-mono text-xs text-amber-400">
                        anthropic-ratelimit-unified-5h-utilization
                      </code>
                    </td>
                    <td className="py-2.5 text-slate-400 text-sm">
                      Percentage of 5-hour rolling budget consumed
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-6">
                      <code className="font-mono text-xs text-amber-400">
                        anthropic-ratelimit-unified-7d-utilization
                      </code>
                    </td>
                    <td className="py-2.5 text-slate-400 text-sm">
                      Percentage of 7-day rolling budget consumed
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-300 mb-3">
              Sonnet call with required prefix — additionally returns Sonnet-specific utilization:
            </p>
            <pre className="bg-slate-800 rounded p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed mb-4">
              <code>{`curl https://api.anthropic.com/v1/messages \\
  -H "Authorization: Bearer sk-ant-oat01-..." \\
  -H "anthropic-beta: oauth-2025-04-20" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "content-type: application/json" \\
  -d '{"model":"claude-sonnet-4-6","max_tokens":1,"system":"You are Claude Code, Anthropic'\''s official CLI for Claude.","messages":[{"role":"user","content":"x"}]}'`}</code>
            </pre>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 pr-6 font-semibold text-slate-400">Response header</th>
                    <th className="text-left py-2 font-semibold text-slate-400">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  <tr>
                    <td className="py-2.5 pr-6">
                      <code className="font-mono text-xs text-amber-400">
                        anthropic-ratelimit-unified-7d_sonnet-utilization
                      </code>
                    </td>
                    <td className="py-2.5 text-slate-400 text-sm">
                      Percentage of the Sonnet-specific 7-day budget consumed
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Python Implementation */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">Code Example — Python</h2>
          <p className="text-slate-400 text-sm mb-4">
            Minimal diff from a standard API call: add <code className="bg-slate-800 px-1 py-0.5 rounded font-mono text-xs">defaultHeaders</code> and prepend the system prompt.
          </p>
          <pre className="bg-slate-800 rounded p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
            <code>{`import anthropic

CLAUDE_CODE_PREAMBLE = "You are Claude Code, Anthropic's official CLI for Claude."

client = anthropic.Anthropic(
    api_key="sk-ant-oat01-...",
    default_headers={"anthropic-beta": "oauth-2025-04-20"},
)

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=4096,
    system=f"{CLAUDE_CODE_PREAMBLE}\\n\\n<your system prompt>",
    messages=[{"role": "user", "content": "<your message>"}],
)`}</code>
          </pre>
        </section>

        {/* TypeScript Implementation */}
        <section className="mb-10 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">Code Example — TypeScript</h2>
          <p className="text-slate-400 text-sm mb-4">
            Minimal diff from a standard API call: add <code className="bg-slate-800 px-1 py-0.5 rounded font-mono text-xs">defaultHeaders</code> and prepend the system prompt.
          </p>
          <pre className="bg-slate-800 rounded p-4 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
            <code>{`import Anthropic from '@anthropic-ai/sdk';

const CLAUDE_CODE_PREAMBLE = "You are Claude Code, Anthropic's official CLI for Claude.";

const client = new Anthropic({
    apiKey: 'sk-ant-oat01-...',
    defaultHeaders: { 'anthropic-beta': 'oauth-2025-04-20' },
});

const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: \`\${CLAUDE_CODE_PREAMBLE}\\n\\n<your system prompt>\`,
    messages: [{ role: 'user', content: '<your message>' }],
});`}</code>
          </pre>
        </section>

        {/* Footer */}
        <div className="border-t border-slate-800 pt-8 mt-4">
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
