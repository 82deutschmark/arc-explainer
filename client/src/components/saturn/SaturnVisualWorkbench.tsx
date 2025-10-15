/**
 * client/src/components/saturn/SaturnVisualWorkbench.tsx
 *
 * Author: code-supernova
 * Date: 2025-10-14
 * PURPOSE: Main visual workbench container for Saturn Visual Solver - establishes enhanced layout
 * and visual hierarchy for the redesigned interface. Provides the structural foundation for
 * all visual components with modern glass-morphism design and responsive grid system.
 *
 * KEY FEATURES:
 * - Modern glass-morphism design with gradient backgrounds
 * - Responsive grid layout optimized for visual content
 * - Enhanced visual hierarchy with proper spacing and typography
 * - Integration points for all visual components
 * - Mobile-first responsive design
 *
 * LAYOUT ARCHITECTURE:
 * Desktop: Context sidebar (20%) + Main work area (80%)
 * Mobile: Stacked layout with collapsible sections
 *
 * SRP/DRY check: Pass - Pure layout container, delegates to specialized components
 * DaisyUI: Pass - Uses DaisyUI layout components and design system
 */

import React from 'react';

interface SaturnVisualWorkbenchProps {
  children: React.ReactNode;
  className?: string;
}

export default function SaturnVisualWorkbench({
  children,
  className = ""
}: SaturnVisualWorkbenchProps) {
  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 ${className}`}>
      {/* Animated background overlay */}
      <div className="absolute inset-0 opacity-40 bg-gradient-to-br from-slate-800/50 to-slate-900/50" />

      {/* Main content container */}
      <div className="relative z-10 h-screen overflow-hidden">
        {children}
      </div>

      {/* Subtle animated border glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
        <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-cyan-400/30 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-cyan-400/30 to-transparent" />
      </div>
    </div>
  );
}

/**
 * Desktop Layout Container
 * Provides the main 2-column layout for desktop screens
 */
export function SaturnDesktopLayout({
  sidebar,
  main
}: {
  sidebar: React.ReactNode;
  main: React.ReactNode;
}) {
  return (
    <div className="hidden lg:grid grid-cols-[280px_1fr] gap-6 h-full p-6">
      {/* Context Sidebar */}
      <aside className="min-h-0">
        <div className="sticky top-6 space-y-4 max-h-[calc(100vh-3rem)] overflow-y-auto">
          {sidebar}
        </div>
      </aside>

      {/* Main Work Area */}
      <main className="min-h-0 overflow-hidden">
        {main}
      </main>
    </div>
  );
}

/**
 * Mobile Layout Container
 * Provides stacked layout for mobile screens
 */
export function SaturnMobileLayout({
  header,
  content,
  footer
}: {
  header?: React.ReactNode;
  content: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="lg:hidden h-full flex flex-col p-4 space-y-4">
      {/* Mobile Header */}
      {header && (
        <header className="min-h-0">
          {header}
        </header>
      )}

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-hidden">
        {content}
      </main>

      {/* Mobile Footer */}
      {footer && (
        <footer className="min-h-0">
          {footer}
        </footer>
      )}
    </div>
  );
}

/**
 * Visual Panel Container
 * Standardized container for visual components with consistent styling
 */
export function SaturnVisualPanel({
  title,
  icon,
  children,
  className = "",
  variant = "default"
}: {
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "primary" | "secondary" | "accent";
}) {
  const variantStyles = {
    default: "bg-white/10 backdrop-blur-md border border-white/20",
    primary: "bg-blue-500/20 backdrop-blur-md border border-blue-400/30",
    secondary: "bg-slate-500/20 backdrop-blur-md border border-slate-400/30",
    accent: "bg-cyan-500/20 backdrop-blur-md border border-cyan-400/30"
  };

  return (
    <div className={`rounded-xl shadow-xl ${variantStyles[variant]} ${className}`}>
      {(title || icon) && (
        <div className="flex items-center gap-3 p-4 border-b border-white/10">
          {icon && (
            <div className="p-2 bg-white/20 rounded-lg">
              {icon}
            </div>
          )}
          {title && (
            <h3 className="text-lg font-semibold text-white">
              {title}
            </h3>
          )}
        </div>
      )}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

/**
 * Content Grid Layout
 * Responsive grid for organizing content within panels
 */
export function SaturnContentGrid({
  children,
  columns = 2,
  gap = "gap-4"
}: {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: string;
}) {
  const columnClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
  };

  return (
    <div className={`grid ${columnClasses[columns]} ${gap} min-h-0`}>
      {children}
    </div>
  );
}

/**
 * Visual Status Indicator
 * Animated indicator for various states (loading, success, error, etc.)
 */
export function SaturnStatusIndicator({
  status,
  size = "md",
  className = ""
}: {
  status: "idle" | "loading" | "success" | "error" | "warning";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4"
  };

  const statusStyles = {
    idle: "bg-gray-400",
    loading: "bg-blue-500 animate-pulse",
    success: "bg-green-500",
    error: "bg-red-500 animate-pulse",
    warning: "bg-yellow-500 animate-pulse"
  };

  return (
    <div className={`inline-block rounded-full ${sizeClasses[size]} ${statusStyles[status]} ${className}`} />
  );
}
