/*
 * Author: Cascade using Deep Research Model
 * Date: 2025-10-03T20:40:00Z
 * PURPOSE: Database table to store runtime model configuration overrides
 *          Allows setting models as inactive, creating aliases, and storing metadata
 *          without modifying the source models.ts config file
 * SRP/DRY check: Pass - Single table for model overrides only
 */

-- Model Overrides Table
-- Stores runtime changes to model configurations
CREATE TABLE IF NOT EXISTS model_overrides (
  id SERIAL PRIMARY KEY,
  model_key VARCHAR(255) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  alias_for VARCHAR(255), -- If set, this model is an alias for another
  notes TEXT,
  added_via VARCHAR(50) DEFAULT 'ui', -- 'config' | 'ui' | 'openrouter'
  added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Additional model configuration (for UI-added models)
  config_json JSONB, -- Stores full ModelConfig for UI-added models
  
  -- Constraints
  CONSTRAINT valid_added_via CHECK (added_via IN ('config', 'ui', 'openrouter'))
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_model_overrides_key ON model_overrides(model_key);
CREATE INDEX IF NOT EXISTS idx_model_overrides_active ON model_overrides(is_active);
CREATE INDEX IF NOT EXISTS idx_model_overrides_alias ON model_overrides(alias_for) WHERE alias_for IS NOT NULL;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_model_overrides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER model_overrides_updated_at
BEFORE UPDATE ON model_overrides
FOR EACH ROW
EXECUTE FUNCTION update_model_overrides_updated_at();
