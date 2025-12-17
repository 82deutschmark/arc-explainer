/**
 * Author: Cascade
 * Date: 2025-12-17
 * PURPOSE: Collapsible "How the Official Testing Harness Works" section for the union-accuracy page.
 *          Extracted to keep the page file small and focused.
 * SRP/DRY check: Pass - Presentational accordion + educational content.
 */

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TinyGrid } from '@/components/puzzle/TinyGrid';
import { ProviderSystemPromptsPanel } from '@/components/huggingFaceUnionAccuracy/ProviderSystemPromptsPanel';

export const HarnessDetailsAccordion: React.FC = () => {
  const [showHarnessDetails, setShowHarnessDetails] = useState(true);

  return (
    <Card className="shadow-sm border-purple-100">
      <div
        onClick={() => setShowHarnessDetails(!showHarnessDetails)}
        className="p-2 cursor-pointer hover:bg-purple-50 transition-colors flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <div className="text-base font-semibold text-purple-700">🔬 How the Official Testing Harness Works</div>
        </div>
        {showHarnessDetails ? (
          <ChevronUp className="h-4 w-4 text-purple-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-purple-600" />
        )}
      </div>

      {showHarnessDetails && (
        <CardContent className="p-3 border-t border-purple-100 text-base text-gray-700 leading-relaxed space-y-2">
          <div className="bg-purple-50 p-2 rounded">
            <strong className="text-purple-900">1️⃣ The User Message (No Explicit System Prompt)</strong>
            <p className="text-gray-700 mt-1">
              <strong>Critical distinction:</strong> The harness does NOT send a separate system prompt. Instead, all instructions are embedded in the USER message. The model uses whatever DEFAULT system prompt the provider (OpenAI, Google, Anthropic, etc.) has configured.
            </p>
            <p className="text-gray-700 mt-1">
              The user message begins with: <em>"You are participating in a puzzle solving competition. You are an expert at solving puzzles."</em>
              Then: <em>"Below is a list of input and output pairs with a pattern. Your goal is to identify the pattern or transformation in the training examples that maps the input to the output, then apply that pattern to the test input to give a final output."</em>
              And: <em>"Respond in the format of the training output examples."</em>
            </p>
          </div>

          <div className="bg-purple-50 p-2 rounded">
            <strong className="text-purple-900">2️⃣ Training Examples</strong>
            <p className="text-gray-700 mt-1">
              Next, the harness sends the model several training examples. Each example shows:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-1 mt-1 text-base">
              <li>An <strong>input</strong> grid of numbers</li>
              <li>The corresponding <strong>output</strong> grid</li>
            </ul>
            <p className="text-gray-700 mt-1">
              Both are formatted as <strong>raw JSON arrays</strong> (structured data). The numbers are integers, and the model receives them purely as data. For example, a 3×3 grid looks like: <code className="bg-white px-1 py-0.5 rounded border border-gray-300">{`[[0, 1, 2], [3, 4, 5], [6, 7, 8]]`}</code>
            </p>

            {/* Visual vs Text Representation */}
            <div className="bg-white rounded p-2 border border-purple-200 mt-2">
              <div className="text-base text-gray-600 font-semibold mb-2">What humans see vs what the model sees:</div>
              <div className="grid grid-cols-2 gap-2">
                {/* Human View */}
                <div>
                  <div className="text-base font-semibold text-gray-700 mb-1">👁️ What YOU see (colored grid):</div>
                  <div style={{ maxWidth: '120px', margin: '0 auto' }}>
                    <TinyGrid grid={[[0, 1, 2], [3, 4, 5], [6, 7, 8]]} />
                  </div>
                </div>

                {/* Model View */}
                <div>
                  <div className="text-base font-semibold text-gray-700 mb-1">🤖 What the MODEL sees (text):</div>
                  <code className="block bg-gray-900 text-green-400 p-2 rounded text-base font-mono overflow-x-auto">
                    {`[[0, 1, 2],
 [3, 4, 5],
 [6, 7, 8]]`}
                  </code>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded p-2 mt-2 text-base text-amber-900">
                <strong>Critical insight:</strong> While humans interpret this colored grid intuitively, the model sees <strong>only plain text</strong>—numbers in brackets.
              </div>

              <div className="mt-2 text-base text-gray-700 leading-relaxed">
                <p><strong>What information does the model actually receive?</strong></p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>The user message tells it there's a "pattern" to find</li>
                  <li>It sees training input/output pairs as JSON arrays</li>
                  <li>It sees a test input without an answer</li>
                  <li>That's <strong>it</strong>. No information about colors, no hints about geometry, no explanation of what the numbers represent.</li>
                </ul>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-2 mt-2 text-base text-blue-900">
                <strong>Why this matters:</strong> This is the sort of thing we discuss in our Discord server. Please come visit us at{' '}
                <a
                  href="https://discord.gg/9b77dPAmcA"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-blue-700 underline hover:text-blue-800"
                >
                  The Offical ARC-AGI Prize Discord server
                </a>
                .
              </div>
            </div>

            <p className="text-gray-700 mt-2">
              Each training example shows the model how inputs map to outputs.
            </p>
          </div>

          <div className="bg-purple-50 p-2 rounded">
            <strong className="text-purple-900">3️⃣ The Test Input</strong>
            <p className="text-gray-700 mt-1">
              After showing the training examples, the harness presents a <strong>test input</strong> — a single grid (also in JSON format) with no answer attached.
              The model must look at the training examples and predict what the output grid should be.
            </p>
          </div>

          <div className="bg-purple-50 p-2 rounded">
            <strong className="text-purple-900">4️⃣ How the Message is Sent</strong>
            <p className="text-gray-700 mt-1">
              Everything — the instructions, all training examples, and the test input — is packaged into <strong>one single USER message</strong> sent to the model.
              <strong> No system prompt is sent.</strong>
            </p>
            <p className="text-gray-700 mt-1">
              The model receives this complete context in one go and must respond with its predicted output grid. This happens twice per puzzle (attempt 1 and attempt 2)
              with fresh, independent runs so the model can try different reasoning strategies.
            </p>
          </div>

          <div className="bg-purple-50 p-2 rounded">
            <strong className="text-purple-900">5️⃣ The Model's Response</strong>
            <p className="text-gray-700 mt-1">
              The model generates its predicted output as a grid in JSON format. The harness then <strong>extracts this grid answer</strong> from the model's response
              and compares it exactly to the ground truth answer for that puzzle.
            </p>
          </div>

          <div className="bg-purple-50 p-2 rounded">
            <strong className="text-purple-900">6️⃣ Scoring: Did the Model Get It Right?</strong>
            <p className="text-gray-700 mt-1">
              For each puzzle, the harness checks every <strong>test pair</strong>:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-1 mt-1 text-base">
              <li>Does the model's <strong>attempt 1 output exactly match</strong> the ground-truth output for that test pair?</li>
              <li>Does the model's <strong>attempt 2 output exactly match</strong> the same ground-truth output?</li>
            </ul>
            <p className="text-gray-700 mt-1">
              <strong>A test pair counts as correct if either attempt is correct.</strong> A puzzle's score is the fraction of its test pairs solved, and the dataset score is the average of puzzle scores (each puzzle weighted equally).
            </p>
          </div>

          <div className="border-t border-purple-200 pt-2 mt-2 text-base text-gray-500">
            <p>
              <strong>About this explanation:</strong> Most text this page was written by Claude Haiku 4.5 after A lot of back-and-forth with the human who maintains this project.
            </p>
          </div>

          {/* Provider prompts panel is now an extracted component with its own fetching logic */}
          <ProviderSystemPromptsPanel />
        </CardContent>
      )}
    </Card>
  );
};
