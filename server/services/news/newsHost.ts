/**
 * Author: GPT-6 / Codex (reasoning effort not exposed)
 * Date: 02-November-2026
 * PURPOSE: Prepare the proposed Goose hostname's front door on the existing
 * application. DNS/TLS remain separate; existing ARC routes and canonical URLs
 * stay in place until the documented domain cutover is completed.
 * SRP/DRY check: Pass — route to the same newspaper instead of cloning the site.
 */
import type { Express } from 'express';
import domain from '../../../shared/newsDomain.json';
export function mountNewsHost(app: Express) {
  app.get('/', (req, res, next) => {
    const host = req.get('host')?.split(':')[0].toLowerCase();
    if (host !== domain.hostname) return next();
    res.set('Cache-Control', 'no-store').redirect(302, '/news' + req.url.slice(1));
  });
}
