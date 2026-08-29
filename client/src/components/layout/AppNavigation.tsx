/**
 * Author: Claude Opus 5
 * Date: 2026-08-29
 * PURPOSE: ARC-3-forward top navigation. The primary row is the ARC-AGI-3 flow a visitor
 * actually walks -- Play, Submit, About ARC-3 -- matching the root redirect in
 * App.tsx, which already sends "/" to /arc3/gallery. Everything ARC-1/2 collapses into a single
 * sectioned "ARC 1 & 2" dropdown, and SnakeBench/Worm Arena keeps its own "Arena" dropdown
 * because it belongs to neither generation. The right rail carries the two outbound ARC-3 sites
 * (arcprize.org and Son Pham's sibling catalog at arc3.sonpham.net) plus the repo link.
 * No routes changed -- every archived destination is still registered in App.tsx and still
 * reachable by deep link; this file only decides what gets top billing.
 * SRP/DRY check: Pass - single responsibility (navigation structure). Reuses shadcn
 * NavigationMenu/DropdownMenu, including the DropdownMenuLabel and DropdownMenuSeparator
 * primitives already exported by components/ui/dropdown-menu.tsx.
 * CRITICAL: dividers render INSIDE each menu item to keep the Radix hierarchy intact.
 * See docs/2026-08-29-arc3-forward-nav-plan.md.
 */
import React from 'react';
import { Link, useLocation } from 'wouter';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Archive,
  Award,
  Brain,
  CheckCircle,
  CircuitBoard,
  Code,
  Database,
  ExternalLink,
  FileCheck,
  Gamepad2,
  Github,
  Grid3X3,
  Info,
  Layers,
  MessageSquare,
  Trophy,
  Upload,
  Users,
  Wallet,
  Worm,
  Zap,
  BookOpen,
} from 'lucide-react';

// Type definitions for discriminated union
interface NavLink {
  type: 'link';
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  /**
   * Match the location exactly instead of by prefix. Needed wherever a parent route is a
   * sibling of its own children in the nav: without this, /arc3 ("About ARC-3") highlights
   * on /arc3/gallery and /arc3/upload too, so two entries look active at once.
   */
  exact?: boolean;
}

/** A labelled run of links inside a dropdown. Keeps the long archive list scannable. */
interface NavSection {
  label: string;
  items: NavLink[];
}

interface NavDropdown {
  type: 'dropdown';
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  sections: NavSection[];
}

type NavItem = NavLink | NavDropdown;

/** Outbound links. Kept off the main row so leaving the site always looks deliberate. */
interface ExternalNavLink {
  title: string;
  href: string;
  description: string;
}

/**
 * Primary row. ARC-3 first, in use order, then the two collapsed groups.
 * `dividerAfter` marks a group boundary -- the ARC palette squares now separate clusters
 * rather than sitting between every single item, which at 11 top-level entries read as noise.
 */
const navigationItems: (NavItem & { dividerAfter?: string })[] = [
  {
    type: 'link',
    title: 'Play',
    href: '/arc3/gallery',
    icon: Gamepad2,
    description: 'The ARC-AGI-3 game gallery -- official, custom, and community tasks',
  },
  {
    type: 'link',
    title: 'Submit',
    href: '/arc3/upload',
    icon: Upload,
    description: 'Contribute your own ARC-3 game to the community catalog',
  },
  {
    type: 'link',
    title: 'About ARC-3',
    href: '/arc3',
    icon: BookOpen,
    description: 'Why interactive games test reasoning differently than static puzzles',
    exact: true,
    dividerAfter: '🟦',
  },
  {
    type: 'dropdown',
    title: 'ARC 1 & 2',
    icon: Archive,
    description: 'Puzzle-era analysis, scoring, and datasets',
    sections: [
      {
        label: 'Analysis',
        items: [
          {
            type: 'link',
            title: 'Analytics',
            href: '/analytics',
            icon: Database,
            description: 'Model performance analytics across the puzzle datasets',
          },
          {
            type: 'link',
            title: 'Leaderboards',
            href: '/leaderboards',
            icon: Award,
            description: 'Rankings across accuracy, trustworthiness, and feedback',
          },
          {
            type: 'link',
            title: 'Compare',
            href: '/elo',
            icon: Trophy,
            description: 'Head-to-head explanation comparison with ELO ratings',
          },
          {
            type: 'link',
            title: 'Model Comparison',
            href: '/model-comparison',
            icon: Layers,
            description: 'Side-by-side model results on the same tasks',
          },
        ],
      },
      {
        label: 'Datasets & Scoring',
        items: [
          {
            type: 'link',
            title: 'Official Scoring',
            href: '/scoring',
            icon: Zap,
            description: 'Public evaluation set results, two attempts per puzzle',
          },
          {
            type: 'link',
            title: 'RE-ARC',
            href: '/re-arc',
            icon: CircuitBoard,
            description: 'Generate unique evaluation datasets and validate submissions',
          },
          {
            type: 'link',
            title: 'Dataset Viewer',
            href: '/dataset-viewer',
            icon: Database,
            description: 'Open or drop any dataset to inspect contents and metadata',
          },
          {
            type: 'link',
            title: 'Kaggle Readiness',
            href: '/kaggle-readiness',
            icon: FileCheck,
            description: 'Validate your ARC Kaggle competition readiness',
          },
        ],
      },
      {
        label: 'Explore',
        items: [
          {
            type: 'link',
            title: 'Resource Hub',
            href: '/home',
            icon: Grid3X3,
            description: 'The original puzzle-browser landing page',
          },
          {
            type: 'link',
            title: 'Puzzle DB',
            href: '/puzzles/database',
            icon: Database,
            description: 'Individual puzzles with DB record counts and difficulty analysis',
          },
          {
            type: 'link',
            title: 'Test a Solution',
            href: '/test-solution',
            icon: CheckCircle,
            description: 'Test your own predicted solutions against ARC puzzles',
          },
          {
            type: 'link',
            title: 'Debate',
            href: '/debate',
            icon: MessageSquare,
            description: "Watch AI models challenge each other's explanations",
          },
          {
            type: 'link',
            title: 'Discussion',
            href: '/discussion',
            icon: Brain,
            description: 'Uses the Responses API to do iterative self-conversation',
          },
          {
            type: 'link',
            title: 'LLM Council',
            href: '/council',
            icon: Users,
            description: 'Multi-model consensus evaluation with 3-stage deliberation',
          },
          {
            type: 'link',
            title: 'Feedback',
            href: '/feedback',
            icon: MessageSquare,
            description: 'Explore human feedback on model explanations',
          },
          {
            type: 'link',
            title: 'Poetiq Solver',
            href: '/poetiq',
            icon: Code,
            description: 'Help verify the Poetiq code-generation solver with your API key',
          },
        ],
      },
      {
        label: 'Reading & Collections',
        items: [
          {
            type: 'link',
            title: 'About',
            href: '/about',
            icon: Info,
            description: 'Learn about this project and acknowledgments',
          },
          {
            type: 'link',
            title: 'LLM Reasoning',
            href: '/llm-reasoning',
            icon: Brain,
            description: 'Plain-language explainer of how AI pattern matching differs from human thinking',
          },
          {
            type: 'link',
            title: 'Cards',
            href: '/trading-cards',
            icon: Wallet,
            description: 'Named puzzles as collectible trading cards with performance stats',
          },
          {
            type: 'link',
            title: 'People',
            href: '/hall-of-fame',
            icon: Users,
            description: 'Notable ARC contributors and researchers as trading cards',
          },
        ],
      },
    ],
  },
  {
    type: 'dropdown',
    title: 'Arena',
    icon: Worm,
    description: 'SnakeBench and Worm Arena -- LLMs playing snake against each other',
    sections: [
      {
        label: 'SnakeBench',
        items: [
          {
            type: 'link',
            title: 'SnakeBench (Upstream)',
            href: '/snakebench',
            icon: Gamepad2,
            description: 'Official SnakeBench project (upstream)',
          },
        ],
      },
      {
        label: 'Worm Arena',
        items: [
          {
            type: 'link',
            title: 'Replay',
            href: '/worm-arena',
            icon: Worm,
            description: 'Replay a saved match by matchId',
            exact: true,
          },
          {
            type: 'link',
            title: 'Live',
            href: '/worm-arena/live',
            icon: Worm,
            description: 'Run and watch a live match',
          },
          {
            type: 'link',
            title: 'Matches',
            href: '/worm-arena/matches',
            icon: Worm,
            description: 'Browse matches by model (DB-backed)',
          },
          {
            type: 'link',
            title: 'Models',
            href: '/worm-arena/models',
            icon: Worm,
            description: 'Model match history and combat profiles',
          },
          {
            type: 'link',
            title: 'Stats & Placement',
            href: '/worm-arena/stats',
            icon: Worm,
            description: 'Ratings, placements, and leaderboards',
          },
          {
            type: 'link',
            title: 'Skill Analysis',
            href: '/worm-arena/skill-analysis',
            icon: Worm,
            description: 'Model performance analysis and skill metrics',
          },
          {
            type: 'link',
            title: 'Distributions',
            href: '/worm-arena/distributions',
            icon: Worm,
            description: 'Run length distributions and match statistics',
          },
          {
            type: 'link',
            title: 'Rules',
            href: '/worm-arena/rules',
            icon: Worm,
            description: 'Game rules and LLM prompt transparency',
          },
        ],
      },
    ],
  },
];

/**
 * The two ARC-3 sites worth leaving for. arc3.sonpham.net is Son Pham's sibling catalog,
 * built on the same Pyodide/ARCEngine architecture this repo runs -- see
 * docs/sonpham-arc3-pyodide-architecture.md. Labelled by hostname so it is self-describing.
 */
const externalLinks: ExternalNavLink[] = [
  {
    title: 'ARC Prize',
    href: 'https://arcprize.org/arc-agi/3/',
    description: 'Official ARC Prize Foundation site',
  },
  {
    title: 'arc3.sonpham.net',
    href: 'https://arc3.sonpham.net',
    description: "Son Pham's ARC-3 game catalog",
  },
];

export function AppNavigation() {
  const [location] = useLocation();

  const isActiveRoute = (href: string, exact?: boolean) => {
    if (href === '/') {
      return location === '/' || location === '/browser';
    }
    if (exact) {
      return location === href;
    }
    return location.startsWith(href);
  };

  const isDropdownActive = (dropdown: NavDropdown): boolean =>
    dropdown.sections.some(section =>
      section.items.some(item => isActiveRoute(item.href, item.exact)),
    );

  return (
    <div className="flex items-center justify-between w-full gap-2">
      {/* The menu, not the header, is the scroll container. Without min-w-0 the menu refuses
          to shrink and shoves the shrink-0 right rail outside the viewport, which at <=1024px
          hid the two external links and the repo link entirely. Scrolling here instead means
          the ARC-3 row stays flush left and it is the archive dropdowns that scroll away. */}
      <div className="min-w-0 overflow-x-auto">
        <NavigationMenu>
        <NavigationMenuList className="flex items-center">
          {navigationItems.map(item => {
            const key = item.type === 'link' ? item.href : item.title;

            return (
              <NavigationMenuItem key={key} className="flex items-center">
                {/* Dropdowns are secondary by design: lighter weight than the ARC-3 row, so
                    the primary flow reads as primary without resorting to decoration. */}
                {item.type === 'link' ? (
                  <NavigationMenuLink asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        navigationMenuTriggerStyle(),
                        // px-3 overrides the cva's px-4 through twMerge: at px-4 the six
                        // top-level items spend 48px on padding the header needs elsewhere.
                        'flex items-center gap-2 px-3 font-semibold',
                        isActiveRoute(item.href, item.exact) && 'bg-accent text-accent-foreground',
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{item.title}</span>
                    </Link>
                  </NavigationMenuLink>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className={cn(
                        navigationMenuTriggerStyle(),
                        'flex items-center gap-2 px-3 font-normal text-muted-foreground',
                        isDropdownActive(item) && 'bg-accent text-accent-foreground font-medium',
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{item.title}</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[280px] p-1">
                      {item.sections.map((section, sectionIndex) => (
                        <React.Fragment key={section.label}>
                          {sectionIndex > 0 && <DropdownMenuSeparator />}
                          <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {section.label}
                          </DropdownMenuLabel>
                          {section.items.map(child => {
                            const isChildActive = isActiveRoute(child.href, child.exact);
                            return (
                              <DropdownMenuItem key={child.href} asChild>
                                <Link
                                  href={child.href}
                                  className={cn(
                                    'block select-none rounded-md px-3 py-2 text-sm leading-none no-underline outline-none transition-colors',
                                    'hover:bg-accent hover:text-accent-foreground',
                                    'focus:bg-accent focus:text-accent-foreground',
                                    isChildActive && 'bg-accent text-accent-foreground font-semibold',
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <child.icon className="h-4 w-4 shrink-0" />
                                    <div>
                                      <div className="font-medium">{child.title}</div>
                                      {child.description && (
                                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                          {child.description}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </Link>
                              </DropdownMenuItem>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {item.dividerAfter && (
                  <span className="text-xs mx-1.5 select-none" aria-hidden="true">
                    {item.dividerAfter}
                  </span>
                )}
              </NavigationMenuItem>
            );
          })}
        </NavigationMenuList>
        </NavigationMenu>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {externalLinks.map(link => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            title={link.description}
            className="hidden md:flex"
          >
            <Button variant="ghost" size="sm" className="flex items-center gap-1.5 font-medium">
              <span className="text-xs">{link.title}</span>
              <ExternalLink className="h-3 w-3 opacity-60" />
            </Button>
          </a>
        ))}
        <a
          href="https://github.com/82deutschmark/arc-explainer"
          target="_blank"
          rel="noopener noreferrer"
          title="Open source on GitHub"
          className="hidden sm:flex"
        >
          <Button variant="ghost" size="sm" className="flex items-center gap-2">
            <Github className="h-4 w-4" />
          </Button>
        </a>
      </div>
    </div>
  );
}
