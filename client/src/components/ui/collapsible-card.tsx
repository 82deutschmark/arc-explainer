/**
 * collapsible-card.tsx
 * 
 * A reusable collapsible card component that extends the existing Card UI pattern.
 * Follows Single Responsibility Principle by handling only collapsible card presentation.
 * Reuses existing Radix UI Collapsible primitives and Card components for consistency.
 * 
 * @author Claude Code
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface CollapsibleCardProps {
  title: React.ReactNode;
  icon?: LucideIcon;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  headerDescription?: React.ReactNode;
}

export function CollapsibleCard({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  className,
  headerDescription
}: CollapsibleCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className={cn("w-full", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full justify-between p-0 h-auto hover:bg-transparent"
            >
              <CardTitle className="flex items-center gap-2 text-left">
                {Icon && <Icon className="h-5 w-5" />}
                {title}
              </CardTitle>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              )}
            </Button>
          </CollapsibleTrigger>
          {headerDescription && (
            <div className="mt-2">
              {headerDescription}
            </div>
          )}
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}