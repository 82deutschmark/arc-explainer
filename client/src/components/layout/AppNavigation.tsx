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
  MessageCircle,
  Github,
  Target,
  Trophy,
  CheckCircle
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
    title: 'Analytics',
    href: '/analytics',
    icon: Database,
    description: 'Model performance analytics and leaderboards'
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
    icon: MessageCircle,
    description: 'Community discussion and analysis insights'
  },
  {
    title: 'Kaggle Readiness',
    href: '/kaggle-readiness',
    icon: Target,
    description: 'Validate technical readiness for machine learning competitions'
  },
  {
    title: 'ELO Arena',
    href: '/elo',
    icon: Trophy,
    description: 'Compare AI explanations head-to-head with ELO ratings'
  },
  {
    title: 'Test Solution',
    href: '/feedback',
    icon: CheckCircle,
    description: 'Test your own predicted solutions against ARC puzzles'
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

  return (
    <div className="flex items-center justify-between w-full">
      <NavigationMenu>
        <NavigationMenuList>
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavigationMenuItem key={item.href}>
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