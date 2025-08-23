-- Base Schema Migration for ARC Explainer
-- Migrates all runtime table creation to proper versioned migration
-- Eliminates dangerous CREATE TABLE IF NOT EXISTS from application startup
-- Author: Claude Code Assistant
-- Date: August 23, 2025

-- Explanations table - stores AI model analysis of ARC puzzles
CREATE TABLE IF NOT EXISTS explanations (
  id SERIAL PRIMARY KEY,
  puzzle_id TEXT NOT NULL,
  pattern_description TEXT,
  solving_strategy TEXT,
  confidence INTEGER,
  hints TEXT, -- JSON array stored as text (will migrate to JSONB later)
  alien_meaning TEXT,
  alien_meaning_confidence INTEGER,
  model_name TEXT DEFAULT 'unknown',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  reasoning_log TEXT, -- For AI models that provide reasoning steps
  api_processing_time_ms INTEGER, -- API call duration tracking
  -- OpenAI Responses API fields
  provider_response_id TEXT, -- OpenAI response ID for tracking
  provider_raw_response TEXT, -- Full API response (if RAW_RESPONSE_PERSIST=true)
  reasoning_items TEXT, -- JSON array of structured reasoning steps
  -- Token usage and cost tracking
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  reasoning_tokens INTEGER DEFAULT 0, -- For models like DeepSeek R1
  total_tokens INTEGER DEFAULT 0,
  estimated_cost DECIMAL(10,6) DEFAULT 0, -- Cost in dollars
  -- Advanced prompting parameters
  temperature DECIMAL(3,2), -- Temperature setting used
  reasoning_effort TEXT, -- GPT-5 reasoning effort level
  reasoning_verbosity TEXT, -- GPT-5 reasoning verbosity
  reasoning_summary_type TEXT, -- GPT-5 reasoning summary type
  -- Saturn solver fields
  saturn_images TEXT, -- JSON array of image paths
  saturn_log TEXT, -- Saturn solver log output
  saturn_events TEXT, -- Saturn solver events
  saturn_success BOOLEAN, -- Saturn solver success status
  -- Solver mode fields (when used as solver vs explainer)
  predicted_output_grid TEXT, -- JSON array for predicted output
  is_prediction_correct BOOLEAN, -- Whether prediction matches expected output
  prediction_accuracy_score DECIMAL(5,2) -- Accuracy score (0-100)
);

-- Feedback table - stores user feedback on explanations
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  explanation_id INTEGER REFERENCES explanations(id),
  vote_type VARCHAR CHECK (vote_type IN ('helpful', 'not_helpful')),
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Saturn log table - stores solver session metadata
CREATE TABLE IF NOT EXISTS saturn_log (
  id SERIAL PRIMARY KEY,
  request_id VARCHAR(100) NOT NULL UNIQUE,
  explanation_id INTEGER REFERENCES explanations(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'running', -- running, completed, failed
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  final_data TEXT -- Any final status or error data
);

-- Saturn events table - stores solver progress events
CREATE TABLE IF NOT EXISTS saturn_events (
  id SERIAL PRIMARY KEY,
  saturn_log_id INTEGER REFERENCES saturn_log(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- e.g., 'api_call_start', 'api_call_end'
  event_data TEXT, -- JSON data for the event
  timestamp TIMESTAMP DEFAULT NOW(),
  provider VARCHAR(50), -- AI provider (openai, anthropic, etc.)
  model VARCHAR(100), -- Model name
  phase VARCHAR(50), -- Processing phase
  request_id VARCHAR(100) -- Cross-reference with saturn_log
);

-- Batch testing tables - for systematic model evaluation
CREATE TABLE IF NOT EXISTS batch_runs (
  id SERIAL PRIMARY KEY,
  status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'completed', 'stopped', 'error')),
  model VARCHAR(50) NOT NULL,
  dataset_path VARCHAR(200) NOT NULL,
  total_count INTEGER NOT NULL,
  processed_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  average_accuracy DECIMAL(5,2),
  total_processing_time_ms BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS batch_results (
  id SERIAL PRIMARY KEY,
  batch_run_id INTEGER REFERENCES batch_runs(id) ON DELETE CASCADE,
  puzzle_id VARCHAR(50) NOT NULL,
  explanation_id INTEGER REFERENCES explanations(id) ON DELETE SET NULL,
  success BOOLEAN NOT NULL,
  accuracy_score DECIMAL(5,2),
  processing_time_ms INTEGER,
  error_message TEXT,
  processed_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_explanations_puzzle_id ON explanations(puzzle_id);
CREATE INDEX IF NOT EXISTS idx_explanations_model_name ON explanations(model_name);
CREATE INDEX IF NOT EXISTS idx_explanations_created_at ON explanations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_explanations_puzzle_created ON explanations(puzzle_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_explanation_id ON feedback(explanation_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_saturn_events_log_id ON saturn_events(saturn_log_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_saturn_log_request_id ON saturn_log(request_id);

CREATE INDEX IF NOT EXISTS idx_batch_results_batch_run_id ON batch_results(batch_run_id);
CREATE INDEX IF NOT EXISTS idx_batch_results_processed_at ON batch_results(processed_at DESC);

-- Update timestamps trigger (future enhancement)
-- CREATE OR REPLACE FUNCTION update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     NEW.updated_at = NOW();
--     RETURN NEW;
-- END;
-- $$ language 'plpgsql';

-- CREATE TRIGGER update_explanations_updated_at BEFORE UPDATE
--     ON explanations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
