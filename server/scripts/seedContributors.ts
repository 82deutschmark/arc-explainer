/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-16
 * PURPOSE: Seed script to populate the arc_contributors table with notable ARC-AGI contributors.
 * Based on comprehensive research of competition winners, paper awards, and pioneers.
 * Run with: tsx server/scripts/seedContributors.ts
 * SRP/DRY check: Pass - Single responsibility for database seeding
 */

import { initializeDatabase, getPool } from '../repositories/base/BaseRepository.ts';
import { ContributorRepository } from '../repositories/ContributorRepository.ts';
import type { CreateContributorRequest } from '@shared/types/contributor.ts';
import { logger } from '../utils/logger.ts';
import { config } from 'dotenv';

config();

const contributors: CreateContributorRequest[] = [
  // 2025 Top Paper Award Winner
  {
    fullName: 'Alexia Jolicoeur-Martineau',
    handle: 'jm_alexia',
    affiliation: 'Samsung SAIT Montréal, Senior AI Researcher',
    achievement: '2025 Top Paper Award: "Less is More: Recursive Reasoning with Tiny Networks" (TRM)',
    description: 'Lead author of the Tiny Recursive Model (TRM) work on ARC-AGI—a groundbreaking ~7M-parameter, 2-layer recursive network that repeatedly refines an internal reasoning state and answer instead of relying on huge LLMs. TRM became the leading open-source approach on ARC-AGI shortly before the 2025 ARC Prize deadline, though its compute budget exceeded competition constraints.',
    imageUrl: '/alexiaJM4.png',
    yearStart: 2025,
    yearEnd: 2025,
    score: '~45% ARC-AGI-1, ~8% ARC-AGI-2',
    approach: 'Tiny Recursive Model (TRM)—a compact 2-layer network with recursive refinement that iteratively improves its reasoning state and answer prediction. Trained from scratch without LLM pretraining.',
    uniqueTechnique: 'Demonstrated that ~7M parameters can match or beat models 10,000× larger (DeepSeek R1, o3-mini, Gemini 2.5 Pro) on ARC-AGI-2, proving "less is more" for abstract reasoning.',
    links: {
      twitter: 'https://x.com/jm_alexia',
      github: 'https://github.com/SamsungSAILMontreal/TinyRecursiveModels',
      kaggle: 'https://www.kaggle.com/code/alexiajm/arc-agi-without-pretraining',
      papers: ['https://arxiv.org/abs/2510.04871'],
      website: 'https://alexiajm.github.io/2025/09/29/tiny_recursive_models.html'
    },
    teamName: 'Samsung SAIL Montréal',
    category: 'top_paper_award',
    rank: 1
  },

  // 2024-2025 Top Achievers
  {
    fullName: 'Jeremy Berman',
    handle: 'jerber888',
    affiliation: 'Independent Researcher',
    achievement: 'New SOTA: 79.6% on ARC v1, 29.4% on ARC v2',
    description: 'Achieved record-breaking scores using evolutionary test-time compute with Claude Sonnet 3.5, pioneering natural language programming as an alternative to code-based approaches.',
    imageUrl: '/jberARC.png',
    yearStart: 2025,
    yearEnd: undefined,
    score: '79.6% SOTA',
    approach: 'Evolutionary Test-Time Compute with Claude Sonnet 3.5 generating Python transform functions (v1) and plain English instructions with Grok-4 (v2). Uses up to 500 candidate functions with 31-36 dynamic prompts per challenge.',
    uniqueTechnique: 'Pioneered using natural language as a programming medium instead of code; evolutionary approach with diversity preservation',
    links: {
      twitter: 'https://x.com/jerber888',
      substack: 'https://jeremyberman.substack.com/',
      website: 'https://params.com/@jeremy-berman/arc-agi'
    },
    teamName: undefined,
    category: 'researcher',
    rank: undefined
  },

  // ARChitects - 2025 (2nd Place)
  {
    fullName: 'ARChitects (Franzen, Disselhoff, Hartmann)',
    handle: undefined,
    affiliation: 'Johannes Gutenberg University Mainz, Germany',
    achievement: '2nd Place ARC Prize 2025 (16.53%)',
    description: 'Three-person team (Daniel Franzen, Jan Disselhoff, David Hartmann) that dominates the ARC-AGI scene. Took 2nd place in ARC Prize 2025 with 16.53% on ARC-AGI-2, using a 2D-aware masked-diffusion LLM with recursive self-refinement.',
    imageUrl: '/ARChitechts.png',
    yearStart: 2025,
    yearEnd: 2025,
    score: '16.53% (2nd Place)',
    approach: '2D-aware masked-diffusion LLM with recursive self-refinement',
    uniqueTechnique: 'Masked diffusion approach applied to 2D grid reasoning with iterative refinement',
    links: {
      github: 'https://github.com/da-fr/arc-prize-2024',
      papers: ['https://arxiv.org/abs/arc-prize-2024']
    },
    teamName: 'ARChitects',
    category: 'competition_winner',
    rank: 2
  },

  // ARChitects - 2024 (1st Place)
  {
    fullName: 'ARChitects 2024 (Franzen, Disselhoff, Hartmann)',
    handle: undefined,
    affiliation: 'Johannes Gutenberg University Mainz, Germany',
    achievement: '1st Place ARC Prize 2024 (53.5%)',
    description: 'Three-person team (Daniel Franzen, Jan Disselhoff, David Hartmann) won ARC Prize 2024, scoring 53.5% on ARC-AGI-1 private eval with "The LLM ARChitect," using test-time training plus a product-of-experts ensemble over different perspectives of each grid.',
    imageUrl: '/ARChitechts.png',
    yearStart: 2024,
    yearEnd: 2024,
    score: '53.5% (1st Place)',
    approach: 'Product of Experts ensemble using multiple perspectives to improve solution selection, combining LLM fine-tuning with test-time training',
    uniqueTechnique: 'Test-time training with augmentation-based validation using depth-first search for token selection',
    links: {
      github: 'https://github.com/da-fr/arc-prize-2024',
      papers: ['https://arxiv.org/abs/arc-prize-2024']
    },
    teamName: 'ARChitects',
    category: 'competition_winner',
    rank: 1
  },

  // 2025 Competition Winners - Combined team card for 1st place
  {
    fullName: 'Team NVARC (JF Puget & Ivan Sorokin)',
    handle: 'JFPuget & lytic',
    affiliation: 'NVIDIA - Machine Learning & Kaggle Grandmasters',
    achievement: '1st Place ARC Prize 2025 (24.03%)',
    description: 'Jean-François Puget (6x Kaggle Grandmaster, ENS Ulm alumni, ML PhD) and Ivan Sorokin (ML Researcher, Kaggle Grandmaster, Math Olympiad 2025 winner) won 1st place in ARC Prize 2025 with 24.03% accuracy as Team NVARC.',
    imageUrl: '/jfPuget3.png,/ivanARC2.png',
    yearStart: 2025,
    yearEnd: 2025,
    score: '24.03% (1st Place)',
    approach: 'Synthetic-data-driven ensemble of an improved ARChitects-style, test-time-trained model and TRM-based components that reaches ~24% on ARC-AGI-2 under Kaggle contest constraints.',
    uniqueTechnique: 'TBA',
    links: {
      github: 'https://github.com/jfpuget',
      twitter: 'https://x.com/JFPuget',
      kaggle: 'https://www.kaggle.com/cpmpml',
      linkedin: 'https://www.linkedin.com/in/lytic/'
    },
    teamName: 'NVARC',
    category: 'competition_winner',
    rank: 1
  },

  {
    fullName: 'Guillermo Barbadillo',
    handle: 'ironbar',
    affiliation: 'Veridas AI',
    achievement: '5th Place ARC Prize 2025 - 6.53% accuracy (semi-private eval)',
    description: 'Continued development of multi-technique approach, achieving 5th place in ARC Prize 2025 with strong public Kaggle leaderboard performance.',
    imageUrl: '/guillermo.png',
    yearStart: 2024,
    yearEnd: 2025,
    score: '6.53% (5th Place) / 11.94% (Public Kaggle)',
    approach: 'Omni-ARC approach combining multiple techniques for comprehensive puzzle solving',
    uniqueTechnique: 'Multi-method ensemble combining neural and symbolic approaches',
    links: {
      twitter: 'https://x.com/guille_bar',
      kaggle: 'https://www.kaggle.com/guillermobarba'
    },
    teamName: 'Veridas',
    category: 'competition_winner',
    rank: 5
  },

  // Team MindsAI - 2025 entry (Jack Cole & Dries Smit)
  {
    fullName: 'Team MindsAI (Jack Cole & Dries Smit)',
    handle: undefined,
    affiliation: 'MindsAI & Tufa Labs',
    imageUrl: '/jackCole2.png,/dries.png',
    achievement: '3rd Place ARC Prize 2025 (15.42% on public ARC-AGI-2)',
    description: 'Jack Cole (test-time training pioneer) and Dries Smit (RL agent specialist) teamed up for ARC Prize 2025, reaching 3rd place on the public ARC-AGI-2 leaderboard with 15.42%.',
    yearStart: 2025,
    yearEnd: 2025,
    score: '15.42% (3rd Place)',
    approach: 'Test-time training (TTT) combined with RL-based adaptation.',
    uniqueTechnique: 'Combined TTT expertise with efficient RL agent approaches.',
    links: {},
    teamName: 'MindsAI',
    category: 'competition_winner',
    rank: 3
  },

  // Jack Cole - 2024 entry (separate card)
  {
    fullName: 'Jack Cole (2024)',
    handle: undefined,
    affiliation: 'MindsAI Team',
    imageUrl: '/jackcole.jpeg',
    achievement: 'MindsAI: Highest score 55.5% on ARC Prize 2024 (ineligible)',
    description: 'Core researcher on Team MindsAI, which achieved the top 55.5% score on the ARC Prize 2024 private evaluation set using heavy test-time training, while remaining ineligible for official prizes because the solution was not open sourced.',
    yearStart: 2024,
    yearEnd: 2024,
    score: '55.5% (Highest, ineligible)',
    approach: 'Test-time training (TTT) and ARC-specific domain knowledge as part of MindsAI\'s proprietary system.',
    uniqueTechnique: 'Helped pioneer test-time training for ARC-AGI, setting the 55.5% high score on 2024 private eval.',
    links: {},
    teamName: 'MindsAI',
    category: 'competition_winner',
    rank: 2
  },

  // 2024 Paper Award Winners
  {
    fullName: 'Wen-Ding Li',
    handle: undefined,
    affiliation: 'Cornell University (PhD student with Kevin Ellis)',
    achievement: '1st Place Paper Award - Combined team achieved 47.5% on public leaderboard',
    description: 'Cornell PhD student who investigated whether it\'s better to infer latent functions (induction) or directly predict outputs (transduction) for ARC tasks.',
    yearStart: 2024,
    yearEnd: 2024,
    score: '47.5% (Paper Award)',
    approach: 'Combined induction and transduction using neural models trained on synthetic variations of Python programs',
    uniqueTechnique: 'Discovered that induction and transduction excel at different types of ARC tasks despite same training data and architecture',
    links: {
      website: 'https://wending.dev/',
      papers: ['https://www.cs.cornell.edu/~wdli/']
    },
    teamName: 'MIT & Cornell',
    category: 'paper_award',
    rank: undefined
  },

  {
    fullName: 'Kevin Ellis',
    handle: 'ellisk_kellis',
    affiliation: 'Cornell University (Associate Professor)',
    achievement: '1st Place Paper Award (co-author), creator of DreamCoder',
    description: 'Associate Professor at Cornell and creator of DreamCoder program synthesis system, combining program synthesis with inductive reasoning.',
    yearStart: 2024,
    yearEnd: 2024,
    score: 'Paper Award (1st)',
    approach: 'Program synthesis and library learning, combining induction and transduction',
    uniqueTechnique: 'DreamCoder system for learning program libraries through wake-sleep algorithm',
    links: {
      website: 'https://www.cs.cornell.edu/~ellisk/',
      twitter: 'https://x.com/ellisk_kellis'
    },
    teamName: 'MIT & Cornell',
    category: 'paper_award',
    rank: undefined
  },

  {
    fullName: 'Ekin Akyürek',
    handle: 'akyurekekin',
    affiliation: 'MIT CSAIL (now OpenAI)',
    achievement: '2nd Place Paper Award - 53.0% on public validation, 61.9% when ensembled',
    description: 'MIT CSAIL researcher (now at OpenAI) who demonstrated that test-time training gave 6x improvement over base fine-tuned models.',
    yearStart: 2024,
    yearEnd: 2024,
    score: '53.0% (61.9% ensemble)',
    approach: 'Test-time training (TTT) temporarily updating model parameters during inference',
    uniqueTechnique: 'Demonstrated TTT as mechanism for improving LLMs\' reasoning capabilities, also improving BIG-Bench Hard from 50.5% to 57.8%',
    links: {
      website: 'https://ekinakyurek.github.io/',
      github: 'https://github.com/ekinakyurek/marc',
      twitter: 'https://x.com/akyurekekin',
      papers: ['https://arxiv.org/abs/2411.07279']
    },
    teamName: 'MIT CSAIL',
    category: 'paper_award',
    rank: undefined
  },

  {
    fullName: 'Clément Bonnet',
    handle: undefined,
    affiliation: 'Independent Researcher',
    achievement: '3rd Place Paper Award - Latent Program Network',
    description: 'Created Latent Program Network (LPN) that builds test-time search directly into neural models, searching through compact latent space without pre-defined DSLs.',
    yearStart: 2024,
    yearEnd: 2024,
    score: 'Paper Award (3rd)',
    approach: 'Latent Program Network combining symbolic adaptability with neural scalability',
    uniqueTechnique: 'Test-time search through latent program space doubled performance on out-of-distribution tasks',
    links: {
      github: 'https://github.com/clement-bonnet/lpn',
      papers: ['https://arxiv.org/abs/2411.08706']
    },
    teamName: undefined,
    category: 'paper_award',
    rank: undefined
  },

  {
    fullName: 'Jean-François Puget (2024 Paper)',
    handle: 'JFPuget',
    affiliation: 'Machine Learning at NVIDIA, 6x Kaggle Grandmaster',
    imageUrl: '/jfPuget2.png',
    achievement: 'Runner-Up ARC Prize 2024 Paper Award - A 2D nGPT Model For ARC Prize',
    description: 'Authored A 2D nGPT Model For ARC Prize, a 2D-aware nGPT-style model tailored to ARC-AGI grids that was recognized as a runner-up paper in the ARC Prize 2024 paper awards.',
    yearStart: 2024,
    yearEnd: 2024,
    score: 'Runner-Up (Paper Award)',
    approach: '2D-aware nGPT-style model that tokenizes ARC grids as 2D structures and uses an autoregressive transformer to predict output grids.',
    uniqueTechnique: 'Emphasizes explicit 2D spatial structure in tokenization and attention so the model can reason over local and global patterns on ARC grids.',
    links: {
      kaggle: 'https://www.kaggle.com/competitions/arc-prize-2024/discussion/545844',
      papers: ['https://github.com/jfpuget/ARC-AGI-Challenge-2024/blob/main/arc.pdf']
    },
    teamName: 'NVIDIA',
    category: 'paper_award',
    rank: undefined
  },

  // MindsAI Team
  {
    fullName: 'MindsAI Team',
    handle: undefined,
    affiliation: 'MindsAI Research Lab',
    achievement: 'Highest score of 55.5% on private evaluation set (ineligible for prize)',
    description: 'Pioneered test-time training (TTT) for ARC-AGI beginning in 2023, inspiring many subsequent approaches. Chose not to open source solution.',
    yearStart: 2023,
    yearEnd: 2024,
    score: '55.5% (Highest)',
    approach: 'Test-time training using Salesforce T5 series model pretrained on public eval set and synthetic data, further fine-tuned at test time',
    uniqueTechnique: 'First team to successfully apply TTT to ARC-AGI (2023), increased SOTA from 33% to 55.5%',
    links: {},
    teamName: 'MindsAI',
    category: 'researcher',
    rank: undefined
  },

  // Jack Cole pioneer entry removed - covered by his 2024 and 2025 competition winner entries

  // 2020 Kaggle Winners
  {
    fullName: 'icecuber',
    handle: 'icecuber',
    affiliation: 'Independent',
    achievement: '1st Place Kaggle ARC 2020 - 20% (solved 20 of 100 tasks)',
    description: 'First significant success on ARC, establishing DSL-based program search as foundation for subsequent solutions. Showed at least 20% of tasks solvable with just 3-4 transformations.',
    yearStart: 2020,
    yearEnd: 2020,
    score: '20% (1st Place)',
    approach: 'Brute-force program search with DSL containing 142 hand-crafted unary functions on grids; greedy composition stored in directed acyclic graph (DAG)',
    uniqueTechnique: 'Limited search to depth 3-4, demonstrating efficiency of shallow program composition. Written in C++17 and Python.',
    links: {
      github: 'https://github.com/top-quarks/ARC-solution',
      kaggle: 'https://www.kaggle.com/competitions/abstraction-and-reasoning-challenge/discussion/154597'
    },
    teamName: undefined,
    category: 'pioneer',
    rank: undefined
  },

  {
    fullName: 'Michael Hodel',
    handle: undefined,
    affiliation: 'ETH Zurich (Master\'s student in Computer Science)',
    achievement: 'Winner ARCathon 2022, set world record of 39% in 2024',
    description: 'Created one of the best ARC-AGI domain-specific languages (DSLs) to date, won ARCathon 2022 and continued improving ARC solutions.',
    yearStart: 2022,
    yearEnd: 2024,
    score: '39% (Record 2024)',
    approach: 'Domain-specific language design for ARC puzzle solving',
    uniqueTechnique: 'Optimized DSL and program search process for better performance',
    links: {},
    teamName: undefined,
    category: 'pioneer',
    rank: undefined
  },

  // Founders
  {
    fullName: 'François Chollet & Mike Knoop',
    handle: 'fchollet & mikeknoop',
    affiliation: 'Creators of ARC-AGI & ARC Prize',
    achievement: 'Created ARC-AGI benchmark (2019) & Launched ARC Prize (2024)',
    description: 'François Chollet (Creator of Keras) defined the ARC-AGI benchmark in 2019 to measure general intelligence. Mike Knoop (Co-founder Zapier) launched the $1M+ ARC Prize in 2024 to accelerate progress toward AGI.',
    imageUrl: '/arc founders.png',
    yearStart: undefined,
    yearEnd: undefined,
    score: 'Founders',
    approach: 'Designed ARC as a measure of intelligence based on skill-acquisition efficiency rather than skill itself. Organized competitions to guide research.',
    uniqueTechnique: 'Created a benchmark that remained unsolved for 5+ years and a prize structure that incentivized open-source breakthroughs.',
    links: {
      github: 'https://github.com/fchollet/ARC-AGI',
      twitter: 'https://x.com/fchollet',
      website: 'https://arcprize.org'
    },
    teamName: 'ARC Prize Foundation',
    category: 'founder',
    rank: 0
  },

  // Additional Notable Contributors
  {
    fullName: 'Ryan Greenblatt',
    handle: undefined,
    affiliation: 'Redwood Research',
    achievement: '42-43% on ARC-AGI-Pub leaderboard',
    description: 'Achieved strong results using LLM-guided program synthesis with GPT-4o generating ~8,000 Python programs per task, deterministically verified against demonstrations.',
    yearStart: 2024,
    yearEnd: 2024,
    score: '42-43%',
    approach: 'LLM-guided program synthesis with specialized few-shot prompts for different problem types',
    uniqueTechnique: 'LLM-based error identification and rectification; ARC Prize estimates 85% achievable with ~100M programs per task',
    links: {},
    teamName: 'Redwood Research',
    category: 'researcher',
    rank: undefined
  },

  {
    fullName: 'Paul Fletcher-Hill',
    handle: undefined,
    affiliation: 'Independent Researcher',
    achievement: 'Runner-Up Paper Award - Mini-ARC',
    description: 'Achieved 41% on subset of 114 puzzles using small 67M parameter transformer models trained exclusively on ARC puzzles.',
    yearStart: 2024,
    yearEnd: 2024,
    score: '41% (subset)',
    approach: 'Small transformer models with test-time training and refinement, without search, language models, or program synthesis',
    uniqueTechnique: '2D positional embedding scheme for grid-based reasoning with minimal parameters',
    links: {
      website: 'https://www.paulfletcherhill.com/arcprize',
      papers: ['https://www.paulfletcherhill.com/mini-arc.pdf']
    },
    teamName: undefined,
    category: 'paper_award',
    rank: undefined
  },

  // ARC3 2026 Preview - Rising Stars
  {
    fullName: 'Dries Smit',
    handle: 'DriesSmit',
    affiliation: 'Independent Researcher / MindsAI & Tufa Labs',
    imageUrl: '/dries.png',
    achievement: '1st Place ARC-AGI-3 Agent Preview 2025 (12.58%)',
    description: 'Rising ARC-AGI researcher who won 1st place in the ARC-AGI-3 Agent Preview 2025 with his RL-based "StochasticGoose" agent, scoring 12.58% and leading all teams in efficiency. Also contributed to the MindsAI & Tufa Labs team in ARC Prize 2025, reaching 3rd place on the public ARC-AGI-2 leaderboard with 15.42%. His work focuses on efficient RL agents and test-time adaptation methods for ARC tasks.',
    yearStart: 2025,
    yearEnd: 2026,
    score: '12.58% (1st Place)',
    approach: 'RL-based agent with test-time adaptation, focusing on efficiency.',
    uniqueTechnique: 'StochasticGoose - an efficient RL agent that led all teams in computational efficiency while achieving top accuracy.',
    links: {},
    teamName: 'StochasticGoose',
    category: 'arc3_preview',
    rank: 1
  }
];

/**
 * Sync contributors using upsert - safe to run on every server startup.
 * Inserts new contributors and updates existing ones by fullName.
 * Never deletes data - only adds or updates.
 */
export async function syncContributors(): Promise<void> {
  const repo = new ContributorRepository();

  try {
    const existingCount = await repo.getContributorCount();
    logger.info(`Syncing contributors (${existingCount} existing, ${contributors.length} in source)...`, 'contributor-sync');

    let inserted = 0;
    let updated = 0;

    for (const contributor of contributors) {
      try {
        const existing = await repo.getAllContributors();
        const wasExisting = existing.some(c => c.fullName === contributor.fullName);
        
        await repo.upsertContributor(contributor);
        
        if (wasExisting) {
          updated++;
        } else {
          inserted++;
        }
      } catch (error) {
        logger.error(`✗ Failed to sync ${contributor.fullName}: ${error}`, 'contributor-sync');
      }
    }

    logger.info(`Contributor sync complete: ${inserted} inserted, ${updated} updated`, 'contributor-sync');

  } catch (error) {
    logger.error(`Contributor sync failed: ${error}`, 'contributor-sync');
    // Don't throw - sync failure shouldn't crash the server
  }
}

/**
 * Full database seed (destructive) - clears table and reinserts all.
 * Use this for manual resets only.
 */
async function seedDatabase() {
  // Initialize the database connection
  const initialized = await initializeDatabase();
  
  if (!initialized) {
    logger.error('Failed to initialize database connection', 'seed');
    process.exit(1);
  }

  const repo = new ContributorRepository();

  try {
    logger.info('Starting contributor database seeding (destructive)...', 'seed');

    // Clear existing data first to ensure updates are applied
    await repo.deleteAllContributors();

    for (const contributor of contributors) {
      try {
        await repo.createContributor(contributor);
        logger.info(`✓ Added: ${contributor.fullName}`, 'seed');
      } catch (error) {
        logger.error(`✗ Failed to add ${contributor.fullName}: ${error}`, 'seed');
      }
    }

    logger.info(`Seeding complete! Added ${contributors.length} contributors.`, 'seed');

    // Show summary stats
    const stats = await repo.getCountsByCategory();
    logger.info('Category breakdown:', 'seed');
    for (const [category, count] of Object.entries(stats)) {
      logger.info(`  ${category}: ${count}`, 'seed');
    }

  } catch (error) {
    logger.error(`Seeding failed: ${error}`, 'seed');
    throw error;
  } finally {
    // Close the pool
    const pool = getPool();
    if (pool) {
      await pool.end();
    }
  }
}

// Only run seedDatabase() when this script is executed directly (not imported)
// Check if this module is the main entry point
const isMainModule = import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;

if (isMainModule) {
  seedDatabase()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding error:', error);
      process.exit(1);
    });
}
