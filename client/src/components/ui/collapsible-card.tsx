/**
 * collapsible-card.tsx
 *
 * A reusable collapsible card component using DaisyUI collapse.
 * Follows Single Responsibility Principle by handling only collapsible card presentation.
 * Converted from shadcn/ui to DaisyUI.
 *
 * @author Claude Code
 * @date 2025-10-12 (Converted to DaisyUI)
 */

import React, { useState } from 'react';
import { ChevronDown, LucideIcon } from 'lucide-react';
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
    <div className={cn("card bg-base-100 shadow-sm border border-base-300", className)}>
      <div className="collapse">
        <input
          type="checkbox"
          checked={isOpen}
          onChange={(e) => setIsOpen(e.target.checked)}
          className="min-h-0"
        />
        <div className="collapse-title min-h-0 py-4 px-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                {Icon && <Icon className="h-5 w-5" />}
                {title}
              </h3>
              {headerDescription && (
                <div className="mt-2">
                  {headerDescription}
                </div>
              )}
            </div>
            <div className={`transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}>
              <ChevronDown className="h-4 w-4 text-base-content/60" />
            </div>
          </div>
        </div>
        <div className="collapse-content px-6 pb-4">
          {children}
        </div>
      </div>
    </div>
  );
}
