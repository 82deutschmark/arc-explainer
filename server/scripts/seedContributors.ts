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
    category: 'competition_winner',
    rank: 2
  },

  // 2024 ARC Prize Winners
  {
    fullName: 'Daniel Franzen',
    handle: undefined,
    affiliation: 'Johannes Gutenberg University Mainz (JGU Mainz), Germany',
    achievement: '1st Place ARC Prize 2024 - 53.5% accuracy',
    description: 'Led ARChitects team to victory using innovative LLM-based approach with Mistral-Nemo-Minitron-8B model, depth-first search for token selection, and test-time training.',
    yearStart: 2024,
    yearEnd: 2024,
    score: '53.5% (1st Place)',
    approach: 'Product of Experts approach using multiple perspectives to improve solution selection, combining LLM fine-tuning with symbolic reasoning',
    uniqueTechnique: 'Test-time training with augmentation-based validation system using depth-first search for token selection',
    links: {
      github: 'https://github.com/da-fr/arc-prize-2024',
      papers: ['https://arxiv.org/abs/arc-prize-2024']
    },
    teamName: 'ARChitects',
    category: 'competition_winner',
    rank: 2
  },

  {
    fullName: 'Jean-François Puget',
    handle: 'JFPuget',
    affiliation: 'Machine Learning at NVIDIA, 6x Kaggle Grandmaster',
    achievement: 'Preliminary 1st Place on ARC Prize 2025 Kaggle leaderboard',
    description: 'Machine Learning at NVIDIA, 6x Kaggle Grandmaster (CPMP). ENS Ulm alumni, ML PhD. Formerly at ILOG CPLEX and IBM. Achieved preliminary first place on Kaggle 2025 ARC Prize.',
    imageUrl: '/jfPuget.png',
    yearStart: 2025,
    yearEnd: 2025,
    score: '1st Place (Preliminary)',
    approach: 'TBA',
    uniqueTechnique: 'TBA',
    links: {
      github: 'https://github.com/jfpuget',
      twitter: 'https://x.com/JFPuget',
      kaggle: 'https://www.kaggle.com/cpmpml'
    },
    teamName: 'NVARC',
    category: 'competition_winner',
    rank: 1
  },

  {
    fullName: 'Ivan Sorokin',
    handle: 'lytic',
    affiliation: 'Machine Learning Researcher at NVIDIA, Kaggle Grandmaster',
    achievement: 'Preliminary 1st Place on ARC Prize 2025 Kaggle leaderboard (with JF Puget)',
    description: 'Machine Learning Researcher at NVIDIA based in Finland. Kaggle Grandmaster, one of only ~350 worldwide. Member of NVIDIA\'s KGMON team (Kaggle Grandmasters of NVIDIA). Won Math Olympiad Competition 2025 with team NemoSkills ($262,144 prize). Achieved preliminary first place on Kaggle 2025 ARC Prize alongside teammate JF Puget.',
    imageUrl: undefined,
    yearStart: 2025,
    yearEnd: 2025,
    score: '1st Place (Preliminary)',
    approach: 'TBA',
    uniqueTechnique: 'TBA',
    links: {
      github: 'https://github.com/1ytic',
      linkedin: 'https://www.linkedin.com/in/lytic/'
    },
    teamName: 'NVARC',
    category: 'competition_winner',
    rank: 1
  },

  {
    fullName: 'Guillermo Barbadillo',
    handle: 'guille_bar',
    affiliation: 'Independent Researcher',
    achievement: '2nd Place ARC Prize 2024 - 40% accuracy',
    description: 'Achieved second place in ARC Prize 2024 with Omni-ARC approach combining multiple solving techniques.',
    yearStart: 2024,
    yearEnd: 2024,
    score: '40% (2nd Place)',
    approach: 'Omni-ARC approach combining multiple techniques for comprehensive puzzle solving',
    uniqueTechnique: 'Multi-method ensemble combining neural and symbolic approaches',
    links: {
      twitter: 'https://x.com/guille_bar',
      kaggle: 'https://www.kaggle.com/guillermobarba'
    },
    teamName: 'Omni-ARC',
    category: 'competition_winner',
    rank: 3
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

  {
    fullName: 'Jack Cole',
    handle: undefined,
    affiliation: 'MindsAI Team',
    achievement: '1st Place ARCathon 2023 (tied), Early 2024 world record of 39%',
    description: 'Pioneered test-time training for ARC-AGI in 2023, first to successfully apply TTT to ARC-AGI, inspiring the dominant approach in 2024 competition.',
    yearStart: 2023,
    yearEnd: 2024,
    score: '39% (Record 2024)',
    approach: 'Fine-tuning models on synthetic and augmented data with test-time fine-tuning',
    uniqueTechnique: 'First successful test-time training application to ARC-AGI',
    links: {},
    teamName: 'MindsAI',
    category: 'pioneer',
    rank: undefined
  },

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
    yearStart: 2019,
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
  }
];

async function seedDatabase() {
  // Initialize the database connection
  const initialized = await initializeDatabase();
  
  if (!initialized) {
    logger.error('Failed to initialize database connection', 'seed');
    process.exit(1);
  }

  const repo = new ContributorRepository();

  try {
    logger.info('Starting contributor database seeding...', 'seed');

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

// Run the seed function
seedDatabase()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seeding error:', error);
    process.exit(1);
  });
