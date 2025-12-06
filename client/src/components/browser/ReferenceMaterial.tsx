/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-05
 * PURPOSE: Research terminal-style Reference Material section with Bloomberg-terminal aesthetic.
 *          Monospace fonts, amber/gold accents, minimal padding, organized as data panels.
 *          Terminal-like presentation for professional research platform feel.
 * SRP/DRY check: Pass - Single responsibility for reference display; reusable components
 *                      for links and sections; centralized data and styling.
 */
import React from 'react';
import { ExternalLink, Server } from 'lucide-react';

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
  icon: string;
}

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

/**
 * TerminalLink - Individual link styled like a terminal output
 * Monospace font, amber hover state, minimal padding
 */
const TerminalLink: React.FC<{ link: ReferenceLink }> = ({ link }) => (
  <li>
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group font-mono text-xs inline-flex items-center gap-1 px-1 py-0.5 text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/5 transition-all"
    >
      <span>→</span>
      <span>{link.label}</span>
      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  </li>
);

/**
 * DataPanel - Terminal-style panel for a category of links
 * Mimics financial terminal instrument panels with minimal padding
 */
const DataPanel: React.FC<ReferenceSectionProps> = ({ title, links, icon }) => {
  return (
    <div className="border border-amber-500/20 bg-slate-950/40 backdrop-blur-sm">
      {/* Panel header - terminal style */}
      <div className="border-b border-amber-500/10 px-1.5 py-0.5 flex items-center gap-1">
        <span className="text-amber-400 font-mono text-xs font-bold">{icon}</span>
        <span className="font-mono text-amber-400/90 text-xs uppercase tracking-tight">{title}</span>
        <div className="ml-auto text-amber-500/40 font-mono text-xs">[{links.length}]</div>
      </div>

      {/* Panel content */}
      <ul className="space-y-0.5 px-1.5 py-1">
        {links.map((link) => (
          <TerminalLink key={link.href} link={link} />
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
    title: 'Papers',
    icon: '📄',
    links: [
      {
        label: 'ARC-AGI-2 Technical Report',
        href: 'https://www.arxiv.org/pdf/2505.11831',
      },
      {
        label: 'NVIDIA Kaggle Grandmasters - AGI Competition',
        href: 'https://developer.nvidia.com/blog/nvidia-kaggle-grandmasters-win-artificial-general-intelligence-competition/?nvid=nv-int-tblg-454784',
      },
      {
        label: 'Less is More - Tiny Recursive Models',
        href: 'https://alexiajm.github.io/2025/09/29/tiny_recursive_models.html',
      },
    ],
  },
  {
    title: 'Data Sources',
    icon: '🗂️',
    links: [
      {
        label: 'HuggingFace datasets',
        href: 'https://huggingface.co/arcprize',
      },
      {
        label: 'Official repository',
        href: 'https://github.com/fchollet/ARC-AGI',
      },
      {
        label: 'Human Insights & Explanations',
        href: 'https://arc-visualizations.github.io/',
      },
    ],
  },
  {
    title: 'Tools & Solvers',
    icon: '⚙️',
    links: [
      {
        label: 'arckit toolkit',
        href: 'https://github.com/mxbi/arckit',
      },
      {
        label: 'objarc (Patrick Spencer)',
        href: 'https://github.com/pwspen/objarc',
      },
      {
        label: 'Synapsomorphy ARC',
        href: 'https://synapsomorphy.com/arc/',
      },
      {
        label: 'CAPEd - Game/Tool',
        href: 'https://caped.ferenczi.eu/',
      },
      {
        label: 'NVARC - Synthetic Data Generation',
        href: 'https://github.com/1ytic/NVARC',
      },
    ],
  },
  {
    title: 'Solutions',
    icon: '✓',
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
        label: 'Eric Pang SOTA',
        href: 'https://github.com/epang080516/arc_agi',
      },
    ],
  },
  {
    title: 'Community',
    icon: '👥',
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
 * ReferenceMaterial - Terminal-style reference section
 * Bloomberg terminal aesthetic with amber accents, minimal padding, monospace fonts
 */
export const ReferenceMaterial: React.FC = () => {
  return (
    <section className="border border-amber-500/20 bg-slate-950/50 backdrop-blur-sm">
      {/* Terminal header */}
      <div className="border-b border-amber-500/20 px-1.5 py-1 flex items-center gap-1.5 bg-amber-500/5">
        <Server className="h-3.5 w-3.5 text-amber-400" />
        <span className="font-mono text-amber-400 text-xs font-bold uppercase tracking-tight">
          Research Terminal
        </span>
        <span className="ml-auto font-mono text-amber-500/40 text-xs">v1.0</span>
      </div>

      {/* Data panels grid - minimal spacing */}
      <div className="p-1 grid gap-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {REFERENCE_SECTIONS.map((section) => (
          <DataPanel
            key={section.title}
            title={section.title}
            links={section.links}
            icon={section.icon}
          />
        ))}
      </div>

      {/* Terminal footer */}
      <div className="border-t border-amber-500/10 px-1.5 py-0.5 text-xs font-mono text-amber-500/50">
        Special thanks:{' '}
        <a
          href="https://github.com/neoneye"
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-400/80 hover:text-amber-300 hover:underline transition-colors"
        >
          Simon Strandgaard (@neoneye)
        </a>
      </div>
    </section>
  );
};

export default ReferenceMaterial;
