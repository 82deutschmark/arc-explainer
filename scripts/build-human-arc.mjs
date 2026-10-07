/**
 * Author: Codex
 * Date: 2026-10-07
 * PURPOSE: Build and serve the independently maintained Human ARC frontend under /human-arc/.
 * SRP/DRY check: Pass — separate build and middleware reuse the existing deployment and navigation.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = JSON.parse(readFileSync(path.join(root, 'human-arc-source.json'), 'utf8'));
if (!/^[a-f0-9]{40}$/.test(source.commit)) throw new Error('Human ARC source must be pinned to a full commit');
const checkout = path.join(root, 'external/human-arc');
const run = (command, args, cwd = checkout, env = process.env) =>
  execFileSync(command, args, { cwd, env, stdio: 'inherit' });
mkdirSync(checkout, { recursive: true });
if (!existsSync(path.join(checkout, '.git'))) {
  run('git', ['init']);
  run('git', ['remote', 'add', 'origin', source.repository]);
}
run('git', ['fetch', '--depth', '1', 'origin', source.commit]);
run('git', ['checkout', '--detach', source.commit]);
run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
// Only the public title ID belongs in a client bundle. Never inherit an admin secret.
run('npm', ['run', 'build'], checkout, {
  ...process.env,
  HARC_BASE_PATH: '/human-arc/',
  VITE_PLAYFAB_TITLE_ID: source.playfabTitleId,
  VITE_PLAYFAB_SECRET_KEY: '',
  VITE_ARC_EXPLAINER_URL: 'https://arc.markbarney.net',
});
const target = path.join(root, 'dist/human-arc');
rmSync(target, { recursive: true, force: true });
cpSync(path.join(checkout, 'dist'), target, { recursive: true });
console.log(`Human ARC built from ${source.commit} at /human-arc/`);
