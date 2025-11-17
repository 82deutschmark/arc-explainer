/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-11
 * PURPOSE: Simple navigation with all items displayed horizontally with colorful emoji dividers.
 * Displays all 12 navigation items as individual links with single emoji squares between them.
 * Uses shadcn/ui NavigationMenu for consistent styling and active state management.
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
  Users
} from 'lucide-react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

const navigationItems: NavItem[] = [
  {
    title: 'Home',
    href: '/',
    icon: Grid3X3,
    description: 'Browse ARC puzzles and start analysis'
  },
  {
    title: 'Trading Cards',
    href: '/trading-cards',
    icon: Wallet,
    description: 'Named puzzles as collectible trading cards with performance stats'
  },
  {
    title: 'Hall of Fame',
    href: '/human-cards',
    icon: Users,
    description: 'Notable ARC contributors and researchers as trading cards'
  },
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
    title: 'Puzzle DB',
    href: '/puzzles/database',
    icon: Database,
    description: 'Individual puzzles with DB record counts and difficulty analysis'
  },
  {
    title: 'Discussion',
    href: '/discussion',
    icon: Brain,
    description: 'Uses the Responses API to do iterative self-conversation'
  },
  {
    title: 'Debate',
    href: '/debate',
    icon: MessageSquare,
    description: 'Watch AI models challenge each other\'s explanations'
  },
  {
    title: 'Compare',
    href: '/elo',
    icon: Trophy,
    description: 'Compare AI explanations head-to-head with ELO ratings'
  },
  {
    title: 'Feedback',
    href: '/feedback',
    icon: MessageSquare,
    description: 'Explore human feedback on model explanations'
  },
  {
    title: 'Test',
    href: '/test-solution',
    icon: CheckCircle,
    description: 'Test your own predicted solutions against ARC puzzles'
  },
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
    description: 'ARC-3 Games'
  },
  {
    title: 'About',
    href: '/about',
    icon: Info,
    description: 'Learn about this project and acknowledgments'
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

  return (
    <div className="flex items-center justify-between w-full">
      <NavigationMenu>
        <NavigationMenuList>
          {navigationItems.map((item, index) => {
            const Icon = item.icon;
            const showDivider = index < navigationItems.length - 1;
            const dividerEmoji = dividerEmojis[index % dividerEmojis.length];

            return (
              <React.Fragment key={item.href}>
                <NavigationMenuItem>
                  <NavigationMenuLink asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        navigationMenuTriggerStyle(),
                        "flex items-center gap-2 font-medium",
                        isActiveRoute(item.href) && "bg-accent text-accent-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{item.title}</span>
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
                {showDivider && (
                  <span className="text-xs mx-1 select-none" aria-hidden="true">
                    {dividerEmoji}
                  </span>
                )}
              </React.Fragment>
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
