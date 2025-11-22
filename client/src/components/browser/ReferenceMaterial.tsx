/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-22
 * PURPOSE: Renders Reference Material section with dark theme matching the app's overall design.
 *          Features colorful section headers (amber, emerald, cyan, violet, rose) with micro-containers,
 *          pill hover effects on links, and structured visual hierarchy. Provides reusable
 *          ReferenceLink and ReferenceSection components to avoid duplication.
 * SRP/DRY check: Pass - Extracted link rendering and section layout into reusable components.
 *                      Centralized styling with color mapping for visual consistency.
 */
import React from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ReferenceLink {
  label: string;
  href: string;
}

interface ReferenceSectionProps {
  title: string;
  links: ReferenceLink[];
}

// ============================================================================
// COLOR THEME CONFIGURATION
// ============================================================================

/**
 * Color mapping for section headers
 * Each section has unique colorful accents to create visual hierarchy
 */
const SECTION_COLORS = {
  'Research Papers': {
    text: 'text-amber-400',
    icon: 'bg-amber-500',
    border: 'border-amber-500/30',
  },
  'Data Sources': {
    text: 'text-emerald-400',
    icon: 'bg-emerald-500',
    border: 'border-emerald-500/30',
  },
  'Tools': {
    text: 'text-cyan-400',
    icon: 'bg-cyan-500',
    border: 'border-cyan-500/30',
  },
  'Solution References': {
    text: 'text-violet-400',
    icon: 'bg-violet-500',
    border: 'border-violet-500/30',
  },
  'Community Notes': {
    text: 'text-rose-400',
    icon: 'bg-rose-500',
    border: 'border-rose-500/30',
  },
} as const;

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

/**
 * ReferenceLink - Individual link with external link icon and pill hover effect
 * Provides consistent dark theme styling for all reference links
 */
const ReferenceLink: React.FC<{ link: ReferenceLink }> = ({ link }) => (
  <li>
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-1.5 px-2 py-1 -mx-2 rounded-md text-slate-300 hover:text-sky-200 hover:bg-sky-500/10 transition-all"
    >
      <span className="text-xs">{link.label}</span>
      <ExternalLink className="h-3 w-3 text-slate-500 group-hover:text-sky-400 transition-colors" />
    </a>
  </li>
);

/**
 * ReferenceSection - Category of reference links with colorful header
 * Each section is contained in a micro-container with color-coded border
 */
const ReferenceSection: React.FC<ReferenceSectionProps> = ({ title, links }) => {
  const colors = SECTION_COLORS[title as keyof typeof SECTION_COLORS] || SECTION_COLORS['Research Papers'];

  return (
    <div className={`space-y-2 p-2.5 rounded-lg border ${colors.border} bg-slate-800/30`}>
      <div className="flex items-center gap-1.5">
        <div className={`h-1 w-1 rounded-full ${colors.icon}`}></div>
        <p className={`text-xs font-bold uppercase tracking-wider ${colors.text}`}>
          {title}
        </p>
      </div>
      <ul className="space-y-1">
        {links.map((link) => (
          <ReferenceLink key={link.href} link={link} />
        ))}
      </ul>
    </div>
  );
};

// ============================================================================
// REFERENCE DATA
// ============================================================================

const REFERENCE_SECTIONS: ReferenceSectionProps[] = [
  {
    title: 'Research Papers',
    links: [
      {
        label: 'ARC-AGI-2 Technical Report',
        href: 'https://www.arxiv.org/pdf/2505.11831',
      },
    ],
  },
  {
    title: 'Data Sources',
    links: [
      {
        label: 'HuggingFace datasets',
        href: 'https://huggingface.co/arcprize',
      },
      {
        label: 'Official repository',
        href: 'https://github.com/fchollet/ARC-AGI',
      },
    ],
  },
  {
    title: 'Tools',
    links: [
      {
        label: 'Useful tool kit for ARC',
        href: 'https://github.com/mxbi/arckit',
      },
      {
        label: 'objarc (Patrick Spencer)',
        href: 'https://github.com/pwspen/objarc',
      },
      {
        label: 'Synapsomorphy ARC (Patrick Spencer)',
        href: 'https://synapsomorphy.com/arc/',
      },
      {
        label: 'CAPEd - Game/Tool (Viktor Ferenczi)',
        href: 'https://caped.ferenczi.eu/',
      },
    ],
  },
  {
    title: 'Solution References',
    links: [
      {
        label: 'zoecarver\'s approach',
        href: 'https://github.com/zoecarver',
      },
      {
        label: 'jerber\'s solutions',
        href: 'https://github.com/jerber',
      },
      {
        label: 'Eric Pang\'s SOTA solution',
        href: 'https://github.com/epang080516/arc_agi',
      },
    ],
  },
  {
    title: 'Community Notes',
    links: [
      {
        label: 'Puzzle nomenclature',
        href: 'https://github.com/google/ARC-GEN/blob/main/task_list.py#L422',
      },
      {
        label: 'Synthetic Data',
        href: 'https://cdg.openai.nl/',
      },
      {
        label: 'ARC notes by @neoneye',
        href: 'https://github.com/neoneye/arc-notes',
      },
      {
        label: 'Abstraction dataset',
        href: 'https://github.com/cristianoc/arc-agi-2-abstraction-dataset',
      },
    ],
  },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * ReferenceMaterial - Main section component with dark theme
 * Displays all reference materials organized by category with colorful headers
 */
export const ReferenceMaterial: React.FC = () => {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-slate-700/50">
        <Sparkles className="h-4 w-4 text-sky-400" />
        <span className="text-sm font-semibold uppercase tracking-wide text-slate-300">Reference Material</span>
      </div>

      {/* Grid of reference sections */}
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {REFERENCE_SECTIONS.map((section) => (
          <ReferenceSection
            key={section.title}
            title={section.title}
            links={section.links}
          />
        ))}
      </div>

      {/* Footer acknowledgement */}
      <p className="mt-3 pt-2 border-t border-slate-700/50 text-xs text-slate-400 italic">
        Special Acknowledgement: Simon Strandgaard (@neoneye) for his invaluable
        support, feedback, and collection of resources.
      </p>
    </section>
  );
};

export default ReferenceMaterial;
