/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-22
 * PURPOSE: Validate the private summit document and share its types/filtering with the
 *          reader. Contains no attendee data; the document stays in the protected database.
 * SRP/DRY check: Pass - one content contract for publishing and rendering.
 */
import { z } from 'zod';

const text = z.string().trim().min(1).max(5000);
const source = z.object({ label: text, url: z.string().url().refine(value => value.startsWith('https://'), 'Use HTTPS links') });
export const summitPersonSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,80}$/), name: text, role: text, work: text,
  topics: z.array(text).min(1).max(8), audience: z.array(z.enum(['mark', 'son'])).min(1),
  connection: z.object({ mark: text, son: text }), question: text, followUp: text,
  sources: z.array(source).min(1).max(8), familiar: z.boolean().default(false),
  attendance: z.enum(['registered', 'speaker']),
  mlst: z.object({ kind: z.enum(['appearance', 'theme']), note: text, link: source.optional() }).optional(),
});
export const summitGuideSchema = z.object({
  version: z.literal(1), updatedAt: z.string().datetime(), title: text, intro: text,
  event: z.object({ date: text, time: text, location: text, url: z.string().url() }),
  people: z.array(summitPersonSchema).min(1).max(60),
  mlst: z.object({ intro: text, sources: z.array(source).min(1), themes: z.array(z.object({ title: text, explanation: text, people: z.array(z.string()) })) }),
  ourWork: z.object({ introduction: text, points: z.array(z.object({ title: text, explanation: text })), terms: z.array(z.object({ term: text, meaning: text })), sources: z.array(source) }),
}).superRefine((guide, context) => {
  const ids = new Set(guide.people.map(person => person.id));
  if (ids.size !== guide.people.length) context.addIssue({ code: 'custom', message: 'Person IDs must be unique', path: ['people'] });
  for (const [index, theme] of guide.mlst.themes.entries()) {
    if (theme.people.some(id => !ids.has(id))) context.addIssue({ code: 'custom', message: 'Unknown person in MLST theme', path: ['mlst', 'themes', index] });
  }
});
export type SummitGuide = z.infer<typeof summitGuideSchema>;
export type SummitPerson = z.infer<typeof summitPersonSchema>;
export interface SummitSelection { search: string; audience: 'all' | 'mark' | 'son'; topic: string; view: 'new' | 'all' | 'saved' | 'mlst' | 'met'; saved: string[]; met: string[] }
export function selectSummitPeople(people: SummitPerson[], selection: SummitSelection): SummitPerson[] {
  const words = selection.search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/\s+/).filter(Boolean);
  return people.filter(person => {
    if (selection.audience !== 'all' && !person.audience.includes(selection.audience)) return false;
    if (selection.topic && !person.topics.includes(selection.topic)) return false;
    if (selection.view === 'new' && person.familiar) return false;
    if (selection.view === 'saved' && !selection.saved.includes(person.id)) return false;
    if (selection.view === 'met' && !selection.met.includes(person.id)) return false;
    if (selection.view === 'mlst' && person.mlst?.kind !== 'appearance') return false;
    const haystack = [person.name, person.role, person.work, person.topics.join(' '), person.connection.mark, person.connection.son, person.mlst?.note ?? ''].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return words.every(word => haystack.includes(word));
  });
}
