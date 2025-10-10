/**
 * scripts/backfill-grover-logs.ts
 *
 * Author: Codex using GPT-5-high
 * Date: 2025-10-09
 *
 * PURPOSE:
 * Utility script (initial dry-run version) that scans Grover Python log folders,
 * extracts attempt metadata, and prints the reconstructed predictions that would
 * be used for database backfill. Future iterations will plug the parsed payloads
 * into explanationService for persistence.
 *
 * USAGE:
 *   npx ts-node scripts/backfill-grover-logs.ts --task 0934a4d8 --limit 1 --dry-run
 *
 * CLI FLAGS:
 *   --root   : Optional path to Grover logs directory (default solver/grover-arc/logs)
 *   --task   : Optional puzzle hash to filter (can be specified multiple times)
 *   --limit  : Optional maximum number of run directories to process
 *   --dry-run: When present (default), prints summary instead of writing to DB
 *   --verbose: Print full attempt breakdown instead of concise summary
 */

import fs from 'fs';
import path from 'path';

type AttemptSummary = {
  index: number;
  timestamp: string | null;
  trainingMatches: boolean | null;
  testMatches: boolean | null;
  predictedGrid: number[][] | null;
  grade: number | null;
  gradeRaw: string | null;
  summaryText: string[];
  programPath?: string;
};

type ParsedRun = {
  taskId: string;
  timestamp: string;
  attempts: AttemptSummary[];
};

function parseBoolean(raw: string | undefined): boolean | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function parseGridLines(lines: string[]): number[][] | null {
  if (!lines.length) return null;
  const rows: number[][] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) continue;
    try {
      const row = JSON.parse(trimmed);
      if (Array.isArray(row) && row.every((cell) => Number.isInteger(cell))) {
        rows.push(row);
      }
    } catch (error) {
      // Ignore parse errors; malformed rows will be skipped.
    }
  }
  return rows.length ? rows : null;
}

function parseLogFile(logPath: string): AttemptSummary[] {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const attempts: AttemptSummary[] = [];

  let captureSuccess = false;
  let lastSuccessRows: string[] = [];

  const successMarker = '=== Execution Success ===';
  const summaryMarker = '=== Execution Summary ===';
  const stageSummaryMarker = '=== Stage DSL Extrapolate) ===';
  const gradePrefix = 'MARK ATTEMPT GRADE:';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith(successMarker)) {
      captureSuccess = true;
      lastSuccessRows = [];
      continue;
    }

    if (captureSuccess) {
      if (line.startsWith('===') && !line.startsWith(successMarker)) {
        captureSuccess = false;
      } else if (line.trim().startsWith('[') && line.trim().endsWith(']')) {
        lastSuccessRows.push(line.trim());
      }
    }

    if (line.startsWith(summaryMarker)) {
      const summary: AttemptSummary = {
        index: attempts.length,
        timestamp: null,
        trainingMatches: null,
        testMatches: null,
        predictedGrid: parseGridLines(lastSuccessRows),
        grade: null,
        gradeRaw: null,
        summaryText: [],
      };

      if (i + 1 < lines.length) {
        const trainingLine = lines[i + 1];
        const match = trainingLine.match(/^\[(.+?)\]\s+All training matches:\s+(True|False)/i);
        if (match) {
          summary.timestamp = match[1];
          summary.trainingMatches = parseBoolean(match[2]);
        }
      }

      if (i + 2 < lines.length) {
        const testLine = lines[i + 2];
        const match = testLine.match(/Test matches:\s+(True|False)/i);
        if (match) {
          summary.testMatches = parseBoolean(match[1]);
        }
      }

      attempts.push(summary);

      // Advance iterator past training/test lines we just consumed.
      i += 2;

      // Look for Stage DSL block following summary to capture text and grade.
      let stageIndex = i + 1;
      while (stageIndex < lines.length) {
        const stageLine = lines[stageIndex];
        if (stageLine.startsWith(summaryMarker) || stageLine.startsWith(successMarker)) {
          break;
        }
        if (stageLine.startsWith(stageSummaryMarker)) {
          const summaryLines: string[] = [];
          stageIndex++;
          while (stageIndex < lines.length) {
            const stageContentLine = lines[stageIndex];
            if (stageContentLine.startsWith('===')) {
              // Encountered next block start.
              stageIndex--;
              break;
            }
            summaryLines.push(stageContentLine);
            if (stageContentLine.startsWith(gradePrefix)) {
              const gradeMatch = stageContentLine.match(/MARK ATTEMPT GRADE:\s*([0-9X]+)\/10/i);
              if (gradeMatch) {
                summary.gradeRaw = gradeMatch[1];
                const value = Number.parseInt(gradeMatch[1], 10);
                summary.grade = Number.isFinite(value) ? value : null;
              }
            }
            stageIndex++;
          }
          summary.summaryText = summaryLines.filter((entry) => entry.trim().length > 0);
          break;
        }
        stageIndex++;
      }
    }
  }

  return attempts;
}

function attachProgramFiles(runDir: string, attempts: AttemptSummary[]): void {
  const programFiles = fs
    .readdirSync(runDir)
    .filter((file) => file.startsWith('generated_program_') && file.endsWith('.py'))
    .sort();

  if (!programFiles.length) return;

  attempts.forEach((attempt, index) => {
    if (index < programFiles.length) {
      attempt.programPath = path.join(runDir, programFiles[index]);
    }
  });
}

function parseRunDirectory(taskId: string, runDir: string): ParsedRun | null {
  const logPath = path.join(runDir, 'log.txt');
  if (!fs.existsSync(logPath)) {
    return null;
  }

  const attempts = parseLogFile(logPath);
  attachProgramFiles(runDir, attempts);

  const timestamp = path.basename(runDir);

  return { taskId, timestamp, attempts };
}

function selectAttempt(attempts: AttemptSummary[]): AttemptSummary | null {
  if (!attempts.length) return null;
  const exactMatch = [...attempts].reverse().find((attempt) => attempt.testMatches === true);
  return exactMatch ?? attempts[attempts.length - 1];
}

type CliOptions = {
  rootDir: string;
  taskFilters: Set<string> | null;
  limit: number | null;
  dryRun: boolean;
  verbose: boolean;
};

function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    rootDir: path.join(process.cwd(), 'solver', 'grover-arc', 'logs'),
    taskFilters: null,
    limit: null,
    dryRun: true,
    verbose: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root' && argv[i + 1]) {
      options.rootDir = path.resolve(argv[i + 1]);
      i++;
    } else if (arg === '--task' && argv[i + 1]) {
      if (!options.taskFilters) {
        options.taskFilters = new Set<string>();
      }
      options.taskFilters.add(argv[i + 1]);
      i++;
    } else if (arg === '--limit' && argv[i + 1]) {
      const limit = Number.parseInt(argv[i + 1], 10);
      if (Number.isFinite(limit) && limit > 0) {
        options.limit = limit;
      }
      i++;
    } else if (arg === '--no-dry-run') {
      options.dryRun = false;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    }
  }

  return options;
}

function printAttemptSummary(run: ParsedRun, attempt: AttemptSummary, options: CliOptions): void {
  const header = `${run.taskId}/${run.timestamp} -> attempt #${attempt.index}`;
  const status = attempt.testMatches === true ? 'CORRECT' : 'INCORRECT';
  console.log(`\n${header}`);
  console.log(`  Result: ${status}`);
  if (attempt.timestamp) {
    console.log(`  Logged at: ${attempt.timestamp}`);
  }
  if (attempt.gradeRaw) {
    console.log(`  Grade: ${attempt.gradeRaw}/10`);
  }
  if (attempt.predictedGrid) {
    console.log('  Predicted grid:');
    attempt.predictedGrid.forEach((row) => console.log(`    ${JSON.stringify(row)}`));
  } else {
    console.log('  Predicted grid: <missing>');
  }
  if (attempt.programPath) {
    console.log(`  Program file: ${attempt.programPath}`);
  } else {
    console.log('  Program file: <unknown>');
  }

  if (options.verbose && attempt.summaryText.length) {
    console.log('  Summary excerpt:');
    attempt.summaryText.slice(0, 12).forEach((line) => console.log(`    ${line}`));
    if (attempt.summaryText.length > 12) {
      console.log('    ...');
    }
  }
}

function main(): void {
  const options = parseCliArgs(process.argv);

  if (!fs.existsSync(options.rootDir)) {
    console.error(`Grover logs directory not found: ${options.rootDir}`);
    process.exit(1);
  }

  const taskDirs = fs
    .readdirSync(options.rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const tasksToProcess = options.taskFilters
    ? taskDirs.filter((task) => options.taskFilters?.has(task))
    : taskDirs;

  if (!tasksToProcess.length) {
    console.log('No Grover log directories match the provided filters.');
    return;
  }

  let processedRuns = 0;

  for (const taskId of tasksToProcess) {
    if (options.limit !== null && processedRuns >= options.limit) {
      break;
    }

    const puzzleDir = path.join(options.rootDir, taskId);
    const runDirs = fs
      .readdirSync(puzzleDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    for (const runTimestamp of runDirs) {
      if (options.limit !== null && processedRuns >= options.limit) {
        break;
      }

      const runPath = path.join(puzzleDir, runTimestamp);
      const parsedRun = parseRunDirectory(taskId, runPath);
      if (!parsedRun) {
        continue;
      }

      const selected = selectAttempt(parsedRun.attempts);
      if (!selected) {
        continue;
      }

      printAttemptSummary(parsedRun, selected, options);
      processedRuns++;
    }
  }

  console.log(`\nProcessed ${processedRuns} run(s). Mode: ${options.dryRun ? 'dry-run' : 'execute'}.`);
}

main();
