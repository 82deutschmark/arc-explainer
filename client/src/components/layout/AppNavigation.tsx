/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-11
 * PURPOSE: Enhanced navigation with categorized dropdown menus and ARC-inspired emoji dividers.
 * Organizes 12 navigation items into 5 logical categories for better UX and space efficiency.
 * Uses colored square emojis (🟥🟧🟨🟩🟦🟪) as visual category indicators.
 * Implements shadcn/ui NavigationMenu with dropdowns to prevent horizontal overflow.
 * SRP/DRY check: Pass - Single responsibility (navigation structure), reuses shadcn components
 */
import React from 'react';
import { Link, useLocation } from 'wouter';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
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
  ChevronDown
} from 'lucide-react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

interface NavCategory {
  title: string;
  emoji: string;
  items: NavItem[];
}

// Organized navigation with ARC-inspired emoji categories
const navigationCategories: NavCategory[] = [
  {
    title: 'Puzzles',
    emoji: '🟥',
    items: [
      {
        title: 'Home',
        href: '/',
        icon: Grid3X3,
        description: 'Browse ARC puzzles and start analysis'
      },
      {
        title: 'Puzzle DB',
        href: '/puzzles/database',
        icon: Database,
        description: 'Individual puzzles with DB record counts and difficulty analysis'
      },
      {
        title: 'Test Solution',
        href: '/test-solution',
        icon: CheckCircle,
        description: 'Test your own predicted solutions against ARC puzzles'
      }
    ]
  },
  {
    title: 'AI Analysis',
    emoji: '🟧',
    items: [
      {
        title: 'Discussion',
        href: '/discussion',
        icon: Brain,
        description: 'Uses the Responses API to do iterative self-conversation'
      },
      {
        title: 'Model Debate',
        href: '/debate',
        icon: MessageSquare,
        description: 'Watch AI models challenge each other\'s explanations'
      },
      {
        title: 'ELO Arena',
        href: '/elo',
        icon: Trophy,
        description: 'Compare AI explanations head-to-head with ELO ratings'
      }
    ]
  },
  {
    title: 'Performance',
    emoji: '🟨',
    items: [
      {
        title: 'Analytics',
        href: '/analytics',
        icon: Database,
        description: 'Model performance analytics and leaderboards'
      },
      {
        title: 'Leaderboards',
        href: '/leaderboards',
        icon: Award,
        description: 'Model performance rankings across accuracy, trustworthiness, and feedback'
      },
      {
        title: 'Feedback',
        href: '/feedback',
        icon: MessageSquare,
        description: 'Explore human feedback on model explanations'
      }
    ]
  },
  {
    title: 'ARC-AGI-3',
    emoji: '🟩',
    items: [
      {
        title: 'ARC-AGI-3',
        href: '/arc3',
        icon: Gamepad2,
        description: 'Interactive reasoning benchmark for AI agents (game-based, not puzzles)'
      },
      {
        title: 'ARC3 Playground',
        href: '/arc3/playground',
        icon: FlaskConical,
        description: 'Launch the Color Hunt simulator powered by the OpenAI Agents SDK'
      }
    ]
  }
];

// Standalone items (not in dropdowns)
const standaloneItems: NavItem[] = [
  {
    title: 'About',
    href: '/about',
    icon: Info,
    description: 'Learn about this project and acknowledgments'
  }
];

export function AppNavigation() {
  const [location] = useLocation();

  const isActiveRoute = (href: string) => {
    if (href === '/') {
      return location === '/' || location === '/browser';
    }
    return location.startsWith(href);
  };

  const isCategoryActive = (category: NavCategory) => {
    return category.items.some(item => isActiveRoute(item.href));
  };

  return (
    <div className="flex items-center justify-between w-full gap-2">
      <NavigationMenu>
        <NavigationMenuList className="flex-wrap gap-1">
          {/* Categorized dropdown menus */}
          {navigationCategories.map((category) => (
            <NavigationMenuItem key={category.title}>
              <NavigationMenuTrigger
                className={cn(
                  "h-9 px-3 text-sm font-medium gap-1.5",
                  isCategoryActive(category) && "bg-accent text-accent-foreground"
                )}
              >
                <span className="text-base leading-none">{category.emoji}</span>
                <span className="hidden md:inline">{category.title}</span>
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[320px] gap-2 p-3 md:w-[400px] md:grid-cols-1">
                  {category.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <NavigationMenuLink asChild>
                          <Link
                            href={item.href}
                            className={cn(
                              "block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                              isActiveRoute(item.href) && "bg-accent/50"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Icon className="h-4 w-4" />
                              <div className="text-sm font-medium leading-none">
                                {item.title}
                              </div>
                            </div>
                            <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                              {item.description}
                            </p>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    );
                  })}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
          ))}

          {/* Separator emoji */}
          <li className="hidden lg:flex items-center px-1 text-muted-foreground/30 text-xs">
            🟦
          </li>

          {/* Standalone navigation items */}
          {standaloneItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavigationMenuItem key={item.href}>
                <NavigationMenuLink asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      navigationMenuTriggerStyle(),
                      "h-9 px-3 text-sm font-medium gap-2",
                      isActiveRoute(item.href) && "bg-accent text-accent-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden md:inline">{item.title}</span>
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            );
          })}
        </NavigationMenuList>
      </NavigationMenu>

      {/* GitHub link with emoji separator */}
      <div className="flex items-center gap-2">
        <span className="hidden lg:inline text-muted-foreground/30 text-xs">🟪</span>
        <a
          href="https://github.com/82deutschmark/arc-explainer"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex"
        >
          <Button variant="ghost" size="sm" className="h-9 flex items-center gap-2">
            <Github className="h-4 w-4" />
            <span className="hidden lg:inline text-xs">Open Source</span>
          </Button>
        </a>
      </div>
    </div>
  );
}
