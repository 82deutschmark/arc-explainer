/**
 * Author: Claude Opus 5.5
 * Date: 14-Nov-2026
 * PURPOSE: The production page middleware wrapped around the source SPA shell (client/index.html),
 *          so route tests exercise real server-rendered pages without first running a production
 *          build. client/index.html is the file Vite builds into dist/public/index.html and carries
 *          the same META_TAGS markers and root element that injectPageHtml fills.
 * SRP/DRY check: Pass — reuses createMetaTagInjector from server/middleware/metaTagInjector.ts.
 */
import path from 'node:path';
import { createMetaTagInjector } from '../../server/middleware/metaTagInjector';

export const SOURCE_PAGE_SHELL = path.resolve('client/index.html');
export const sourceShellMetaTagInjector = createMetaTagInjector(() => SOURCE_PAGE_SHELL);
