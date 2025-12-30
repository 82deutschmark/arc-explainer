/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-19
 * PURPOSE: Hierarchical navigation with grouped dropdown menus and colorful emoji dividers.
 * Organizes navigation items into regular links and dropdown groups for better scannability.
 * Groups: ARC-3 (games + playground), Misc (leaderboards, puzzle DB, test, LLM reasoning, kaggle readiness).
 * Uses shadcn/ui NavigationMenu with triggers, content, and viewport for dropdown functionality.
 * CRITICAL: NavigationMenuViewport is required for dropdown content to render properly!
 * Emoji dividers are rendered INSIDE each menu item to maintain proper Radix UI hierarchy.
 * SRP/DRY check: Pass - Single responsibility (navigation structure), reuses shadcn components
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
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Grid3X3,
  Database,
  Brain,
  Github,
  Trophy,
  CheckCircle,
  MessageSquare,
  Info,
  Award,
  Gamepad2,
  FlaskConical,
  Wallet,
  Users,
  MoreHorizontal,
  FileCheck,
  Zap,
  Code,
  Worm
} from 'lucide-react';

// Type definitions for discriminated union
interface NavLink {
  type: 'link';
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

interface NavDropdown {
  type: 'dropdown';
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  children: NavLink[];
}

type NavItem = NavLink | NavDropdown;

const navigationItems: NavItem[] = [
  {
    type: 'link',
    title: 'Home',
    href: '/',
    icon: Grid3X3,
    description: 'Browse ARC puzzles and start analysis'
  },
  {
    type: 'link',
    title: 'Analytics',
    href: '/analytics',
    icon: Database,
    description: 'Model performance analytics and leaderboards'
  },
  {
    type: 'link',
    title: 'Official Scoring',
    href: '/scoring',
    icon: Zap,
    description: 'Official test results on public evaluation set with 2 attempts per puzzle'
  },
  {
    type: 'link',
    title: 'Discussion',
    href: '/discussion',
    icon: Brain,
    description: 'Uses the Responses API to do iterative self-conversation'
  },
  {
    type: 'link',
    title: 'Compare',
    href: '/elo',
    icon: Trophy,
    description: 'Compare AI explanations head-to-head with ELO ratings'
  },
  {
    type: 'dropdown',
    title: 'ARC-3',
    icon: Gamepad2,
    description: 'ARC-3 Games and Playground',
    children: [
      {
        type: 'link',
        title: 'ARC-AGI-3',
        href: '/arc3',
        icon: Gamepad2,
        description: 'Interactive reasoning benchmark for AI agents (game-based, not puzzles)'
      },
      {
        type: 'link',
        title: 'Playground',
        href: '/arc3/playground',
        icon: FlaskConical,
        description: 'Experiment with ARC-3 games'
      }
    ]
  },
  {
    type: 'dropdown',
    title: 'Misc',
    icon: MoreHorizontal,
    description: 'Additional resources and tools',
    children: [
      {
        type: 'link',
        title: 'Debate',
        href: '/debate',
        icon: MessageSquare,
        description: 'Watch AI models challenge each other\'s explanations'
      },
      {
        type: 'link',
        title: 'Feedback',
        href: '/feedback',
        icon: MessageSquare,
        description: 'Explore human feedback on model explanations'
      },
      {
        type: 'link',
        title: 'Leaderboards',
        href: '/leaderboards',
        icon: Award,
        description: 'Model performance rankings across accuracy, trustworthiness, and feedback'
      },
      {
        type: 'link',
        title: 'Puzzle DB',
        href: '/puzzles/database',
        icon: Database,
        description: 'Individual puzzles with DB record counts and difficulty analysis'
      },
      {
        type: 'link',
        title: 'Test',
        href: '/test-solution',
        icon: CheckCircle,
        description: 'Test your own predicted solutions against ARC puzzles'
      },
      {
        type: 'link',
        title: 'LLM Reasoning',
        href: '/llm-reasoning',
        icon: Brain,
        description: 'Plain-language explainer of how AI pattern matching differs from human thinking'
      },
      {
        type: 'link',
        title: 'Kaggle Readiness',
        href: '/kaggle-readiness',
        icon: FileCheck,
        description: 'Validate your ARC Kaggle competition readiness'
      },
      {
        type: 'link',
        title: 'Poetiq Solver',
        href: '/poetiq',
        icon: Code,
        description: 'Help verify the Poetiq code-generation solver with your API key'
      }
    ]
  },
  {
    type: 'dropdown',
    title: 'SnakeBench',
    icon: Gamepad2,
    description: 'SnakeBench and Worm Arena tools',
    children: [
      {
        type: 'link',
        title: 'SnakeBench (Upstream)',
        href: '/snakebench',
        icon: Gamepad2,
        description: 'Official SnakeBench project (upstream)'
      },
      {
        type: 'link',
        title: 'Worm Arena (Replay)',
        href: '/worm-arena',
        icon: Worm,
        description: 'Replay a saved match by matchId'
      },
      {
        type: 'link',
        title: 'Worm Arena (Live)',
        href: '/worm-arena/live',
        icon: Worm,
        description: 'Run and watch a live match'
      },
      {
        type: 'link',
        title: 'Worm Arena (Matches)',
        href: '/worm-arena/matches',
        icon: Worm,
        description: 'Browse matches by model (DB-backed)'
      },
      {
        type: 'link',
        title: 'Worm Arena (Models)',
        href: '/worm-arena/models',
        icon: Worm,
        description: 'Model match history and combat profiles'
      },
      {
        type: 'link',
        title: 'Worm Arena (Stats & Placement)',
        href: '/worm-arena/stats',
        icon: Worm,
        description: 'Ratings, placements, and leaderboards'
      },
      {
        type: 'link',
        title: 'Worm Arena (Skill Analysis)',
        href: '/worm-arena/skill-analysis',
        icon: Worm,
        description: 'Model performance analysis and skill metrics'
      },
      {
        type: 'link',
        title: 'Worm Arena (Distributions)',
        href: '/worm-arena/distributions',
        icon: Worm,
        description: 'Run length distributions and match statistics'
      },
      {
        type: 'link',
        title: 'Worm Arena (Rules)',
        href: '/worm-arena/rules',
        icon: Worm,
        description: 'Game rules and LLM prompt transparency'
      }
    ]
  },
  {
    type: 'link',
    title: 'About',
    href: '/about',
    icon: Info,
    description: 'Learn about this project and acknowledgments'
  },
  {
    type: 'link',
    title: 'Cards',
    href: '/trading-cards',
    icon: Wallet,
    description: 'Named puzzles as collectible trading cards with performance stats'
  },
  {
    type: 'link',
    title: 'People',
    href: '/hall-of-fame',
    icon: Users,
    description: 'Notable ARC contributors and researchers as trading cards'
  }
];

// ARC color palette for dividers
const dividerEmojis = ['🟥', '🟧', '🟨', '🟩', '🟦', '🟪'];

export function AppNavigation() {
  const [location] = useLocation();

  const isActiveRoute = (href: string) => {
    if (href === '/') {
      return location === '/' || location === '/browser';
    }
    return location.startsWith(href);
  };

  const isDropdownActive = (dropdown: NavDropdown): boolean => {
    return dropdown.children.some(child => isActiveRoute(child.href));
  };

  return (
    <div className="flex items-center justify-between w-full">
      <NavigationMenu>
        <NavigationMenuList className="flex items-center">
          {navigationItems.map((item, index) => {
            const showDivider = index < navigationItems.length - 1;
            const dividerEmoji = dividerEmojis[index % dividerEmojis.length];
            const key = item.type === 'link' ? item.href : item.title;

            return (
              <NavigationMenuItem key={key} className="flex items-center">
                {item.type === 'link' ? (
                  <NavigationMenuLink asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        navigationMenuTriggerStyle(),
                        "flex items-center gap-2 font-medium",
                        isActiveRoute(item.href) && "bg-accent text-accent-foreground"
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
                        "flex items-center gap-2 font-medium",
                        isDropdownActive(item) && "bg-accent text-accent-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{item.title}</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="min-w-[250px] p-1"
                    >
                      {item.children.map((child) => {
                        const isChildActive = isActiveRoute(child.href);
                        return (
                          <DropdownMenuItem key={child.href} asChild>
                            <Link
                              href={child.href}
                              className={cn(
                                "block select-none rounded-md px-3 py-2 text-sm leading-none no-underline outline-none transition-colors",
                                "hover:bg-accent hover:text-accent-foreground",
                                "focus:bg-accent focus:text-accent-foreground",
                                isChildActive && "bg-accent text-accent-foreground font-semibold"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <child.icon className="h-4 w-4" />
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
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {showDivider && (
                  <span className="text-xs mx-1 select-none" aria-hidden="true">
                    {dividerEmoji}
                  </span>
                )}
              </NavigationMenuItem>
            );
          })}
        </NavigationMenuList>
      </NavigationMenu>

      <div className="flex items-center gap-2">
        <a
          href="https://github.com/82deutschmark/arc-explainer"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex"
        >
          <Button variant="ghost" size="sm" className="flex items-center gap-2">
            <Github className="h-4 w-4" />
            <span className="text-xs">Open Source</span>
          </Button>
        </a>
      </div>
    </div>
  );
}
