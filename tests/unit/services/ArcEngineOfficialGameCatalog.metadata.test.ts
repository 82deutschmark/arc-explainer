/**
 * Author: GPT-5.2
 * Date: 2026-02-02T00:00:00Z
 * PURPOSE: Unit tests for official ARCEngine game metadata parsing. Ensures the ARC3 landing page
 *          does not show fabricated titles/descriptions by only promoting upstream-provided text
 *          (PURPOSE headers, sidecar markdown headers, and ArcEngine CHANGELOG entries).
 * SRP/DRY check: Pass - focused on pure parsing helpers only.
 */

import { describe, expect, it } from 'vitest';

import { __testOnly } from '../../../server/services/arc3Community/ArcEngineOfficialGameCatalog';

describe('ArcEngineOfficialGameCatalog metadata parsing', () => {
  it('extracts a clean title from a standard PURPOSE line', () => {
    const title = __testOnly.parseTitleFromPurposeLine('ws01 - World Shifter. The world moves around you.', 'ws01');
    expect(title).toBe('World Shifter');
  });

  it('strips trailing "puzzle" from titles', () => {
    const title = __testOnly.parseTitleFromPurposeLine('gw01 - Gravity Well puzzle. Control gravity.', 'gw01');
    expect(title).toBe('Gravity Well');
  });

  it('refuses to promote "variant" PURPOSE lines into titles', () => {
    const title = __testOnly.parseTitleFromPurposeLine(
      'WS02 game - variant of LS20/WS01 with new color palette (Light Blue/Yellow/Green theme)',
      'ws02',
    );
    expect(title).toBeNull();
  });

  it('parses official preview descriptions from ArcEngine CHANGELOG bullet lines', () => {
    const content = [
      '- `ls20.py` - Shape-matching navigation puzzle (7 levels, 4 actions)',
      '- `ft09.py` - Color-cycling constraint satisfaction (6 levels, 6 actions)',
    ].join('\n');

    const parsed = __testOnly.parseChangelogDescriptionsFromText(content);
    expect(parsed.ls20).toBe('Shape-matching navigation puzzle (7 levels, 4 actions)');
    expect(parsed.ft09).toBe('Color-cycling constraint satisfaction (6 levels, 6 actions)');
  });
});

