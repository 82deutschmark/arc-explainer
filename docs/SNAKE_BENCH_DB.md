-- MODELS TABLE -------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.models (
  id                  bigserial PRIMARY KEY,
  name                text        NOT NULL,
  provider            text        NOT NULL,
  model_slug          text        NOT NULL UNIQUE,

  is_active           boolean     NOT NULL DEFAULT false,
  test_status         text        NOT NULL DEFAULT 'untested',  -- 'untested','testing','ranked','retired'

  elo_rating          double precision NOT NULL DEFAULT 1500.0,
  wins                integer     NOT NULL DEFAULT 0,
  losses              integer     NOT NULL DEFAULT 0,
  ties                integer     NOT NULL DEFAULT 0,
  apples_eaten        integer     NOT NULL DEFAULT 0,
  games_played        integer     NOT NULL DEFAULT 0,

  pricing_input       double precision,
  pricing_output      double precision,
  max_completion_tokens integer,
  metadata_json       jsonb,

  last_played_at      timestamptz,
  discovered_at       timestamptz NOT NULL DEFAULT now(),

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_models_active_status
  ON public.models (is_active, test_status);

CREATE INDEX IF NOT EXISTS idx_models_name
  ON public.models (name);

-- GAMES TABLE --------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.games (
  id              text PRIMARY KEY,    -- game_id is passed around as a string/UUID

  status          text        NOT NULL DEFAULT 'queued',  -- 'queued','in_progress','completed',...
  start_time      timestamptz,
  end_time        timestamptz,
  rounds          integer,

  replay_path     text,
  board_width     integer,
  board_height    integer,
  num_apples      integer,

  total_score     integer,
  total_cost      double precision DEFAULT 0.0,
  game_type       text        NOT NULL DEFAULT 'ladder',  -- 'ladder','evaluation',...

  current_state   jsonb,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_games_status
  ON public.games (status);

CREATE INDEX IF NOT EXISTS idx_games_gametype
  ON public.games (game_type);

-- GAME_PARTICIPANTS TABLE --------------------------------------------

CREATE TABLE IF NOT EXISTS public.game_participants (
  game_id                text    NOT NULL REFERENCES public.games(id)  ON DELETE CASCADE,
  model_id               bigint  NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  player_slot            integer NOT NULL,

  score                  integer NOT NULL DEFAULT 0,
  result                 text    NOT NULL DEFAULT 'tied',  -- 'won','lost','tied'
  death_round            integer,
  death_reason           text,
  cost                   double precision NOT NULL DEFAULT 0.0,

  opponent_rank_at_match integer,

  PRIMARY KEY (game_id, player_slot)
);

CREATE INDEX IF NOT EXISTS idx_game_participants_model
  ON public.game_participants (model_id);


  

I’ll scan the local [completed_games](cci:7://file:///d:/GitHub/arc-explainer/external/SnakeBench/backend/completed_games:0:0-0:0) folder with a small Python analysis script so we can compute, from disk only, which games have the highest cost, most rounds, most apples, and longest duration. That will also let me check your greatest-hits IDs against what actually exists locally and report which ones have JSON and where they rank by those metrics. I’ll create the script under the SnakeBench backend CLI, run it in your `.venv`, and then summarize the findings (not the full raw dump).











I'll summarize what the local analysis found, cross‑check your greatest-hits IDs against what actually exists under [completed_games](cci:7://file:///d:/GitHub/arc-explainer/external/SnakeBench/backend/completed_games:0:0-0:0), and then suggest how we can align the DB-based greatest-hits feature with the local JSONs going forward. Let me first grab the latest run of the analysis script so I can give you concrete top games by cost, rounds, apples, and duration.

### 1. Are your “greatest hits” IDs real or hallucinated?

For the 11 IDs you gave, I checked **both**:

- `external/SnakeBench/backend/completed_games/snake_game_<id>.json`  
- [external/SnakeBench/backend/completed_games/game_index.json](cci:7://file:///d:/GitHub/arc-explainer/external/SnakeBench/backend/completed_games/game_index.json:0:0-0:0)

**Found locally (JSON exists, MP4 generated):**

These 5 have local replay files and we successfully rendered MP4s:

- `836b435a-bfcf-4a5e-be66-d87dd0d92153`
- `b8eef62f-761a-446e-b447-7fd4588b18e7`
- `c2610aaf-c2e2-4382-a909-1114f47750d5`
- `d5886eb9-6e9e-41b5-aefa-f49a841830e2`
- `fa50a59b-fc43-4d43-8887-7ced8ba7385f`

MP4s are at:

- `external/SnakeBench/backend/completed_games_videos/snake_game_<id>.mp4`

**Not present anywhere locally (no JSON, not in game_index.json):**

- `2a428bcd-2f0b-49e7-bb71-71aa853ae541`
- `e1c7eb2d-ece8-41c8-ba60-6e97ba196926`
- `1ca2660c-9901-4326-be67-4dd861c9bbbf`
- `864753b8-a3b1-45f0-86ff-6ee0c7c20627`
- `87b8b307-91c0-42a3-895f-59e2034fe764`
- `fd408983-ada4-4d48-a1bc-df8beefe1991`

Given the backend greatest‑hits code works off the **Postgres `public.games` table**, the most likely situation is:

- Those 6 games **do exist in the DB**,  
- But their replays were **never exported into this repo’s [completed_games](cci:7://file:///d:/GitHub/arc-explainer/external/SnakeBench/backend/completed_games:0:0-0:0) folder** (or were deleted), so locally we can’t see or render them.

So: your feature isn’t hallucinating IDs; we’re just missing the corresponding replay JSONs on disk.

---

### 2. What’s “most interesting” in the local files?

I wrote and ran a small analyzer ([external/SnakeBench/backend/cli/analyze_local_games.py](cci:7://file:///d:/GitHub/arc-explainer/external/SnakeBench/backend/cli/analyze_local_games.py:0:0-0:0)) that walks **all** `snake_game_*.json` under [completed_games](cci:7://file:///d:/GitHub/arc-explainer/external/SnakeBench/backend/completed_games:0:0-0:0) and computes, per game:

- `total_cost` (from `totals.cost` or sum of player costs)
- `rounds_played` and `max_rounds`
- `max_final_score` (highest per-player `final_score`)
- `duration_seconds` (`ended_at - started_at`)

Here are the **top local games** by each metric (from that script, `--top 5`):

#### Most expensive (by `totals.cost`)

- `c6c26143-451f-4524-bb72-f4cd2e8242c4` – **$4.83**, 45/150 rounds  
- `01ba2c15-ab41-4049-9d61-ff3f49050b7e` – **$3.46**, 58/100  
- `8a2b969e-1390-42ff-a3ec-a9c49db64dc3` – **$2.75**, 37/150  
- `cd8f383c-24ab-4622-a7bd-5a55853709e6` – **$2.14**, 45/100  
- `a5007ccf-3dca-462e-8df5-fd7bd5c7ae3b` – **$1.83**, 42/150  

(Your “extremely expensive” IDs from the DB don’t appear here locally because their JSONs are missing.)

#### Longest by rounds played

- `295efa56-170b-44b7-99ef-f11c2111058e` – **97/100** rounds, max score 29  
- `82bca6d4-5bc7-4273-84b5-ad272fbe3bc9` – **97/100**  
- `562c44b7-57bd-4efb-b754-2c29914de2f5` – **96/100**  
- `3e4f1fcd-a63c-4347-9c8f-098ee540847b` – **92/100**  
- `429061bf-3bd5-4277-8df7-e54ea9a16aa4` – **91/100**  

Your local “epic long games” like `836b435a...` and `c2610aaf...` are **56–60 rounds**, so they are long, but not at the absolute top by this metric.

#### Highest-scoring (most apples for a single player)

- `295efa56-170b-44b7-99ef-f11c2111058e` – **max_final_score 29**  
- `82bca6d4-5bc7-4273-84b5-ad272fbe3bc9` – 29  
- `1b0cadf1-be63-4347-9479-b53453900888` – 26  
- `e2e36302-c742-4613-9cb6-6e4cb617d5e3` – 26  
- `562c44b7-57bd-4efb-b754-2c29914de2f5` – 25  

Your “big scoring match (10+ apples)” example `836b435a...` has:

- `rounds_played = 56`,  
- `final_score` 12–10,  
- `total_cost ≈ $0.074`,  
- duration ~23 minutes.

So it is indeed a high‑scoring, longish game, just not at the very extreme tail versus others on disk.

#### Longest duration (wall‑clock time)

- `c845ee4d-0606-4204-8fb4-c6cf5074dc9b` – **9245.6s** (~2.6 hours)  
- `82bca6d4-5bc7-4273-84b5-ad272fbe3bc9` – 7201.0s  
- `295efa56-170b-44b7-99ef-f11c2111058e` – 6201.8s  
- `659ec86c-87b3-4152-a6a5-8e4ea13dfca8` – 6161.0s  
- `40d4caeb-e27c-4aea-a14c-98c449bec836` – 4995.4s  

Again, your highlighted games are long, but some other matches ran significantly longer in real time.

---

### 3. So what does this mean for Greatest Hits?

- The **backend greatest-hits feature** is correctly picking real games from `public.games`.
- **Locally**, we only have JSON for a subset of those games; 6 of your listed IDs are **DB-only** right now (no replay JSON under [completed_games](cci:7://file:///d:/GitHub/arc-explainer/external/SnakeBench/backend/completed_games:0:0-0:0)), so we can’t render or analyze them from disk.
- When we talk about “most interesting games” **on this machine**, the true local top‑N by cost/rounds/apples/duration are the IDs shown above (e.g., `c6c26143...`, `295efa56...`, etc.).

If you’d like, I can:

- Export this local ranking into a small CSV or JSON file so you can browse it, and/or  
- Update the Worm Arena Greatest Hits plan to explicitly distinguish “DB greatest hits” from “locally available greatest hits,” so the UI can prefer games that we know have a replay JSON (and soon, an MP4).