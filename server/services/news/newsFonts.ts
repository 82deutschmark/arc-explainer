/**
 * Author: GPT-6 / Codex (reasoning effort not exposed)
 * Date: 02-November-2026
 * PURPOSE: Serve the paper's existing licensed font files to its browser layout.
 * Keep card and page typography on the same local assets, with a fixed allowlist.
 * SRP/DRY check: Pass — no duplicate font copies or external font dependency.
 */
import type { Express } from 'express';
import path from 'node:path';
const files = new Set(['AlfaSlabOne-Regular.ttf', 'IBMPlexSerif-Regular.ttf', 'IBMPlexSerif-Bold.ttf', 'IBMPlexMono-Regular.ttf', 'IBMPlexMono-Medium.ttf', 'IBMPlexSansCondensed-Bold.ttf', 'OFL-alfaslabone.txt', 'OFL-IBMPlexSerif.txt', 'OFL-ibmplexmono.txt', 'OFL-IBMPlexSansCondensed.txt']);
export function mountNewsFonts(app: Express) {
  app.get('/api/news/fonts/:file', (req, res) => {
    if (!files.has(req.params.file)) return res.sendStatus(404);
    res.sendFile(path.resolve('server/assets/fonts/news-card', req.params.file), { maxAge: 86400000 });
  });
}
