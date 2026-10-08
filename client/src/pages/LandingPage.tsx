/**
 * Author: GPT-6.1 Sol / Codex; Codex
 * Date: 2026-10-07
 * PURPOSE: Directory of playable ARC tools, game guides and recorded results.
 * SRP/DRY check: Pass — reuses shared Card components and router links.
 */
import { ROUTE_META_TAGS } from '@shared/routes';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Resource = { title: string; href: string; description: string; fullPage?: boolean };
const sections: { title: string; description: string; resources: Resource[] }[] = [
  {
    title: 'Play and learn',
    description: 'Hands-on puzzles for curious beginners and experienced ARC players.',
    resources: [
      { title: 'Human ARC', href: '/human-arc/', fullPage: true, description: 'Draw solutions, take a puzzle assessment and review your results using an anonymous player profile.' },
      { title: 'Space Force Mission Control', href: 'https://sfmc.markbarney.net/', fullPage: true, description: 'A mission-based introduction to pattern puzzles, with a space theme for younger players and curious beginners.' },
      { title: 'ARC puzzle browser', href: '/browser', description: 'Explore ARC-AGI-1 and ARC-AGI-2 tasks, examples and recorded model explanations.' },
      { title: 'Test a solution', href: '/test-solution', description: 'Check your predicted output against a known ARC puzzle.' },
    ],
  },
  {
    title: 'ARC-AGI-3',
    description: 'Understand the interactive benchmark, explore games and inspect published results. Public game guides teach the interface and known games; the private set has different mechanics.',
    resources: [
      { title: 'Official game guides', href: '/arc3/games', description: 'Per-level explanations, pictures and play notes for the 25 public games, plus separately labeled preview history.' },
      { title: 'Human and AI results', href: '/human-records.html', fullPage: true, description: 'Compare dated published human records and AI runs, with scores, actions and replay links.' },
      { title: 'Community games', href: '/arc3/gallery', description: 'Play original community tasks built on ARCEngine. Discover the rules through interaction.' },
      { title: 'Kaggle leaderboard', href: '/kaggle-leaderboard', description: 'Explore public competition standings. Public standings are not final private results.' },
      { title: 'ARC-AGI-3 background', href: '/arc3', description: 'Benchmark history, scoring and links to official sources.' },
    ],
  },
  {
    title: 'Results archives and research tools',
    description: 'Explore recorded results. The Hugging Face import is an archive, not a feed of the latest official results.',
    resources: [
      { title: 'Hugging Face results archive', href: '/analytics', description: 'Charts, dataset coverage and model comparisons built from imported ARC Prize records.' },
      { title: 'ARC-1 and ARC-2 scoring', href: '/scoring', description: 'Combine stored attempts and inspect dataset scores, coverage and available costs.' },
      { title: 'Model comparison', href: '/model-comparison', description: 'Compare recorded attempts and puzzle-level outcomes for selected models.' },
      { title: 'RE-ARC', href: '/re-arc', description: 'Generate additional ARC-style evaluation tasks and validate submissions.' },
      { title: 'Worm Arena', href: '/worm-arena', description: 'Watch archived model matches and inspect replays from a separate game environment.' },
      { title: 'Contributor profiles', href: '/hall-of-fame', description: 'People and projects in the ARC community, including dated historical results.' },
    ],
  },
];

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-10 max-w-3xl space-y-3">
        <p className="text-sm font-medium text-muted-foreground">ARC Explainer</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Resource Hub</h1>
        <p className="text-lg text-muted-foreground">Games to play, guides to learn from, and results you can explore.</p>
        <p className="text-sm text-muted-foreground">An independent community project by Mark Barney. For official releases and competition rules, visit <a className="underline underline-offset-4" href="https://arcprize.org/">ARC Prize</a>.</p>
      </header>
      <div className="space-y-10">
        {sections.map(section => (
          <section key={section.title} aria-label={section.title}>
            <h2 className="text-2xl font-semibold">{section.title}</h2>
            <p className="mb-5 mt-2 max-w-3xl text-muted-foreground">{section.description}</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {section.resources.map(resource => (
                <Card key={resource.href} className="h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">
                      {resource.fullPage ? <a href={resource.href} className="underline-offset-4 hover:underline">{resource.title} →</a> : <Link href={resource.href} className="underline-offset-4 hover:underline">{resource.title} →</Link>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{resource.description}</CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
      <nav aria-label="All public sections" className="mt-10 border-t pt-6">
        <h2 className="text-xl font-semibold">Explore all public sections</h2>
        <ul className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(ROUTE_META_TAGS).filter(([, meta]) => !meta.noindex).map(([href, meta]) => (
            <li key={href}><Link href={href} className="underline underline-offset-4">{meta.title.replace(/ \| ARC Explainer$/, '')}</Link></li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
