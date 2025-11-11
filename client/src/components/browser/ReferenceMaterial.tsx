/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-11-10
 * PURPOSE: Renders Reference Material section with light theme for PuzzleBrowser page.
 *          Provides reusable ReferenceLink and ReferenceSection components to avoid duplication.
 *          Includes Research Papers, Data Sources, Tools, Solution References, and Community Notes.
 * SRP/DRY check: Pass - Extracted link rendering and section layout into reusable components.
 *                      Reduced code duplication in PuzzleBrowser and centralizes styling.
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
// REUSABLE COMPONENTS
// ============================================================================

/**
 * ReferenceLink - Individual link with external link icon
 * Provides consistent styling for all reference links
 */
const ReferenceLink: React.FC<{ link: ReferenceLink }> = ({ link }) => (
  <li>
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-2 text-slate-700 hover:text-sky-600 transition-colors"
    >
      {link.label}
      <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-sky-600" />
    </a>
  </li>
);

/**
 * ReferenceSection - Category of reference links
 * Displays a section title and list of links
 */
const ReferenceSection: React.FC<ReferenceSectionProps> = ({ title, links }) => (
  <div className="space-y-1">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
      {title}
    </p>
    <ul className="space-y-0.5">
      {links.map((link) => (
        <ReferenceLink key={link.href} link={link} />
      ))}
    </ul>
  </div>
);

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
 * ReferenceMaterial - Main section component with light theme
 * Displays all reference materials organized by category
 */
export const ReferenceMaterial: React.FC = () => {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      {/* Header */}
      <div className="flex items-center gap-3 text-sm font-semibold text-slate-900">
        <Sparkles className="h-4 w-4 text-slate-600" />
        <span>Reference material</span>
      </div>

      {/* Grid of reference sections */}
      <div className="mt-2 grid gap-3 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {REFERENCE_SECTIONS.map((section) => (
          <ReferenceSection
            key={section.title}
            title={section.title}
            links={section.links}
          />
        ))}
      </div>

      {/* Footer acknowledgement */}
      <p className="mt-2 text-xs text-slate-500">
        Special Acknowledgement: Simon Strandgaard (@neoneye) for his invaluable
        support, feedback, and collection of resources.
      </p>
    </section>
  );
};

export default ReferenceMaterial;
