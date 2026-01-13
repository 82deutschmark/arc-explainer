/*
Author: Cascade (ChatGPT)
Date: 2026-01-10
PURPOSE: Sequentially ping every OpenRouter `:free` catalog model (minus known retirements) with a playful prompt, throttling requests and persisting a full text log of replies/errors for pruning analysis.
SRP/DRY check: Pass — single-purpose diagnostic script that reuses catalog data without duplicating solver logic.
*/

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const CATALOG_PATH = path.join(PROJECT_ROOT, 'server', 'config', 'openrouter-catalog.json');
const LOG_DIR = path.join(PROJECT_ROOT, 'logs');
const RETIRED_FREE_MODELS = new Set<string>(['nex-agi/deepseek-v3.1-nex-n1:free']);
const DEFAULT_HEADERS = {
  'HTTP-Referer': 'https://arc.markbarney.net',
  'X-Title': 'ARC Explainer Free Model Health Check',
};

type CatalogModel = {
  id?: string;
};

type PingResult = {
  model: string;
  ok: boolean;
  responseSnippet?: string;
  errorMessage?: string;
  errorDetectedInText?: boolean;
};

function loadFreeModelSlugs(): string[] {
  if (!fs.existsSync(CATALOG_PATH)) {
    throw new Error(`OpenRouter catalog not found at ${CATALOG_PATH}`);
  }
  const raw = fs.readFileSync(CATALOG_PATH, 'utf-8');
  const parsed = JSON.parse(raw) as { models?: CatalogModel[] };
  const ids = parsed.models?.map((entry) => entry.id).filter((id): id is string => Boolean(id)) ?? [];
  const freeIds = Array.from(
    new Set(ids.filter((id) => id.endsWith(':free') && !RETIRED_FREE_MODELS.has(id)))
  );
  return freeIds.sort();
}

function detectErrorText(text: string | undefined): boolean {
  if (!text) return false;
  return /error|failed|invalid|unavailable|exception/i.test(text);
}

function truncate(text: string, length = 160): string {
  if (text.length <= length) return text;
  return `${text.slice(0, length - 1)}…`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pingModel(client: OpenAI, model: string): Promise<PingResult> {
  try {
    const response = await client.chat.completions.create({
      model,
      max_tokens: 3002,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: 'You are a cyberpunk LLM gangsta rapper on a fuckin next level shit from these other muthafuckas. Reply concisely with a sick flow about who you are, what hood you reppin, and who yo crew be, be sure to include your model name and version',
        },
        {
          role: 'user',
          content: 'Fuck yeah dawg!  Tell the peeps out here why you the mothafuckin king in this digital jungle!! Spit some of that fire!!!',
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    const normalized = Array.isArray(content) ? content.map((chunk) => chunk?.toString?.() ?? '').join(' ') : content ?? '';
    const trimmed = normalized.trim() || '[empty]';
    const errorDetected = detectErrorText(trimmed);

    return {
      model,
      ok: !errorDetected,
      responseSnippet: truncate(trimmed),
      errorDetectedInText: errorDetected,
      errorMessage: errorDetected ? 'Response appears to include an error indicator.' : undefined,
    };
  } catch (error: any) {
    const rawMessage =
      error?.response?.data?.error?.message ??
      error?.response?.data?.error ??
      error?.response?.data?.message ??
      error?.message ??
      String(error);
    return {
      model,
      ok: false,
      errorMessage: rawMessage,
    };
  }
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENROUTER_API_KEY is not set.');
    process.exit(1);
  }

  const freeModels = loadFreeModelSlugs();
  if (freeModels.length === 0) {
    console.log('No `:free` models found in the OpenRouter catalog.');
    return;
  }

  fs.mkdirSync(LOG_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = path.join(LOG_DIR, `openrouter-free-healthcheck-${timestamp}.log`);
  const logLines: string[] = [];
  const log = (line = '') => {
    console.log(line);
    logLines.push(line);
  };

  log(`Pinging ${freeModels.length} OpenRouter free models with a 5s throttle...\n`);

  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: DEFAULT_HEADERS,
    timeout: 5 * 60 * 1000,
  });

  const results: PingResult[] = [];
  for (let index = 0; index < freeModels.length; index += 1) {
    const model = freeModels[index];
    const result = await pingModel(client, model);
    results.push(result);

    if (result.ok) {
      log(`✅ ${result.model}`);
      log(`   ↳ Reply: ${result.responseSnippet}`);
    } else {
      log(`❌ ${result.model}`);
      log(`   ↳ Error: ${result.errorMessage ?? 'Unknown error'}`);
      if (result.responseSnippet) {
        log(`   ↳ Reply: ${result.responseSnippet}`);
      }
    }
    log();

    if (index < freeModels.length - 1) {
      await delay(5000);
    }
  }

  const successes = results.filter((result) => result.ok);
  const failures = results.filter((result) => !result.ok);

  log('\nSummary');
  log('-------');
  log(`Total models:   ${results.length}`);
  log(`Healthy replies: ${successes.length}`);
  log(`Failures:        ${failures.length}`);
  log(`Log file:        ${logPath}`);

  fs.writeFileSync(logPath, `${logLines.join('\n')}\n`, 'utf-8');

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Unexpected failure while running OpenRouter free model health check.');
  console.error(error);
  process.exit(1);
});
