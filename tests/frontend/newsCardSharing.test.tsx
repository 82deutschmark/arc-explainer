/**
 * Author: GPT-6 / Codex; Claude Sonnet 5.5
 * Date: 2026-10-30
 * PURPOSE: Exercise the actual card sharing controls with the installed frontend
 *          test setup, including clipboard success and a selectable URL when copying fails.
 * SRP/DRY check: Pass — renders the production card and uses its real collection contract.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Router } from 'wouter';
import { afterEach, expect, it, vi } from 'vitest';
import { CopyCardLink } from '../../client/src/pages/NewsCards';
import type { CollectionCard } from '../../shared/newsCollection';
import { SITE_ORIGIN } from '../../shared/seo';

const card: CollectionCard = {
  id: 'person-mark-barney-2026', number: 'P018', kind: 'person', name: 'Mark Barney',
  season: '2026', personId: 'mark-barney', cardUrl: '/news/cards/person-mark-barney-2026',
  profileUrl: '/news/people/mark-barney', art: null, description: '', highlights: [],
  accounts: [], entries: [], honors: [], artNotes: [], teamHistory: [], role: 'competitor', pastCards: [], stories: [], career: null,
};
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
afterEach(() => {
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else Reflect.deleteProperty(navigator, 'clipboard');
});
function showCard(writeText: (value: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(<Router><CopyCardLink card={card} /></Router>);
}

it('copies the permanent card URL and confirms completion', async () => {
  const writeText = vi.fn<(value: string) => Promise<void>>().mockResolvedValue(undefined);
  showCard(writeText);
  fireEvent.click(screen.getByRole('button', { name: 'Copy Mark Barney card link' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Link copied'));
  expect(writeText).toHaveBeenCalledExactlyOnceWith(`${SITE_ORIGIN}${card.cardUrl}`);
});

it('offers a selectable permanent URL when clipboard access is denied', async () => {
  showCard(async () => { throw new Error('Clipboard access denied'); });
  fireEvent.click(screen.getByRole('button', { name: 'Copy Mark Barney card link' }));
  const field = await screen.findByRole('textbox', { name: 'Mark Barney card link' });
  expect(field).toHaveValue(`${SITE_ORIGIN}${card.cardUrl}`);
  expect(field).toHaveAttribute('readonly');
  expect(screen.getByRole('status')).toHaveTextContent('Select and copy this link:');
});
