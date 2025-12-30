/**
 * CollapsibleSection.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-28
 * PURPOSE: Reusable collapsible section component with internal state management.
 *          Provides consistent styling and chevron animation for expandable content areas.
 * SRP/DRY check: Pass - Single responsibility of managing collapsible UI state
 */

import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
  /** Text to display in the trigger button */
  triggerText: string;
  /** Content to display when expanded */
  children: React.ReactNode;
  /** Optional initial open state (default: false) */
  defaultOpen?: boolean;
  /** Optional additional CSS classes for the trigger */
  triggerClassName?: string;
}

export function CollapsibleSection({
  triggerText,
  children,
  defaultOpen = false,
  triggerClassName = "",
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className={`flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors ${triggerClassName}`}
      >
        <ChevronDown
          className={`h-4 w-4 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
        {triggerText}
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}
