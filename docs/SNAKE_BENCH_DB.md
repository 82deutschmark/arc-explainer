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