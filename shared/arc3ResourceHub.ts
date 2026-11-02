/*
Author: Claude Opus 5.5 High
Date: 2026-11-01
PURPOSE: The ARC-AGI-3 resource directory behind /home, and the outside ARC-1/2 reading behind
         /arc2. Every entry was opened and checked on 1-Nov-2026: dead links, sign-in walls and
         descriptions the page did not support were dropped. Descriptions stay plain, with no
         scores or placings, because those go stale. Felix561's game pack stays out on the
         Boss's call. The private lab repo is never listed.
         To add a resource, add a row to its section. The hub renders and filters from this.
SRP/DRY check: Pass - one list, read by the hub page and by the crawler copy of it.
*/
export interface HubResource { title: string; url: string; by: string; date: string; desc: string }
export interface HubSection { id: string; title: string; blurb: string; items: HubResource[] }
export interface OutsideReading { title: string; url: string; by: string; desc: string }

export const ARC3_HUB_SECTIONS: HubSection[] = [
 {
  "id": "human",
  "title": "Human play and reasoning",
  "blurb": "What people actually did: traces, human leaderboards and game-by-game comparisons.",
  "items": [
   {
    "title": "Human reasoning traces, the illustrated write-up",
    "url": "https://github.com/82deutschmark/arc-explainer/blob/main/data/arc3-human-reasoning/release/TRACE_WRITEUP.md",
    "by": "ARC Explainer",
    "date": "",
    "desc": "Complete play traces for every public game, reconstructed from the Boss's play notes: what the player saw, guessed, did, expected and learned, with pictures."
   },
   {
    "title": "Human reasoning traces, the dataset",
    "url": "https://github.com/82deutschmark/arc-explainer/blob/main/data/arc3-human-reasoning/release/DATASET_CARD.md",
    "by": "ARC Explainer",
    "date": "",
    "desc": "The same traces as training files, with the original notes, screenshots and action-by-action evidence from replaying recorded wins."
   },
   {
    "title": "Human and AI game comparison",
    "url": "/human-records.html",
    "by": "The ARC-3 team, on ARC Explainer",
    "date": "2026-10-05",
    "desc": "Sortable table comparing published human action counts with published AI results per public game, with its source data files linked."
   },
   {
    "title": "ARC-AGI-3 Official Game Mechanics: Complete Reference",
    "url": "/arc3/games.md",
    "by": "ARC Explainer",
    "date": "",
    "desc": "The official public games' mechanics and controls as one Markdown file, level by level, with full spoilers."
   },
   {
    "title": "The Slippery Seven",
    "url": "/arc3/slippery-seven",
    "by": "ARC Explainer",
    "date": "",
    "desc": "Guides to the seven games where a local model cleared no levels in a dated September 2026 experiment, not a claim about the games today."
   },
   {
    "title": "ARC-AGI-3 Human Leaderboard",
    "url": "https://arcprize.org/arc-agi/3/leaderboard",
    "by": "ARC Prize Foundation",
    "date": "",
    "desc": "ARC Prize's ranking of the humans who completed the most games in the fewest actions, viewable per game."
   },
   {
    "title": "Measuring Human Performance on ARC-AGI-3",
    "url": "https://arcprize.org/blog/arc-agi-3-human-dataset",
    "by": "Greg Kamradt, ARC Prize",
    "date": "2026-04-14",
    "desc": "Introduces the controlled human study and released dataset behind the benchmark's scoring baseline."
   }
  ]
 },
 {
  "id": "play",
  "title": "Play",
  "blurb": "Every way to play. Our games and the public games open on this site with no login.",
  "items": [
   {
    "title": "Why we made our games: creativity can't be interpolated",
    "url": "/arc3/why",
    "by": "ARC Explainer",
    "date": "",
    "desc": "The write-up on making games with a person in the loop, with every game playable under it."
   },
   {
    "title": "Son Pham's ARC-3 site",
    "url": "https://arc3.sonpham.net",
    "by": "Son Pham",
    "date": "",
    "desc": "The research home of our synthetic games, with its own public catalogue and player."
   },
   {
    "title": "Our games, Python source",
    "url": "https://github.com/82deutschmark/arc3-synthetic-games",
    "by": "Team Turducken",
    "date": "",
    "desc": "The source of each approved game, MIT licensed, with a validator and a sample data collector."
   },
   {
    "title": "Our games on GitHub Pages",
    "url": "https://82deutschmark.github.io/arc3-synthetic-games/",
    "by": "Team Turducken",
    "date": "",
    "desc": "A plain catalogue of the same picks, for anyone who would rather not visit this site."
   },
   {
    "title": "Play our human-reviewed ARC-AGI-3 games",
    "url": "/arc3/gallery",
    "by": "ARC Explainer",
    "date": "",
    "desc": "Human-reviewed original games that play here in the browser with no login."
   },
   {
    "title": "Official public games: mechanics guides and Play links",
    "url": "/arc3/games",
    "by": "ARC Explainer",
    "date": "",
    "desc": "Mechanics guides to the 25 official public games, covering what each action does and how each game is won, with Play buttons on the game pages; the guides contain spoilers."
   },
   {
    "title": "ARC-3 game catalogue by Son Pham",
    "url": "https://arc3.sonpham.net/games?catalog=1",
    "by": "Son Pham",
    "date": "",
    "desc": "A public browser catalogue of official, community and generated ARC-3-style games that plays without sign-in; play on its review pages counts toward its human baselines."
   },
   {
    "title": "ARC-AGI-3 Human Player Console",
    "url": "https://github.com/aashen1/arc-agi-3-local-play",
    "by": "aashen1",
    "date": "2026-05-06",
    "desc": "A desktop pygame wrapper around the official library for browsing and playing the games locally, offline once they are cached."
   },
   {
    "title": "Play ls20",
    "url": "https://arcprize.org/tasks/ls20",
    "by": "ARC Prize",
    "date": "",
    "desc": "Play game ls20 in the browser, with a human replay and published model runs on the same page."
   },
   {
    "title": "Play ft09",
    "url": "https://arcprize.org/tasks/ft09",
    "by": "ARC Prize",
    "date": "",
    "desc": "Play game ft09 in the browser, with a human replay and published model runs on the same page."
   },
   {
    "title": "Play vc33",
    "url": "https://arcprize.org/tasks/vc33",
    "by": "ARC Prize",
    "date": "",
    "desc": "Play game vc33 in the browser, with a human replay and published model runs on the same page."
   },
   {
    "title": "Example human replay on ls20",
    "url": "https://arcprize.org/replay/8aed7120-f7a9-45a1-837a-68bc7dc37a4f",
    "by": "ARC Prize",
    "date": "",
    "desc": "A frame-by-frame replay of a human run on ls20, with JSON and GIF download and a link to play the game."
   },
   {
    "title": "ARC3.Games",
    "url": "https://arc3.games/",
    "by": "Gijs Schenk",
    "date": "",
    "desc": "An open-source browser player for ARC-AGI-3 and custom ARCEngine games that saves finished level action sequences to an open database with an API."
   },
   {
    "title": "Learn to figure out ARC-3 games",
    "url": "https://arc3.sonpham.net/learn.html",
    "by": "The ARC-3 team, on Son Pham's site",
    "date": "",
    "desc": "A guide for players and helpers that teaches one observation at a time, using practice ideas from GPT-6 Astra's published notes."
   },
   {
    "title": "How AI Gets Measured",
    "url": "https://intelligence.mts.now/benchmarks",
    "by": "MTS Intelligence, with ARC Prize Foundation",
    "date": "",
    "desc": "An interactive guide to AI benchmarks that lets the reader try the public game SK48 in the page and watch a recorded run."
   },
   {
    "title": "Explore all ARC-AGI-3 tasks",
    "url": "https://arcprize.org/tasks",
    "by": "ARC Prize",
    "date": "",
    "desc": "Official index of public tasks whose ARC-AGI-3 tab lists the public games with human and model replay columns, and from which each game can be opened."
   },
   {
    "title": "Available Games",
    "url": "https://docs.arcprize.org/available-games",
    "by": "ARC Prize",
    "date": "",
    "desc": "Official docs page on finding the public games, including which are open to anonymous players and which need a free API key."
   }
  ]
 },
 {
  "id": "competition",
  "title": "The competition",
  "blurb": "ARC Prize 2026 on Kaggle: the rules, the data and the boards.",
  "items": [
   {
    "title": "ARC-AGI-3 Kaggle leaderboard with history",
    "url": "/kaggle-leaderboard",
    "by": "ARC Explainer",
    "date": "",
    "desc": "Public Kaggle standings saved every half hour, with team history, movers and medal lines; public medal bands are not final results."
   },
   {
    "title": "The ARC Daily Digest",
    "url": "/news",
    "by": "ARC Explainer newsroom",
    "date": "",
    "desc": "Daily coverage of both ARC Prize Kaggle contests, with standings and movers, wire stories, early and late editions and sourced competitor profiles."
   },
   {
    "title": "Kaggle ARC-AGI-3 leaderboard",
    "url": "https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/leaderboard",
    "by": "ARC Prize on Kaggle",
    "date": "",
    "desc": "The public leaderboard for the ARC Prize 2026 ARC-AGI-3 competition on Kaggle."
   },
   {
    "title": "Kaggle ARC-AGI-3 code tab",
    "url": "https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/code",
    "by": "Kaggle community",
    "date": "",
    "desc": "The public notebooks shared for the competition, including ARC Prize's sample submissions and community agents."
   },
   {
    "title": "ARC Prize 2026 - Paper Track",
    "url": "https://www.kaggle.com/competitions/arc-prize-2026-paper-track/overview",
    "by": "ARC Prize on Kaggle",
    "date": "Closes 9 Nov 2026 per Kaggle",
    "desc": "The Kaggle hackathon track where entrants submit a write-up documenting their ARC-AGI-2 or ARC-AGI-3 submission."
   },
   {
    "title": "ARC-AGI-3 Kaggle Starter docs",
    "url": "https://docs.arcprize.org/arc-prize-2026",
    "by": "ARC Prize",
    "date": "",
    "desc": "Walks through editing one agent file locally, playing the real games on your machine and pushing a notebook to Kaggle, and explains how Kaggle runs it."
   },
   {
    "title": "ARC-AGI-3 Preview Agent Competition",
    "url": "https://arcprize.org/competitions/arc-agi-3-preview-agents",
    "by": "ARC Prize",
    "date": "18 Jul to 19 Aug 2025",
    "desc": "ARC Prize's results page for the 2025 preview contest held with Hugging Face, linking the winning projects' code and recaps."
   },
   {
    "title": "ARC Prize 2026 - ARC-AGI-3 (Kaggle competition overview)",
    "url": "https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/overview",
    "by": "ARC Prize Foundation / Kaggle",
    "date": "2026-03-25",
    "desc": "The competition's home page, with the description, scoring summary, timeline, prize table, notebook requirements and the RTX 6000 hardware note."
   },
   {
    "title": "ARC-AGI-3 competition data page",
    "url": "https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/data",
    "by": "ARC Prize Foundation / Kaggle",
    "date": "",
    "desc": "Describes the frame format, the action set, the public game files in the environment_files folder and the separate private set of games used for scoring."
   },
   {
    "title": "500 Submissions Analyzed - Common Errors",
    "url": "https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/discussion/727119",
    "by": "Greg Kamradt (Competition Host)",
    "date": "",
    "desc": "The host's breakdown of the most common reasons submissions fail, based on Kaggle's review of recent submission errors, with advice on avoiding them."
   },
   {
    "title": "ARC Prize 2026",
    "url": "https://arcprize.org/competitions/2026",
    "by": "ARC Prize Foundation",
    "date": "",
    "desc": "The competition hub covering the ARC-AGI-3, ARC-AGI-2 and paper tracks, the open-source requirements and the key dates."
   },
   {
    "title": "ARC Prize 2026: ARC-AGI-3 track",
    "url": "https://arcprize.org/competitions/2026/arc-agi-3",
    "by": "ARC Prize Foundation",
    "date": "",
    "desc": "ARC Prize's page for the track, covering prizes, submission requirements and what the benchmark tests."
   },
   {
    "title": "Kaggle competition rules",
    "url": "https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/rules",
    "by": "ARC Prize Foundation / Kaggle",
    "date": "",
    "desc": "The binding rules for entry, prizes, milestone publication and eligibility."
   },
   {
    "title": "ARC Prize leaderboard",
    "url": "https://arcprize.org/leaderboard",
    "by": "ARC Prize Foundation",
    "date": "",
    "desc": "ARC Prize's own leaderboard for ARC-AGI-1, 2 and 3, plotting score against cost, with verified and community views."
   }
  ]
 },
 {
  "id": "winners",
  "title": "Winning solutions and write-ups",
  "blurb": "How the milestone winners and top teams did it, in their own words.",
  "items": [
   {
    "title": "forge milestone notebook",
    "url": "https://www.kaggle.com/code/mbmmurad/arc-agi-3-lb-0-86-3rd-place-candidate-milestone",
    "by": "Md Boktiar Mahbub Murad",
    "date": "Last run 30 Jun 2026",
    "desc": "A single-file notebook for an offline agent that shows rendered frames to a local Gemma-4-31B and reads back JSON actions, with settings driven by named profiles."
   },
   {
    "title": "ARC-AGI-3 Milestone 2 (2nd place open source solution)",
    "url": "https://www.kaggle.com/writeups/lordhansolo/arc-agi-3-milestone-2",
    "by": "Lord Han Solo",
    "date": "2026-10-01",
    "desc": "A Milestone 2 winner's write-up on keeping the Duck core and serving more tokens per game through a patched vLLM on one GPU."
   },
   {
    "title": "ARC-AGI-3: A game with no instructions",
    "url": "https://genaipod.substack.com/p/arc-agi-3",
    "by": "Shashank",
    "date": "2026-08-26",
    "desc": "An explainer on what the benchmark tests and how public solutions see, remember, test theories and learn."
   },
   {
    "title": "NVIDIA AVO Reaches 100% on the ARC-AGI-3 Public Set",
    "url": "https://developer.nvidia.com/blog/nvidia-avo-reaches-100-on-arc-agi-3-demonstrating-a-frontier-level-general-purpose-architecture-for-long-horizon-autonomous-agents/",
    "by": "Terry Chen, Yeyin (Eva) Zhu, Zhifan Ye, Jean-Francois Puget, Humphrey Shi (NVIDIA)",
    "date": "2026-08-21",
    "desc": "NVIDIA's technical post on applying its Agentic Variation Operators architecture to long-running agent tasks, including the ARC-AGI-3 public games."
   },
   {
    "title": "VISTA: A Visual Harness for Reasoning in an Interactive World",
    "url": "https://vista-research.github.io/",
    "by": "Qiushi Han, Keya Hu, Linlu Qiu, Cathy Wu, Kaiming He (MIT)",
    "date": "2026-08-05",
    "desc": "A project write-up on a harness that has a general multimodal model play from raw game images and recall past observations in full detail."
   },
   {
    "title": "How enabling two settings tripled our scores on the ARC-AGI-3 benchmark",
    "url": "https://openai.com/index/how-two-settings-tripled-our-arc-agi-3-scores/",
    "by": "OpenAI",
    "date": "2026-07-29",
    "desc": "OpenAI's report on how turning on retained reasoning and compaction in its own harness changed its model's play."
   },
   {
    "title": "Continual Harness: An Efficient Self-Improving Agent on ARC-AGI-3",
    "url": "https://sethkarten.substack.com/p/continual-harness-an-efficient-self",
    "by": "Seth Karten",
    "date": "2026-07-12",
    "desc": "Write-up of the Continual Harness on the public games, covering its architecture, skill reuse, experimental setup, per-game examples and limitations."
   },
   {
    "title": "ARC Prize 2026: ARC-AGI-3 Milestone Prize #1",
    "url": "https://arcprize.org/blog/arc-prize-2026-milestone-1",
    "by": "Greg Kamradt, ARC Prize",
    "date": "2026-07-06",
    "desc": "ARC Prize's summary of the three winning open-source submissions, with a notebook link for each and further materials where they were published."
   },
   {
    "title": "Duck Harness: Winning Solution for ARC-AGI-3 Milestone 1",
    "url": "https://tufalabs.ai/research/duck-harness/",
    "by": "Harold Bessis, Jeroen Cottaar, Isaiah Pressman, Andries Smit, Michal Tesnar, Stefano Viel (Tufa Labs)",
    "date": "2026-07-01",
    "desc": "Tufa Labs' write-up of its minimal harness, which runs a small open model in a Python REPL, and how it compares with other approaches."
   },
   {
    "title": "1st Place in the ARC-AGI-3 Agent Preview Competition",
    "url": "https://medium.com/@dries.epos/1st-place-in-the-arc-agi-3-agent-preview-competition-49263f6287db",
    "by": "Dries Smit",
    "date": "2025-08-21",
    "desc": "The author's write-up of StochasticGoose, the preview competition's winning agent."
   },
   {
    "title": "Reki milestone notebook",
    "url": "https://www.kaggle.com/code/ruichardliu/milestone1-2nd-solution",
    "by": "Reki (Kaggle user ruichardliu)",
    "date": "",
    "desc": "A notebook for an agent that shows recent game frames to a locally served Gemma-4-31B and gets back one JSON object per step with a short plan and next actions."
   },
   {
    "title": "StochasticGoose",
    "url": "https://github.com/DriesSmit/ARC3-solution",
    "by": "Dries Smit, Tufa Labs; adviser Jack Cole",
    "date": "",
    "desc": "Code for a preview-contest agent that uses simple reinforcement learning with a convolutional network to predict which actions will change the frame."
   },
   {
    "title": "Blind Squirrel",
    "url": "https://github.com/wd13ca/ARC-AGI-3-Agents",
    "by": "Will Dick",
    "date": "",
    "desc": "Code and a README write-up for a preview-contest agent that combines a state graph, a rules-based valid-actions model and a neural action-value model."
   },
   {
    "title": "Explore It Till You Solve It",
    "url": "https://github.com/dolphin-in-a-coma/arc-agi-3-just-explore",
    "by": "Evgenii Rudakov, Jonathan Shock and Benjamin Ultan Cowley",
    "date": "",
    "desc": "Code, a Colab notebook and a workshop paper for an exploration-only preview-contest agent built on frame segmentation and a level graph."
   },
   {
    "title": "ARC Prize 2026: ARC-AGI-3 Milestone Prize #1",
    "url": "https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/discussion/725002",
    "by": "Greg Kamradt (Competition Host)",
    "date": "",
    "desc": "The host's announcement of the first milestone prize, summarizing the three open-source winning submissions with links to each."
   },
   {
    "title": "rellik13: ARC-AGI-3 Milestone 2 write-up",
    "url": "https://github.com/LohitSiriki/arc-agi-3-milestone2-solution/blob/main/WRITEUP.md",
    "by": "Lohit Siriki (rellik13)",
    "date": "",
    "desc": "A solo Milestone 2 winner's account of which serving and harness changes helped, which experiments failed, and his view of why added prompt advice hurt."
   },
   {
    "title": "Write Up: Taaf Anim Agent",
    "url": "https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/discussion/734369",
    "by": "Jakob Brüggen",
    "date": "",
    "desc": "A short participant write-up on extending the Duck harness with a guard against repeated no-op actions and with access to the animation frames between board states."
   },
   {
    "title": "Harness or model? Notes from a week of controlled harness experiments",
    "url": "https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/discussion/743723",
    "by": "Sergei Makarov",
    "date": "",
    "desc": "A participant's notes from testing one harness change at a time on a public Duck-based harness, including how to compare runs and which layers did not help."
   },
   {
    "title": "P3.1: Perception-Augmented Duck — What Prompt Engineering Can and Cannot Buy on ARC-AGI-3",
    "url": "https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/discussion/743060",
    "by": "gedouluhui",
    "date": "",
    "desc": "A participant's Milestone 2 technical write-up on four tested changes to an otherwise unmodified Duck harness, covering perception hints and prompts, and reporting the rejected experiments."
   },
   {
    "title": "Tufa Labs' Winning Solution for ARC-AGI-3 Milestone 1",
    "url": "https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/discussion/717133",
    "by": "Tufa Labs (Harold Bessis, Jeroen Cottaar, Isaiah Pressman, Dries Smit, Michal Tesnar, Stefano Viel)",
    "date": "",
    "desc": "The team's technical write-up of the Duck harness, which plays through a Python tool and evicts old messages from context, with links to its notebook and code."
   },
   {
    "title": "Tufa Labs duck harness [June 30 milestone winner]",
    "url": "https://www.kaggle.com/code/jeroencottaar/tufa-labs-duck-harness-june-30-milestone-winner",
    "by": "Jeroen Cottaar",
    "date": "",
    "desc": "The Kaggle notebook for the first-milestone solution, which readers can copy and edit, though two of its input datasets now show as no longer available."
   },
   {
    "title": "ARC-AGI-3 Milestone 2: Building on the Duck Harness",
    "url": "https://github.com/da-fr/arc-agi-3-solution/blob/main/WRITEUP.md",
    "by": "Daniel Franzen",
    "date": "",
    "desc": "An account of the changes made to the Duck harness for the second milestone, including experiments."
   },
   {
    "title": "ARC-AGI-3 Milestone 2 Solution",
    "url": "https://www.kaggle.com/code/dfranzen/arc-agi-3-milestone-2-solution",
    "by": "Daniel Franzen",
    "date": "",
    "desc": "The public Kaggle notebook that its author names as the intended way to reproduce the second-milestone solution."
   },
   {
    "title": "Comparing the Milestone 2 winning solutions",
    "url": "https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/discussion/744792",
    "by": "Tong Hui Kang",
    "date": "",
    "desc": "A side-by-side forum table of how the three winning solutions configure models, memory, serving and patches, with their links."
   },
   {
    "title": "Built on Tufa Labs duck harness - Milestone 2",
    "url": "https://www.kaggle.com/code/lordhansolo/built-on-tufa-labs-duck-harness-milestone-2",
    "by": "Lord Han Solo (lordhansolo)",
    "date": "",
    "desc": "Kaggle notebook for lordhansolo's Milestone 2 entry built on the duck harness, the code companion to the write-up already listed."
   }
  ]
 },
 {
  "id": "agents",
  "title": "Open-source agents and harnesses",
  "blurb": "Code you can read and run.",
  "items": [
   {
    "title": "TWIN",
    "url": "https://github.com/Alexyskoutnev/TWIN-ARC-AGI-3",
    "by": "Alexy Skoutnev and co-authors",
    "date": "2026-07-31",
    "desc": "A coding agent that writes an executable copy of each game, validates it against observed transitions, and spends scored actions only on checked plans or probes."
   },
   {
    "title": "Kepler",
    "url": "https://github.com/Cveinnt/kepler",
    "by": "Wensen Wu",
    "date": "2026-08-08",
    "desc": "A harness that treats hypotheses as executable world models and publishes its ledgers, resource accounting, negative results and integrity incidents."
   },
   {
    "title": "arc-skill",
    "url": "https://github.com/pbshgthm/arc-skill",
    "by": "Poobesh Gowtham (pbshgthm)",
    "date": "2026-08-19",
    "desc": "An installable agent skill and command-line tool built around one rule, stating what an action will do before spending it, with a write-up at arc-skill.vercel.app."
   },
   {
    "title": "TELL",
    "url": "https://github.com/studio-dots-ai/TELL",
    "by": "Dots Post-Train Team (studio-dots-ai)",
    "date": "2026-04-02",
    "desc": "A single-agent setup using one conversation per game, three tools and one persistent memory file that it updates as it tests hypotheses."
   },
   {
    "title": "ARC-AGI Arcade",
    "url": "https://github.com/agno-agi/arc-agi-arcade",
    "by": "Agno",
    "date": "2026-08-23",
    "desc": "A public playground of agents on the public games that compares models, reasoning effort, and cold, warm or seeded knowledge."
   },
   {
    "title": "How Retrodict was built",
    "url": "https://blog.ryanbbrown.com/p/how-i-accidentally-got-the-top-score",
    "by": "Ryan Brown",
    "date": "2026-07-29",
    "desc": "A dated build log of a minimal harness, covering each feature added and why token use per action was the main difference from a strict simulator agent."
   },
   {
    "title": "Hill-climbing ARC-AGI-3",
    "url": "https://blog.alexisfox.dev/arcagi3",
    "by": "Alexis Fox, Junlin Wang, Paul Rosu, Bhuwan Dhingra (DukeNLP)",
    "date": "2026-03-08",
    "desc": "A write-up from the preview-game period on how far minimal tooling can push LLM agents, by letting a coding agent read, search and script over a saved game log."
   },
   {
    "title": "Continual Harness on ARC-AGI-3",
    "url": "https://github.com/feng-rrRay/Continual-Harness-ARC-AGI-3",
    "by": "feng-rrRay (Ruirong Feng is a paper co-author; identity not confirmed)",
    "date": "2026-05-17",
    "desc": "The ARC-AGI-3 implementation of Continual Harness, an agent that refines its own stores during a single run, with a Hermes baseline for comparison."
   },
   {
    "title": "tonghuikang/daniel-franzen-arc-agi-3",
    "url": "https://github.com/tonghuikang/daniel-franzen-arc-agi-3",
    "by": "Tong Hui Kang",
    "date": "",
    "desc": "A fork of Daniel Franzen's Milestone 2 solution that adds a comparison of the three Milestone 2 winning notebooks and copies of those notebooks for reading side by side."
   },
   {
    "title": "OY1 harness",
    "url": "https://github.com/OYLabsAI/arc-agi-3-api-harness",
    "by": "OY Labs",
    "date": "2026-09-09",
    "desc": "API harness that lets a model retrieve exact earlier frames, keep notes tied to evidence and check predicted outcomes as it acts, published with results, replays and reproduction steps."
   },
   {
    "title": "OPINE-World: Programmatic World Modeling for ARC-AGI-3",
    "url": "https://david-courtis.github.io/opine-world/",
    "by": "David Courtis, Wenhao Li, Scott Sanner (University of Toronto, D3M Lab)",
    "date": "",
    "desc": "Project page for a programmatic world-modeling agent that keeps provisional objects and incomplete explanations in an exploration-driven Bayesian hypothesis space, with links to the code and paper."
   },
   {
    "title": "Agentica on ARC-AGI-3",
    "url": "https://www.symbolica.ai/blog/arc-agi-3",
    "by": "Symbolica",
    "date": "2026-03-25",
    "desc": "Symbolica's post on running its Agentica framework on the public games, with a game gallery, a per-level breakdown and a link to the code."
   },
   {
    "title": "Daniel Franzen's Milestone 2 solution",
    "url": "https://github.com/da-fr/arc-agi-3-solution",
    "by": "Daniel Franzen",
    "date": "",
    "desc": "A modified Duck harness with changes to serving, cache retention, compute scheduling and agent tools, with a detailed write-up."
   },
   {
    "title": "Arcgentica",
    "url": "https://github.com/symbolica-ai/ARC-AGI-3-Agents",
    "by": "Symbolica",
    "date": "",
    "desc": "A fork of the official agents repository that adds an orchestrator-and-subagents harness built on the Agentica SDK."
   },
   {
    "title": "Schema",
    "url": "https://github.com/guanning03/Schema",
    "by": "Guanning Zeng and co-authors",
    "date": "",
    "desc": "The official code for a harness in which an agent writes each environment's rules as a program, tests it against history and plans with it."
   },
   {
    "title": "VISTA",
    "url": "https://github.com/joshhhhhan/VISTA",
    "by": "Qiushi Han, Keya Hu, Linlu Qiu, Cathy Wu, Kaiming He (MIT)",
    "date": "",
    "desc": "A visual harness, MIT-licensed, that lets multimodal models revisit and reorganize their visual input during long tasks."
   },
   {
    "title": "PRO-LONG",
    "url": "https://github.com/alexisfox7/PRO-LONG",
    "by": "Alexis Fox, Junlin Wang, Paul Rosu, Bhuwan Dhingra",
    "date": "",
    "desc": "Programmatic memory that logs everything outside the context window and lets the agent search it with code."
   },
   {
    "title": "Tycho",
    "url": "https://github.com/NIMI-research/Tycho",
    "by": "Jens Lehmann, Andrei Aioanei, Sahar Vahdati (NIMI Research)",
    "date": "",
    "desc": "An Apache-2.0 self-directed agent harness that can turn what it observes into an executable hypothesis of the game, built on rendered deterministic Moore machines."
   },
   {
    "title": "Retrodict",
    "url": "https://github.com/ryanbbrown/Retrodict",
    "by": "Ryan Brown",
    "date": "",
    "desc": "An agent that logs every game frame, tests hypotheses against that log with code and only then commits moves with predicted boards."
   },
   {
    "title": "ARC-AGI-3 General Agents",
    "url": "https://github.com/astroseger/arc-3-agents-baseline1",
    "by": "Sergey Rodionov",
    "date": "",
    "desc": "The project page for experiments with coding agents that use no game-specific code or prompts across games."
   },
   {
    "title": "OPINE-World",
    "url": "https://github.com/david-courtis/opine-world",
    "by": "David Courtis, Wenhao Li, Scott Sanner",
    "date": "",
    "desc": "Code for programmatic world modelling that revises its hypotheses and implementation as new evidence arrives."
   },
   {
    "title": "Polyphony Agent - ARC",
    "url": "https://github.com/Mininglamp-AI/polyphony-arc-3",
    "by": "Ruiyang Yu and co-authors (Mininglamp AI)",
    "date": "",
    "desc": "A training-free agent for small open models that keeps task knowledge in auditable tools, memory and policy code."
   },
   {
    "title": "arc-code",
    "url": "https://github.com/jerber/arc-code",
    "by": "jerber",
    "date": "",
    "desc": "Harness that runs stock Claude Code in a per-game sandbox with a shell, a filesystem and one action command, plus six complete session records."
   },
   {
    "title": "Prime Agent on ARC-AGI-3",
    "url": "https://github.com/PrimeIntellect-ai/arc-agi-3-prime-agent",
    "by": "Prime Intellect",
    "date": "",
    "desc": "Offline runner, prompt and per-game results for running the general Prime Agent on the public games, with each game in its own sandbox behind a local broker."
   },
   {
    "title": "ARC-AGI-3 agent on Strands and Bedrock",
    "url": "https://github.com/aws-samples/sample-strands-agents-bedrock-arc-agi-3",
    "by": "AWS Samples",
    "date": "",
    "desc": "Coding agent built on the Strands Agents SDK and Amazon Bedrock, based on PRO-LONG, that works out each game by writing and running code against its action log."
   },
   {
    "title": "ARC-AGI-3 on HUD",
    "url": "https://github.com/hud-evals/ARC-AGI-3",
    "by": "HUD",
    "date": "",
    "desc": "The public games packaged as a HUD environment that vendors the official agent loop and uses official scorecards, exposing look and act tools over MCP."
   },
   {
    "title": "EvoPolicyGym",
    "url": "https://github.com/Linzwcs/EvoPolicyGym",
    "by": "Linzwcs",
    "date": "",
    "desc": "Evaluation framework where coding agents evolve executable policies from bounded feedback, with an ARC-AGI-3 environment covering version-pinned public games and custom collections."
   }
  ]
 },
 {
  "id": "notebooks",
  "title": "Kaggle notebooks",
  "blurb": "Public notebooks: sample submissions and working entries.",
  "items": [
   {
    "title": "🔓 Fable & Astra Play ARC-3: Guide, Analysis & Harness Layer",
    "url": "https://www.kaggle.com/code/leoprovorov/fable-astra-play-arc-3-guide-analysis-har",
    "by": "AlekseiProvorov",
    "date": "2026-11-01",
    "desc": "A notebook with a 90-page handbook that follows one level of the game sk48 through two systems, then describes each part of the open harness, the scoring math and a small added harness layer."
   },
   {
    "title": "ARC-AGI-3: Gemma-4-31B Reflection Agent",
    "url": "https://www.kaggle.com/code/ko0kip/arc-agi-3-gemma-4-31b-reflection-agent",
    "by": "Quanyi Li",
    "date": "",
    "desc": "A notebook that serves Gemma 4 locally with vLLM and uses structured output to choose one valid action at each step, running through the official agent framework."
   },
   {
    "title": "Simplified submission approach",
    "url": "https://www.kaggle.com/code/jeroencottaar/simplified-submission-approach",
    "by": "Jeroen Cottaar",
    "date": "",
    "desc": "A smaller starter notebook with a random solver that plays the public games when not submitting and the test games when submitting, with diagnostics."
   },
   {
    "title": "ARC3 Sample Submission - Random Agent",
    "url": "https://www.kaggle.com/code/inversion/arc3-sample-submission-random-agent",
    "by": "inversion (competition sample)",
    "date": "",
    "desc": "The sample submission notebook with a random agent, showing the setup a valid entry needs."
   },
   {
    "title": "ARC3 Sample Submission - Stochastic Goose",
    "url": "https://www.kaggle.com/code/inversion/arc3-sample-submission-stochastic-goose",
    "by": "inversion (competition sample)",
    "date": "",
    "desc": "A sample notebook packaging the preview-competition StochasticGoose agent, a CNN-based action-learning agent by Dries Smit and Jack Cole, as a competition submission."
   },
   {
    "title": "ARC3 Sample Submission - Just Explore",
    "url": "https://www.kaggle.com/code/inversion/arc3-sample-submission-just-explore",
    "by": "inversion (competition sample)",
    "date": "",
    "desc": "A sample notebook packaging the arc-agi-3-just-explore graph-exploration agent as a competition submission."
   },
   {
    "title": "Affectify ARC notebook",
    "url": "https://www.kaggle.com/code/shiiin9/affectify-arc-31-54-in-a-single-sub",
    "by": "shiiin9, Affectify team (Osaka Metropolitan University)",
    "date": "2026-10-04",
    "desc": "Public Kaggle notebook that changes how Daniel Franzen's ARC-AGI-3 Milestone 2 notebook ranks games when handing out model slots."
   },
   {
    "title": "ARC-AGI-3: GPT-OSS-120B",
    "url": "https://www.kaggle.com/code/gregkamradt/arc-agi-3-gpt-oss-120b",
    "by": "Greg Kamradt",
    "date": "",
    "desc": "The official ARC Prize Kaggle template notebook that some first-milestone submissions were built on."
   },
   {
    "title": "taaf-duck-harness-kaggle",
    "url": "https://www.kaggle.com/code/jeroencottaar/taaf-duck-harness-kaggle",
    "by": "Jeroen Cottaar",
    "date": "",
    "desc": "Kaggle notebook of the duck harness on the Tufa framework, published by a member of the Tufa Labs team."
   }
  ]
 },
 {
  "id": "papers",
  "title": "Papers",
  "blurb": "Research on ARC-AGI-3, newest first.",
  "items": [
   {
    "title": "Algebraic World Model: From Exploration to Proofs",
    "url": "https://arxiv.org/abs/2610.40503",
    "by": "Guancheng Pan, Qixin Tan, Yang Yuan, Andrew Chi-Chih Yao",
    "date": "2026-10-29",
    "desc": "Turns exploration into typed mathematical models and formalizes them in Lean 4 to prove whether a goal is reachable."
   },
   {
    "title": "How Humans Learn Unfamiliar Worlds: A Think-Aloud Dataset on ARC-AGI-3",
    "url": "https://arxiv.org/abs/2610.34523",
    "by": "Shuzhi Liu, Archana Warrier, Dat Nguyen, Chengqi Zheng, Kevin Ellis, Yewen Pu",
    "date": "2026-10-25",
    "desc": "A paper describing and analyzing a dataset of human play on the public games with synchronized think-aloud audio and annotations, alongside LLM agent trajectories."
   },
   {
    "title": "Can LLMs Improve Their Own Harness? A Controlled Study on ARC-AGI-3",
    "url": "https://arxiv.org/abs/2610.30499",
    "by": "Jens Lehmann, Sahar Vahdati",
    "date": "2026-10-21",
    "desc": "A controlled study in which models build a complete task harness from a fixed bootstrap, then revise it twice while each version is evaluated on held-out games."
   },
   {
    "title": "When the harness decides success: state that cannot be re-observed",
    "url": "https://arxiv.org/abs/2610.26632",
    "by": "Raimondas Lencevicius",
    "date": "2026-10-19",
    "desc": "Asks when context choices such as truncation and replayed reasoning change whether an agent succeeds, and breaks down the gap between ARC-AGI-3's Standard and Provider Adapter harnesses."
   },
   {
    "title": "Improving Environment-Agnostic Agents: The Role of Scaffolding",
    "url": "https://arxiv.org/abs/2610.22289",
    "by": "Sergey Rodionov",
    "date": "2026-10-15",
    "desc": "Study of a Codex-based agent across ARC-AGI-3, AGI Maze and Terminal-Bench that compares nearly identical prompts and a scripted controller."
   },
   {
    "title": "Tracing the Thoughts of a Coding Agent Playing ARC-AGI-3: Lessons for Continual Learning",
    "url": "https://arxiv.org/abs/2610.11450",
    "by": "Chen Wu, Josh Passenger, Yin Song",
    "date": "2026-10-08",
    "desc": "A measurement protocol that follows each belief, rule or plan through the files a coding agent writes, to study how it learns across levels."
   },
   {
    "title": "Memento 3: Model-Based Recursive Self-Improvement through Reflective Rulebooks",
    "url": "https://arxiv.org/abs/2610.11794",
    "by": "Haoyu Zhao and co-authors",
    "date": "2026-10-08",
    "desc": "Frozen LLM agents keep a revisable natural-language rulebook as external memory to learn world models."
   },
   {
    "title": "VISTA: A Visual Harness for Reasoning in an Interactive World",
    "url": "https://arxiv.org/abs/2610.02200",
    "by": "Qiushi Han, Keya Hu, Linlu Qiu, Cathy Wu, Kaiming He",
    "date": "2026-10-01",
    "desc": "Paper on a harness that lets a multimodal model perceive directly, keep a lossless visual memory and reorganize its visual input."
   },
   {
    "title": "Kepler: Auditable World Models for ARC-AGI-3",
    "url": "https://arxiv.org/abs/2610.00834",
    "by": "Wensen Wu",
    "date": "2026-09-30",
    "desc": "Describes a harness and three evaluation failures, including source-code leakage and a repair that masked a broken planner, and proposes stricter ways to report public-set results."
   },
   {
    "title": "Schema: Discovering Unknown Environments via Agentic Program Induction",
    "url": "https://arxiv.org/abs/2609.39140",
    "by": "Guanning Zeng and co-authors",
    "date": "2026-09-30",
    "desc": "Introduces a harness that organizes learning and action through interactive program induction."
   },
   {
    "title": "Scaling Discovery through Test-Time Communication",
    "url": "https://arxiv.org/abs/2609.21032",
    "by": "Jongho Park, Vasilis Kontonis, Shivam Garg, Akshay Krishnamurthy, Dimitris Papailiopoulos",
    "date": "2026-09-17",
    "desc": "Studies whether letting parallel agents share discoveries during a task helps on hard problems, starting with ARC-AGI-3."
   },
   {
    "title": "Prime Agent: A Self-Improving RLM Harness",
    "url": "https://arxiv.org/abs/2608.23552",
    "by": "Seth Karten et al.",
    "date": "2026-08-24",
    "desc": "Paper on an open-source harness combining a persistent Python REPL, memory and skill preservation, and coordinating subagents, tested on ARC-AGI-3."
   },
   {
    "title": "Twin: Playing an Unknown Game with a Test-Time Digital Twin",
    "url": "https://arxiv.org/abs/2608.14490",
    "by": "Alexy Skoutnev, Kirill Acharya, Gaston Longhitano, Madeleine Udell, Kevin Ellis, Iddo Drori",
    "date": "2026-08-14",
    "desc": "A coding agent writes an executable model at test time and turns prediction mismatches into counterexamples, finding that inferring the goal is the harder problem."
   },
   {
    "title": "The LLM Proposes, the Executive Disposes",
    "url": "https://arxiv.org/abs/2608.04066",
    "by": "Mohsen Arjmandi",
    "date": "2026-08-04",
    "desc": "Paper on an architecture where a deterministic executive owns all beliefs and the model only files typed proposals, instrumented on ARC-AGI-3 runs."
   },
   {
    "title": "Tycho: Active Abstraction with Programmatic World Models for ARC-AGI-3",
    "url": "https://arxiv.org/abs/2607.28287",
    "by": "Jens Lehmann, Andrei Aioanei, Sahar Vahdati",
    "date": "2026-07-30",
    "desc": "Formalizes the games as deterministic Moore machines and compares orchestration policies for when an agent should build, repair, use or bypass a model."
   },
   {
    "title": "PRO-LONG: Programmatic Memory Enables Long-Horizon Reasoning",
    "url": "https://arxiv.org/abs/2607.20064",
    "by": "Alexis Fox, Junlin Wang, Paul Rosu, Bhuwan Dhingra",
    "date": "2026-07-22",
    "desc": "A context-management framework that keeps a complete interaction log and searches it with programmatic tools, tested on NetHack and ARC-AGI-3."
   },
   {
    "title": "Do Coding Agents Need Executable World Models, Simplification, and Verification to Solve ARC-AGI-3?",
    "url": "https://arxiv.org/abs/2607.15439",
    "by": "Sergey Rodionov",
    "date": "2026-07-16",
    "desc": "Compares four coding-agent variants to separate what executable world models, simplification prompts and replay verification each contribute."
   },
   {
    "title": "Rethinking the Evaluation of Harness Evolution for Agents",
    "url": "https://arxiv.org/abs/2607.12227",
    "by": "Yike Wang et al.",
    "date": "2026-07-14",
    "desc": "Paper arguing automatic harness evolution is poorly evaluated, mainly on Terminal-Bench 2.1, with ARC-AGI-3 used as a long-horizon game case."
   },
   {
    "title": "OPINE-World: Programmatic World Modeling with Ontology-error-Prioritized Interactive Exploration for ARC-AGI-3",
    "url": "https://arxiv.org/abs/2607.01531",
    "by": "David Courtis, Wenhao Li, Scott Sanner",
    "date": "2026-07-01",
    "desc": "Programmatic world modelling for cases where the symbolic representation and goal are unknown and keep changing."
   },
   {
    "title": "Explore Before You Solve: The Speed-Depth Trade-off in Epistemic Agents for ARC-AGI-3",
    "url": "https://arxiv.org/abs/2605.25931",
    "by": "Liew Keong Han",
    "date": "2026-05-25",
    "desc": "Argues that all public games can be progressed through non-intelligent strategies, reports a library-level bug, and presents a three-phase exploring agent on a tiny model."
   },
   {
    "title": "MAP: A Map-then-Act Paradigm for Long-Horizon Interactive Agent Reasoning",
    "url": "https://arxiv.org/abs/2605.13037",
    "by": "Yuxin Liu et al.",
    "date": "2026-05-13",
    "desc": "Paper proposing that agents explore, build a structured map of the task and then act from it, evaluated on the ARC-AGI-3 public games."
   },
   {
    "title": "Workspace Optimization: How to Train Your Agent",
    "url": "https://arxiv.org/abs/2605.09650",
    "by": "Elad Sarafian, Gal Kaplun, Ron Banner, Daniel Soudry, Boris Ginsburg",
    "date": "2026-05-10",
    "desc": "Argues the trainable part of an agent is its external workspace; the paper behind NVIDIA's DreamTeam."
   },
   {
    "title": "Executable World Models for ARC-AGI-3 in the Era of Coding Agents",
    "url": "https://arxiv.org/abs/2605.05138",
    "by": "Sergey Rodionov",
    "date": "2026-05-06",
    "desc": "Evaluates a coding agent that keeps a Python world model, verifies it against past observations and plans through it."
   },
   {
    "title": "ARC-AGI-3: A New Challenge for Frontier Agentic Intelligence",
    "url": "https://arxiv.org/abs/2603.24621",
    "by": "ARC Prize Foundation",
    "date": "2026-03-24",
    "desc": "The benchmark paper on novel turn-based environments, Core Knowledge priors, efficiency-based scoring and human calibration."
   },
   {
    "title": "Sensi: Learn One Thing at a Time",
    "url": "https://arxiv.org/abs/2603.17683",
    "by": "Mohsen Arjmandi",
    "date": "2026-03-18",
    "desc": "Paper on a game agent built for ARC-AGI-3 with a perception and action split and a state-machine curriculum, including a report of how it failed."
   },
   {
    "title": "The ARC of Progress towards AGI: A Living Survey of Abstraction and Reasoning",
    "url": "https://arxiv.org/abs/2603.13372",
    "by": "Sahar Vahdati, Andrei Aioanei, Haridhra Suresh, Jens Lehmann",
    "date": "2026-03-09",
    "desc": "A survey of published approaches across the three ARC-AGI benchmark versions and the 2024 and 2025 competitions, capturing the field as of February 2026."
   },
   {
    "title": "ARC Prize 2025: Technical Report",
    "url": "https://arxiv.org/abs/2601.10904",
    "by": "François Chollet, Mike Knoop, Gregory Kamradt, Bryan Landers",
    "date": "2026-01-15",
    "desc": "The organizers' report on the 2025 competition and its top methods, with a preview of ARC-AGI-3's interactive challenges."
   },
   {
    "title": "Graph-Based Exploration for ARC-AGI-3 Interactive Reasoning Tasks",
    "url": "https://arxiv.org/abs/2512.24156",
    "by": "Evgenii Rudakov, Jonathan Shock, Benjamin Ultan Cowley",
    "date": "2025-12-30",
    "desc": "A paper presenting a training-free agent built on frame segmentation, visual salience and a graph of visited states, offered as an exploration baseline."
   },
   {
    "title": "On the Measure of Intelligence",
    "url": "https://arxiv.org/abs/1911.01547",
    "by": "Francois Chollet",
    "date": "2019-11-05",
    "desc": "The founding paper of the ARC series, defining intelligence as skill-acquisition efficiency and introducing the original benchmark."
   }
  ]
 },
 {
  "id": "training",
  "title": "Games to train on",
  "blurb": "Other people's game sets and game makers. Check them against your own bar.",
  "items": [
   {
    "title": "NVIDIA Game Creator (in DreamTeam)",
    "url": "https://github.com/NVIDIA/dream-team/tree/main/arc_agi_3/game_creator",
    "by": "NVIDIA",
    "date": "2026-07-15",
    "desc": "A component that generates eight-level ARC-AGI-3-style games from seed words using LLM agents, shipped with curated generated games that have replay-checked solutions."
   },
   {
    "title": "ARC-AGI-3 Training Data",
    "url": "https://github.com/SimonOuellette35/ARC-AGI-3-Training-Data",
    "by": "Simon Ouellette",
    "date": "",
    "desc": "Games, solvers and demonstration generators that bring ARC-AGI-3 public games, MiniGrid, Procgen, PuzzleScript and homemade games into one 64x64 format."
   },
   {
    "title": "ARC-Interactive (Red Pill/Blue Pill games)",
    "url": "https://github.com/theredbluepill/arc-interactive",
    "by": "theredbluepill",
    "date": "",
    "desc": "An MIT-licensed collection of community game environments for ARC-AGI-3, with tutorial games, local human play and guides for authoring games with LLM agents."
   }
  ]
 },
 {
  "id": "data",
  "title": "Datasets and results",
  "blurb": "Agent traces, published results and ways to read them.",
  "items": [
   {
    "title": "What a model guesses from one game frame",
    "url": "/arc3/hypotheses",
    "by": "ARC Explainer",
    "date": "",
    "desc": "Research on what a local model hypothesises from one unseen frame and what thinking controls change, with browsable outputs."
   },
   {
    "title": "Open-sourcing winning-trajectory datasets + a LoRA for the duck harness (STaR fine-tuning)",
    "url": "https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/discussion/739047",
    "by": "manas joshi",
    "date": "",
    "desc": "A post sharing CC0 datasets of level-completing Duck trajectories, a pilot LoRA adapter and per-game offline evaluation logs, with fine-tuning gotchas."
   },
   {
    "title": "ARC-AGI-3: Human VCGT Dataset",
    "url": "https://www.kaggle.com/datasets/magicsword001/acr-agi-3-human-vcgt/data",
    "by": "MagicSword",
    "date": "",
    "desc": "A dataset built from the official human recordings that pairs gameplay video with LLM-written explanations for imitation learning."
   },
   {
    "title": "ARC-AGI-3 Qwen3.6 Duck + 300-Game Diagnostics",
    "url": "https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/discussion/731522",
    "by": "yw8837",
    "date": "",
    "desc": "A post releasing a notebook built on the Duck harness and an experiment ledger of official submissions with per-game diagnostic rows for each run."
   },
   {
    "title": "ARC3 Human Think-Aloud",
    "url": "https://huggingface.co/datasets/hellohawaii/ARC3-human-think-aloud",
    "by": "Shuzhi Liu, Archana Warrier, Dat Nguyen, Chengqi Zheng, Kevin Ellis, Yewen Pu",
    "date": "2026-10-29",
    "desc": "Human gameplay actions on the 25 public games paired with think-aloud recordings and time-stamped transcripts, plus LLM agent trajectories, with an interactive explorer at arc3-human-think-aloud.github.io."
   },
   {
    "title": "Kepler 1.0 ARC-AGI-3 trace corpus",
    "url": "https://huggingface.co/datasets/cveinnt/kepler-arc-agi-3-traces",
    "by": "Wensen Wu (cveinnt)",
    "date": "2026-09-30",
    "desc": "Run artifacts from the Kepler 1.0 release on the public games, including run records, event files and agent session logs."
   },
   {
    "title": "ARC-AGI-3 Leaderboard History",
    "url": "https://arc3.huikang.dev/leaderboard",
    "by": "Tong Hui Kang",
    "date": "",
    "desc": "An independent page showing each team's public score by day, with ARC-AGI-3 and ARC-AGI-2 views."
   },
   {
    "title": "ARC-AGI Results",
    "url": "https://arcprize.org/results",
    "by": "ARC Prize Foundation",
    "date": "",
    "desc": "ARC Prize's per-model results across the ARC-AGI benchmarks, including reasoning variants."
   },
   {
    "title": "GPT-6 Astra results",
    "url": "https://arcprize.org/results/openai-gpt-6-astra",
    "by": "ARC Prize Foundation",
    "date": "",
    "desc": "ARC Prize's page for one model, GPT-6 Astra, listing its harness configurations and linking to replays of its runs."
   },
   {
    "title": "Astra published notes across 25 games",
    "url": "https://arc3.sonpham.net/astra-notes.html",
    "by": "The ARC-3 team, on Son Pham's site",
    "date": "2026-10-05",
    "desc": "A check of what GPT-6 Astra's published written notes do and do not explain, game by game and across effort settings."
   },
   {
    "title": "Astra reasoning traces audit",
    "url": "https://github.com/82deutschmark/arc-explainer/blob/main/docs/astra/reasoning-trace-audit.md",
    "by": "Claude Opus 5 (Bubba), in the Boss's arc-explainer repo",
    "date": "2026-09-06",
    "desc": "An audit of the published GPT-6 Astra reasoning traces, recomputed from raw replay recordings, on colour claims and 'the developer is absent' language."
   },
   {
    "title": "ARC-AGI-3 Schema Gameplay Trajectories",
    "url": "https://huggingface.co/datasets/schema-harness/arc-agi-3-schema-traces",
    "by": "Schema authors",
    "date": "2026-07-16",
    "desc": "A public dataset of Schema gameplay trajectories from frontier-model runs in two collections, with human action baselines, manifests and a standalone rescoring script."
   },
   {
    "title": "ARC-AGI-3 public demo human testing",
    "url": "https://huggingface.co/datasets/magic-sword/arc_agi_3_public_demo_human_testing",
    "by": "magic-sword (card credits ARC Prize as the data's origin)",
    "date": "",
    "desc": "Human gameplay logs from the public demo as Parquet, one row per session, with timestamped events, levels completed, actions and resets."
   },
   {
    "title": "HHazard ARC-AGI-3 human transitions",
    "url": "https://huggingface.co/datasets/HHazard/arc-agi-3",
    "by": "HHazard",
    "date": "",
    "desc": "Per-game Parquet splits of state, action and next-state transitions on 64 by 64 grids, tagged with origin and player."
   },
   {
    "title": "ARC-AGI-3 World Model Traces",
    "url": "https://huggingface.co/datasets/fredericowieser/arc-agi-3-wm-traces",
    "by": "fredericowieser",
    "date": "",
    "desc": "Large transition dataset for training world models that mixes human traces, scripted rollouts and generated-game traces in separate splits."
   },
   {
    "title": "ARA Labs ARC-AGI-3 full agent records (example: Opus 4.8 on g50t)",
    "url": "https://huggingface.co/datasets/AgentNativeResearchLab/arc-agi3-cc-opus4.8-g50t",
    "by": "ARA Labs (Agent-Native Research Lab)",
    "date": "",
    "desc": "One repo from a harness, model and game grid of agent records holding reasoning traces, frame recordings, replay scripts, scorecards and token accounting."
   },
   {
    "title": "ARC-AGI-3 public-set audit",
    "url": "https://github.com/ibrahimmian36/arc-agi-3-audit",
    "by": "Millennium Research (ibrahimmian36)",
    "date": "",
    "desc": "Audit comparing the documented and implemented scoring rule, the human baselines and the released human replays against the open toolkit and benchmarking harness."
   }
  ]
 },
 {
  "id": "official",
  "title": "From ARC Prize",
  "blurb": "The benchmark's own pages, reports and analysis.",
  "items": [
   {
    "title": "Announcing ARC Prize Verified",
    "url": "https://arcprize.org/blog/arc-prize-verified-program",
    "by": "Greg Kamradt, ARC Prize",
    "date": "2025-11-04",
    "desc": "Describes the program that certifies benchmark scores on official hidden datasets and the independent academic panel that audits the process."
   },
   {
    "title": "ARC-AGI-3 overview",
    "url": "https://arcprize.org/arc-agi/3",
    "by": "ARC Prize Foundation",
    "date": "",
    "desc": "The official benchmark page, with links to play, the public game set, human leaderboards, docs and the competition."
   },
   {
    "title": "ARC-AGI-3: A New Challenge for Frontier Agentic Intelligence (technical report, PDF)",
    "url": "https://arcprize.org/media/ARC_AGI_3_Technical_Report.pdf",
    "by": "ARC Prize Foundation",
    "date": "2026-04-22",
    "desc": "The official report on the benchmark's design, its scoring against human action baselines and how the environments were built, validated and calibrated with human testers."
   },
   {
    "title": "Announcing ARC-AGI-3",
    "url": "https://arcprize.org/blog/arc-agi-3-launch",
    "by": "Greg Kamradt, ARC Prize",
    "date": "2026-03-25",
    "desc": "The launch post explaining what the benchmark is and how its turn-based, instruction-free environments work."
   },
   {
    "title": "ARC Prize Verified Testing Policy",
    "url": "https://arcprize.org/policy",
    "by": "ARC Prize Foundation",
    "date": "",
    "desc": "The rules for verified scores, including the difference between the Standard and Provider Adapter harnesses."
   },
   {
    "title": "ARC-AGI-3 Preview: 30-Day Learnings",
    "url": "https://arcprize.org/blog/arc-agi-3-preview-30-day-learnings",
    "by": "Greg Kamradt, ARC Prize",
    "date": "2025-08-19",
    "desc": "ARC Prize's account of the preview's first month, covering human and AI play on the first three public games, action-efficiency scoring and the preview agent contest."
   },
   {
    "title": "OpenAI's GPT-6 Astra on ARC-AGI-3",
    "url": "https://arcprize.org/blog/astra",
    "by": "Greg Kamradt, ARC Prize",
    "date": "2026-09-03",
    "desc": "ARC Prize's analysis of one model's play, including why it now reports two kinds of harness separately."
   },
   {
    "title": "Analyzing GPT-5.5 & Opus 4.7 with ARC-AGI-3",
    "url": "https://arcprize.org/blog/arc-agi-3-gpt-5-5-opus-4-7-analysis",
    "by": "Greg Kamradt, ARC Prize",
    "date": "2026-05-01",
    "desc": "A review of replays and reasoning traces from two models that names recurring failure modes; the post also announces an open-source analysis package."
   },
   {
    "title": "ARC Prize resources library",
    "url": "https://arcprize.org/resources",
    "by": "ARC Prize Foundation",
    "date": "",
    "desc": "ARC Prize's own library of papers, videos, code, tools, courses and articles across all ARC benchmarks."
   },
   {
    "title": "ARC Prize history",
    "url": "https://arcprize.org/history",
    "by": "ARC Prize",
    "date": "",
    "desc": "Timeline of the project from the 2019 paper through the Kaggle contests to the 2026 launch of ARC-AGI-3."
   }
  ]
 },
 {
  "id": "docs",
  "title": "Official docs",
  "blurb": "ARC Prize's documentation: the toolkit, the API, the game format and agent templates.",
  "items": [
   {
    "title": "Agents Quickstart",
    "url": "https://docs.arcprize.org/agents-quickstart",
    "by": "ARC Prize",
    "date": "",
    "desc": "Shows how to clone the agents repo and run a first random agent against a game, and links a tutorial video."
   },
   {
    "title": "Create Your Own Agent",
    "url": "https://docs.arcprize.org/create-agent",
    "by": "ARC Prize",
    "date": "",
    "desc": "Shows how to write a custom agent by implementing the required interface in the agents repo."
   },
   {
    "title": "LLM Agents",
    "url": "https://docs.arcprize.org/llm_agents",
    "by": "ARC Prize",
    "date": "",
    "desc": "Describes the language-model agent templates in the agents repo, how to run each one and how to handle malformed model output."
   },
   {
    "title": "Swarms",
    "url": "https://docs.arcprize.org/swarms",
    "by": "ARC Prize",
    "date": "",
    "desc": "Explains how to run an agent across multiple games at once, with scorecards opened and closed automatically."
   },
   {
    "title": "Benchmarking Tooling (Beta)",
    "url": "https://docs.arcprize.org/benchmarking-agent",
    "by": "ARC Prize",
    "date": "",
    "desc": "Explains a beta harness that runs model configurations against games, records each run and produces an online scorecard."
   },
   {
    "title": "GPT OSS on Kaggle template",
    "url": "https://docs.arcprize.org/partner_templates/gpt-oss-kaggle",
    "by": "ARC Prize; notebook by Greg Kamradt",
    "date": "",
    "desc": "Docs for a Kaggle notebook that runs GPT-OSS-120B as an agent on the competition's accelerator, including which parameters to tune."
   },
   {
    "title": "Anthropic template and Claude Code SDK",
    "url": "https://docs.arcprize.org/partner_templates/anthropic",
    "by": "ARC Prize; SDK by ThariqS",
    "date": "Repo last pushed 18 Jul 2025",
    "desc": "Docs for a Node SDK with helper scripts and an auto-solver that connect Claude Code to the ARC-AGI-3 API from the terminal."
   },
   {
    "title": "LangChain template",
    "url": "https://docs.arcprize.org/partner_templates/langchain",
    "by": "ARC Prize; two templates by Plank",
    "date": "",
    "desc": "LangGraph agent templates: multimodal, text-only, a random baseline and a thinking agent with long-term observations."
   },
   {
    "title": "Hugging Face template",
    "url": "https://docs.arcprize.org/partner_templates/huggingface",
    "by": "ARC Prize",
    "date": "",
    "desc": "Coding and vision agent templates built with smolagents."
   },
   {
    "title": "AgentOps template",
    "url": "https://docs.arcprize.org/partner_templates/agentops",
    "by": "ARC Prize",
    "date": "",
    "desc": "A reasoning agent template plus automatic AgentOps tracing for debugging agent runs."
   },
   {
    "title": "Scorecards",
    "url": "https://docs.arcprize.org/scorecards",
    "by": "ARC Prize",
    "date": "",
    "desc": "Explains how scorecards collect an agent's game results, the ways to get one and where to view them online."
   },
   {
    "title": "Recordings & Replays",
    "url": "https://docs.arcprize.org/recordings",
    "by": "ARC Prize",
    "date": "",
    "desc": "Explains which run methods produce recordings, how to view them online and how local recording files are laid out."
   },
   {
    "title": "ARC-AGI Toolkit Quickstart",
    "url": "https://docs.arcprize.org/toolkit/overview",
    "by": "ARC Prize",
    "date": "",
    "desc": "Getting-started guide for the open-source Python SDK for running, editing and creating ARC-AGI-3 environments locally or through the API."
   },
   {
    "title": "Local vs Online",
    "url": "https://docs.arcprize.org/local-vs-online",
    "by": "ARC Prize",
    "date": "",
    "desc": "Compares running games locally with running them through the API, including the trade-offs in speed, limits, scorecards and replays."
   },
   {
    "title": "Listen And Serve",
    "url": "https://docs.arcprize.org/toolkit/listen_and_serve",
    "by": "ARC Prize",
    "date": "",
    "desc": "Shows how to run the REST endpoints locally, which replicates how Kaggle runs a solution and allows other languages."
   },
   {
    "title": "Create ARC-AGI-3 Environment",
    "url": "https://docs.arcprize.org/add_game",
    "by": "ARC Prize",
    "date": "",
    "desc": "A walkthrough of building a new game with ARCEngine, including its file structure and complete example code."
   },
   {
    "title": "Edit Game",
    "url": "https://docs.arcprize.org/edit_games",
    "by": "ARC Prize",
    "date": "",
    "desc": "A guide to changing existing games in a local environments directory by creating new versions of them."
   },
   {
    "title": "Full Play Test",
    "url": "https://docs.arcprize.org/full-play-test",
    "by": "ARC Prize",
    "date": "",
    "desc": "Walks through a whole game using direct HTTP requests, to show what the toolkit does underneath."
   },
   {
    "title": "ARC-AGI-3 OpenAPI specification",
    "url": "https://docs.arcprize.org/arc3v1.yaml",
    "by": "ARC Prize",
    "date": "",
    "desc": "The machine-readable definition of the ARC-AGI-3 REST API."
   },
   {
    "title": "API Keys",
    "url": "https://docs.arcprize.org/api-keys",
    "by": "ARC Prize",
    "date": "",
    "desc": "Explains what a registered key unlocks and how to create one through a Google or GitHub login."
   },
   {
    "title": "Rate Limits",
    "url": "https://docs.arcprize.org/rate_limits",
    "by": "ARC Prize",
    "date": "",
    "desc": "States the API's request limit, its best-effort support terms and how to ask for an increase."
   },
   {
    "title": "ARC-AGI Toolkit Changelog",
    "url": "https://docs.arcprize.org/changelog",
    "by": "ARC Prize",
    "date": "Top entry 14 Apr 2026",
    "desc": "Announces the toolkit's release and later changes to scoring, scorecard rules and game versions."
   },
   {
    "title": "Feature Requests & Bugs",
    "url": "https://docs.arcprize.org/feature-requests",
    "by": "ARC Prize",
    "date": "",
    "desc": "Explains how to report toolkit problems or request features by opening a labelled issue in the ARC-AGI GitHub repository."
   },
   {
    "title": "ARC-AGI-3 Scoring Methodology",
    "url": "https://docs.arcprize.org/methodology",
    "by": "ARC Prize Foundation",
    "date": "",
    "desc": "Explains Relative Human Action Efficiency, the ARC-AGI-3 score, which compares an agent's actions per level with a baseline from first-time human players."
   },
   {
    "title": "Competition Mode",
    "url": "https://docs.arcprize.org/toolkit/competition_mode",
    "by": "ARC Prize Foundation",
    "date": "",
    "desc": "Lists the restrictions the toolkit enforces in competition mode, such as a single scorecard and level resets only; the Kaggle competition is forced into this mode."
   },
   {
    "title": "Game Schema",
    "url": "https://docs.arcprize.org/game-schema",
    "by": "ARC Prize Foundation",
    "date": "",
    "desc": "Defines game states, grid dimensions and cell values, the coordinate system and the game ID format."
   },
   {
    "title": "Actions",
    "url": "https://docs.arcprize.org/actions",
    "by": "ARC Prize Foundation",
    "date": "",
    "desc": "Describes the standard input interface of RESET and seven numbered actions, how each game exposes its available subset, and the keyboard controls for human players."
   },
   {
    "title": "ARC-AGI-3 documentation",
    "url": "https://docs.arcprize.org/",
    "by": "ARC Prize Foundation",
    "date": "",
    "desc": "The official quickstart, toolkit guide, REST API reference and API-key instructions for building agents."
   },
   {
    "title": "Vocabulary",
    "url": "https://docs.arcprize.org/vocabulary",
    "by": "ARC Prize",
    "date": "",
    "desc": "Glossary of the terms used across the ARC-AGI-3 docs, such as Arcade, Environment, Swarm and Toolkit."
   },
   {
    "title": "Sample ARC-AGI Toolkit Agent",
    "url": "https://docs.arcprize.org/toolkit/minimal",
    "by": "ARC Prize",
    "date": "",
    "desc": "Short Python example that plays ls20 with random actions through the toolkit, renders it in the terminal and prints the score."
   },
   {
    "title": "Render Games",
    "url": "https://docs.arcprize.org/toolkit/render-games",
    "by": "ARC Prize",
    "date": "",
    "desc": "Docs on displaying games with the built-in terminal and matplotlib renderers or a custom rendering function."
   },
   {
    "title": "EnvironmentWrapper",
    "url": "https://docs.arcprize.org/toolkit/environment_wrapper",
    "by": "ARC Prize",
    "date": "",
    "desc": "Reference for the Python class that gives local and remote environments one interface, including its reset and step methods."
   },
   {
    "title": "REST API overview",
    "url": "https://docs.arcprize.org/rest_overview",
    "by": "ARC Prize",
    "date": "",
    "desc": "Overview of running agents over the REST API: authentication, scorecards, sending actions and keeping session cookies."
   }
  ]
 },
 {
  "id": "tools",
  "title": "Engine and tools",
  "blurb": "The game engine, toolkits, and community tools for running and viewing games.",
  "items": [
   {
    "title": "ARC-AGI-3 and ARCEngine Explained",
    "url": "/arc3",
    "by": "ARC Explainer",
    "date": "",
    "desc": "Our reference on frames, actions, engine design, game creation, validation and scoring."
   },
   {
    "title": "arc-agi on PyPI",
    "url": "https://pypi.org/project/arc-agi/",
    "by": "ARC Prize Foundation",
    "date": "",
    "desc": "The installable Python package for the ARC-AGI Toolkit, with its readme and version history."
   },
   {
    "title": "ARC-AGI-3-Playground",
    "url": "https://github.com/InexperiencedMe/ARC-AGI-3-Playground",
    "by": "Inexperienced Me",
    "date": "",
    "desc": "A simplified rewrite of the official agents repo aimed mainly at non-LLM agents, where agents receive a frame array and return an action integer."
   },
   {
    "title": "ARC3 Offline Agent Evaluation and Recording Viewer",
    "url": "https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/discussion/687648",
    "by": "Duc-Cuong Le",
    "date": "",
    "desc": "A forum post sharing a notebook that runs an agent offline through the official path, computes per-game statistics and visualizes recordings."
   },
   {
    "title": "Offline vLLM on Kaggle: the wheelhouse pattern, mount-path gotchas, and env vars that bite",
    "url": "https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/discussion/738600",
    "by": "e.r",
    "date": "",
    "desc": "A participant's checklist for installing and running a local vLLM model server on Kaggle with no internet."
   },
   {
    "title": "tonghuikang/arc3",
    "url": "https://github.com/tonghuikang/arc3",
    "by": "Tong Hui Kang",
    "date": "",
    "desc": "The public code from a hackathon project that automatically searched for a model architecture to fit ARC-AGI-3 gameplay actions, plus the code for the author's leaderboard page."
   },
   {
    "title": "ARCEngine",
    "url": "https://github.com/arcprize/ARCEngine",
    "by": "ARC Prize Foundation",
    "date": "",
    "desc": "The MIT-licensed Python library for 2D sprite-based games that the ARC-AGI-3 environments are built on."
   },
   {
    "title": "ARC-AGI Toolkit",
    "url": "https://github.com/arcprize/ARC-AGI",
    "by": "ARC Prize Foundation",
    "date": "",
    "desc": "The official Python interface for agents to use ARC-AGI-3 environments locally or through the API."
   },
   {
    "title": "ARC-AGI-3-Agents",
    "url": "https://github.com/arcprize/ARC-AGI-3-Agents",
    "by": "ARC Prize Foundation",
    "date": "",
    "desc": "The official agent starter repository, including a random agent and templates."
   },
   {
    "title": "ARC-AGI-3 Kaggle Starter",
    "url": "https://github.com/arcprize/ARC-AGI-3-Kaggle-Starter",
    "by": "ARC Prize Foundation",
    "date": "",
    "desc": "A local starter kit for editing one Python file, playing games locally and pushing a Kaggle submission."
   },
   {
    "title": "arc-agi-3-benchmarking",
    "url": "https://github.com/arcprize/arc-agi-3-benchmarking",
    "by": "ARC Prize Foundation",
    "date": "",
    "desc": "ARC Prize's MIT-licensed code for evaluating models on ARC-AGI-3."
   },
   {
    "title": "Tufalabs/duck-harness",
    "url": "https://github.com/Tufalabs/duck-harness",
    "by": "Tufa Labs",
    "date": "",
    "desc": "The open-source code for the Duck harness, the first-milestone solution that later public solutions build on."
   },
   {
    "title": "NVIDIA/dream-team",
    "url": "https://github.com/NVIDIA/dream-team",
    "by": "NVIDIA",
    "date": "",
    "desc": "The code for DreamTeam, a multi-agent solver for interactive ARC-AGI-3 environments."
   },
   {
    "title": "ARC3.Games source",
    "url": "https://github.com/Poolminer/ARC3.Games",
    "by": "Poolminer",
    "date": "",
    "desc": "Source for a browser player that runs ARC-AGI-3 and custom ARCEngine games through PyScript, with an offline mode that skips the shared database."
   },
   {
    "title": "ARC AGI 3 SDK wheels offline",
    "url": "https://www.kaggle.com/datasets/seenmttai/arc-agi-3-sdk-wheels-offline",
    "by": "seenmttai",
    "date": "",
    "desc": "Kaggle dataset of Python wheels for arc_agi, arcengine and their dependencies, for installing them in a notebook without internet."
   }
  ]
 },
 {
  "id": "videos",
  "title": "Videos and talks",
  "blurb": "Launch talks, tutorials, interviews and podcasts.",
  "items": [
   {
    "title": "Prime Agent: Self-Improving RLM Harness with Seth Karten",
    "url": "https://www.youtube.com/watch?v=IBf6bdqHgTU",
    "by": "Deep Learning with Yacine",
    "date": "2026-10-23",
    "desc": "Interview with Prime Agent's lead author on why he thinks harness work will not simply be absorbed into model weights."
   },
   {
    "title": "Why The Harness Matters More Than The Model",
    "url": "https://www.youtube.com/watch?v=n9xKblqyQ28",
    "by": "Y Combinator (YC Paper Club)",
    "date": "2026-09-07",
    "desc": "Paper-club session with researchers and founders going through the state of agent harnesses."
   },
   {
    "title": "ARC-AGI-3 winning team - Millennia of minds, compressed into words.",
    "url": "https://www.youtube.com/watch?v=Vg6FBKTlfOw",
    "by": "Machine Learning Street Talk (Tim Scarfe)",
    "date": "2026-07-01",
    "desc": "A video interview with the Tufa Labs team about their ARC-AGI-3 work."
   },
   {
    "title": "Francois Chollet: Why Scaling Alone Isn't Enough for AGI",
    "url": "https://www.youtube.com/watch?v=k2ZLQC8P7dc",
    "by": "Y Combinator (Lightcone)",
    "date": "2026-03-27",
    "desc": "Long interview with Chollet on his path to the ARC Prize, with a segment on ARC-AGI-3 and measuring agents."
   },
   {
    "title": "ARC-AGI-3 (launch presentation)",
    "url": "https://www.youtube.com/watch?v=f_xT45Pi0UQ",
    "by": "ARC Prize",
    "date": "2026-03-25",
    "desc": "A recording of the presentation from the ARC-AGI-3 launch event at Y Combinator in San Francisco."
   },
   {
    "title": "AGI: Francois Chollet + Sam Altman",
    "url": "https://www.youtube.com/watch?v=XUu-i9Wbh-c",
    "by": "ARC Prize",
    "date": "2026-03-25",
    "desc": "A recording of the fireside chat from the ARC-AGI-3 launch event."
   },
   {
    "title": "How Intelligent Is AI, Really?",
    "url": "https://www.youtube.com/watch?v=pBlIgs6w7Ss",
    "by": "Y Combinator, Diana Hu with Greg Kamradt",
    "date": "2025-12-17",
    "desc": "Interview at NeurIPS 2025 on why most AI benchmarks fall short and how the ARC series is designed."
   },
   {
    "title": "How to measure intelligence? Six researchers debate",
    "url": "https://www.youtube.com/watch?v=9RnKGRDhCyo",
    "by": "ARC Prize",
    "date": "2025-11-03",
    "desc": "Panel with Chollet, Laura Schulz, Junyi Chu, Jacob Andreas, Josh Tenenbaum and others on whether and how intelligence can be measured."
   },
   {
    "title": "On Games and Play",
    "url": "https://www.youtube.com/watch?v=gpkReGuhr0g",
    "by": "Laura Schulz, ARC Prize",
    "date": "2025-10-29",
    "desc": "Talk at ARC Prize @ MIT by the head of MIT's Early Childhood Cognition Lab on what children's play shows about intelligence."
   },
   {
    "title": "Francois Chollet + Mike Knoop at ARC Prize @ MIT",
    "url": "https://www.youtube.com/watch?v=1u2DkoqEfhk",
    "by": "ARC Prize",
    "date": "2025-10-24",
    "desc": "Fireside chat between the ARC Prize co-founders on ARC-AGI-3 and measuring intelligence."
   },
   {
    "title": "ARC-AGI-3 and Action Efficiency",
    "url": "https://www.youtube.com/watch?v=bqNfIHedb3g",
    "by": "Greg Kamradt, ARC Prize",
    "date": "2025-10-23",
    "desc": "Talk at ARC Prize @ MIT previewing ARC-AGI-3 and how action efficiency is measured."
   },
   {
    "title": "ARC-AGI-3: The Interactive Reasoning Benchmark",
    "url": "https://www.youtube.com/watch?v=3vFu79ccDcc",
    "by": "Latent Space, with Greg Kamradt",
    "date": "2025-07-18",
    "desc": "Podcast preview of the benchmark covering how the games are designed for AI and why this differs from knowledge-based tests."
   },
   {
    "title": "Interactive Reasoning Benchmarks | ARC-AGI-3 Preview",
    "url": "https://www.youtube.com/watch?v=3T4OwBp6d90",
    "by": "ARC Prize",
    "date": "2025-07-17",
    "desc": "A recording of the presentation from the July 2025 ARC-AGI-3 preview event."
   },
   {
    "title": "ARC-AGI-3: Agent Tutorial",
    "url": "https://www.youtube.com/watch?v=xEVg9dcJMkw",
    "by": "ARC Prize Foundation",
    "date": "2025-07-14",
    "desc": "An official video tutorial from July 2025 on ARC-AGI-3 agents, still linked from the starter repository's README."
   },
   {
    "title": "Measuring AGI: Interactive Reasoning Benchmarks for ARC-AGI-3",
    "url": "https://www.youtube.com/watch?v=3XmFPwjG8pg",
    "by": "Greg Kamradt (ARC Prize Foundation), on the AI Engineer channel",
    "date": "2025",
    "desc": "A conference talk from before the launch explaining skill-acquisition efficiency and why the benchmark moved to interactive games."
   }
  ]
 },
 {
  "id": "community",
  "title": "Community and news",
  "blurb": "Where the competitors talk, plus our own coverage.",
  "items": [
   {
    "title": "Incredible notebook performance variation (Daniel Franzen's copies data analysis)",
    "url": "https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/discussion/745062",
    "by": "Son Pham",
    "date": "",
    "desc": "An analysis of how much one public notebook's score varied across many participants' one-time submissions, and what that implies for judging improvements."
   },
   {
    "title": "Competitor profiles",
    "url": "/news/competitors",
    "by": "The ARC Daily Digest",
    "date": "",
    "desc": "Team backgrounds, members and ARC Daily coverage for each competition."
   },
   {
    "title": "People behind the teams",
    "url": "/news/people",
    "by": "The ARC Daily Digest",
    "date": "",
    "desc": "Verified people and the dated team rosters they appear on across the ARC competitions."
   },
   {
    "title": "Around the contests",
    "url": "/news/community",
    "by": "The ARC Daily Digest",
    "date": "",
    "desc": "Public posts from the past 30 days about the competitions, newest first, with links to the original sources."
   },
   {
    "title": "The wire",
    "url": "/news/wire",
    "by": "The ARC Daily Digest wire desk",
    "date": "",
    "desc": "Short sourced stories on the ARC-AGI-3 and ARC-AGI-2 boards, each credited to its writer."
   },
   {
    "title": "ARC community hall of fame",
    "url": "/hall-of-fame",
    "by": "ARC Explainer",
    "date": "",
    "desc": "Profile cards for people and teams who have contributed to ARC, including past prize winners and paper authors."
   },
   {
    "title": "We will not be open-sourcing for the second milestone prize",
    "url": "https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/discussion/742801",
    "by": "Jeroen Cottaar (Tufa Labs)",
    "date": "",
    "desc": "Tufa Labs explains why it held back its code at the second milestone while planning to release its final solution when the competition ends."
   },
   {
    "title": "ARC Prize events",
    "url": "https://arcprize.org/events",
    "by": "ARC Prize",
    "date": "",
    "desc": "A list of ARC Prize events with links to their videos, including the ARC-AGI-3 launch and preview events."
   },
   {
    "title": "ARC Prize on X",
    "url": "https://x.com/arcprize",
    "by": "ARC Prize",
    "date": "",
    "desc": "The official ARC Prize account on X."
   },
   {
    "title": "ARC Prize on YouTube",
    "url": "https://www.youtube.com/@ARCprize",
    "by": "ARC Prize",
    "date": "",
    "desc": "The official ARC Prize channel, which carries the ARC-AGI-3 event videos."
   },
   {
    "title": "ARC Prize newsletter",
    "url": "https://arcprize.kit.com/bc80575d89",
    "by": "ARC Prize",
    "date": "",
    "desc": "The official newsletter sign-up form."
   },
   {
    "title": "ARC-AGI Community Leaderboard repository",
    "url": "https://github.com/arcprize/ARC-AGI-Community-Leaderboard",
    "by": "ARC Prize and community contributors",
    "date": "",
    "desc": "A repository where anyone can submit a general-purpose, open method by pull request, each in its own folder, as a showcase of approaches rather than a ranking."
   },
   {
    "title": "ARC-AGI-3 discussion forum, most voted",
    "url": "https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/discussion?sort=votes",
    "by": "Kaggle community",
    "date": "",
    "desc": "The competition forum sorted by votes, where host notices, solution write-ups and participant experiments are posted."
   },
   {
    "title": "ARC Prize community page",
    "url": "https://arcprize.org/community",
    "by": "ARC Prize Foundation",
    "date": "",
    "desc": "ARC Prize's directory of its Discord, YouTube channel, newsletter, X account, GitHub and events."
   },
   {
    "title": "Hacker News discussion of the Schema harness",
    "url": "https://news.ycombinator.com/item?id=48935905",
    "by": "Hacker News commenters",
    "date": "2026-07-16",
    "desc": "A public discussion of the Schema harness write-up, including questions about hold-out sets and public-only results."
   },
   {
    "title": "How noisy is an offline eval of the Franzen M2 harness? Plus two negative results (more streams, stall cutoff)",
    "url": "https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/discussion/750885",
    "by": "Francise Liang",
    "date": "",
    "desc": "One team's forum report comparing repeated offline runs of the public second-milestone notebook, with two changes that did not help."
   },
   {
    "title": "What are your agents scoring on the 25 public games?",
    "url": "https://www.kaggle.com/competitions/arc-prize-2026-arc-agi-3/discussion/732854",
    "by": "Reki",
    "date": "",
    "desc": "A forum thread where participants share self-reported local public-game results, setups and budgets."
   },
   {
    "title": "ARC-AGI Community Leaderboard",
    "url": "https://arcprize.org/leaderboard/community",
    "by": "ARC Prize Foundation",
    "date": "",
    "desc": "ARC Prize's list of community-submitted general-purpose methods with links to their code, where scores are self-reported unless noted."
   },
   {
    "title": "ARC Prize Discord",
    "url": "https://discord.gg/9b77dPAmcA",
    "by": "ARC Prize Foundation",
    "date": "",
    "desc": "The official community server for ARC Prize."
   },
   {
    "title": "ARC3 Dev Journal",
    "url": "https://shih-yu-yeh.github.io/arc3-dev-agi-journal/",
    "by": "Vincent (Shih-Yu-Yeh)",
    "date": "",
    "desc": "One competitor's logbook of public Kaggle submissions built on a duck harness fork, recording each change, local and board results, and what broke."
   },
   {
    "title": "Prime Agent explained",
    "url": "https://capitalandcompute.net/blog/prime-agent-explained/",
    "by": "Capital & Compute",
    "date": "2026-08-06",
    "desc": "Independent explainer that separates verified from self-reported results for Prime Agent and explains what the action-efficiency score measures."
   }
  ]
 }
];

export const ARC12_READING: OutsideReading[] = [
 {
  "title": "NVARC solution (ARC Prize 2025)",
  "url": "https://www.kaggle.com/competitions/arc-prize-2025/writeups/nvarc",
  "by": "NVARC",
  "desc": "The winning 2025 write-up on ARC-AGI-2, built around a multi-stage LLM and code synthetic-data pipeline, an improved ARChitects model and an improved Tiny Recursive Model."
 },
 {
  "title": "The ARChitects - Technical Report",
  "url": "https://lambdalabsml.github.io/ARC2025_Solution_by_the_ARChitects",
  "by": "Daniel Franzen, Jan Disselhoff, David Hartmann",
  "desc": "The full report on The ARChitects' 2025 ARC-AGI-2 entry, covering the approaches tried, compute used and ideas that did not work."
 },
 {
  "title": "ARCgentica",
  "url": "https://github.com/symbolica-ai/arcgentica",
  "by": "Symbolica",
  "desc": "An ARC-AGI-2 solver where sub-agents analyze grid examples and write and evaluate Python programs, published with its run logs."
 },
 {
  "title": "ARC-Interactive History Dataset",
  "url": "https://github.com/neoneye/ARC-Interactive-History-Dataset",
  "by": "Simon Strandgaard (neoneye)",
  "desc": "Recordings of human interaction while solving static ARC tasks, gathered through the free ARC-Interactive website."
 },
 {
  "title": "ARC-AGI-2 dataset repository",
  "url": "https://github.com/arcprize/ARC-AGI-2",
  "by": "ARC Prize",
  "desc": "The official repository for the static ARC-AGI-2 benchmark, holding its public training and evaluation tasks as JSON files."
 },
 {
  "title": "ARC-AGI Benchmarking (versions 1 and 2)",
  "url": "https://github.com/arcprize/arc-agi-benchmarking",
  "by": "ARC Prize",
  "desc": "A tool for running ARC-AGI-1 and ARC-AGI-2 tasks against LLM providers, with rate limiting, retries and scoring."
 },
 {
  "title": "The Official ARC-AGI Technical Guide",
  "url": "https://arcprize.org/guide",
  "by": "ARC Prize",
  "desc": "A landing page that splits into a guide for ARC-AGI-1 and 2 and a pointer to the ARC-AGI-3 docs."
 },
 {
  "title": "What is ARC-AGI?",
  "url": "https://arcprize.org/arc-agi",
  "by": "ARC Prize",
  "desc": "An overview of the ARC-AGI benchmark series and its design ideas, linking each version."
 },
 {
  "title": "ARC-AGI-1 task data",
  "url": "https://github.com/fchollet/ARC-AGI",
  "by": "François Chollet",
  "desc": "The original ARC-AGI-1 tasks and a browser interface for trying them by hand."
 },
 {
  "title": "ARC Prize 2025 Competition Writeup: 5th Place",
  "url": "https://www.kaggle.com/competitions/arc-prize-2025/writeups/arc-prize-2025-competition-writeup-5th-place",
  "by": "lonnieqin",
  "desc": "An ARC Prize 2025 write-up of a fork of the ARChitects' 2024 notebook whose stated contribution was changing the random seed, arguing that the seed is a hyperparameter."
 }
];
