-- Migration to add scorecard support for ARC3 games
-- Run this manually on Railway PostgreSQL if needed

-- Create scorecards table
CREATE TABLE IF NOT EXISTS scorecards (
  card_id VARCHAR(255) PRIMARY KEY,
  source_url TEXT DEFAULT NULL,
  tags TEXT[] DEFAULT '{}',
  opaque JSONB DEFAULT NULL,
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  is_active BOOLEAN DEFAULT true
);

-- Create indexes for scorecards table
CREATE INDEX IF NOT EXISTS idx_scorecards_is_active ON scorecards(is_active);
CREATE INDEX IF NOT EXISTS idx_scorecards_opened_at ON scorecards(opened_at DESC);

-- Add scorecard_id column to arc3_sessions if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'arc3_sessions' 
    AND column_name = 'scorecard_id'
  ) THEN
    ALTER TABLE arc3_sessions ADD COLUMN scorecard_id VARCHAR(255) DEFAULT NULL;
  END IF;
END $$;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_arc3_sessions_scorecard'
  ) THEN
    ALTER TABLE arc3_sessions 
    ADD CONSTRAINT fk_arc3_sessions_scorecard
    FOREIGN KEY (scorecard_id)
    REFERENCES scorecards(card_id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for scorecard_id
CREATE INDEX IF NOT EXISTS idx_arc3_sessions_scorecard ON arc3_sessions(scorecard_id);
