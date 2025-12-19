-- Migration: Add worm arena sessions table for persistent live-link resolution
-- Created: 2025-12-19  Grok Code Fast 1
-- Purpose: Enable old live links to redirect to exact replays even after server restarts

CREATE TABLE IF NOT EXISTS worm_arena_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    model_a VARCHAR(255) NOT NULL,
    model_b VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    game_id VARCHAR(255) DEFAULT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_worm_arena_sessions_status ON worm_arena_sessions(status);
CREATE INDEX IF NOT EXISTS idx_worm_arena_sessions_expires ON worm_arena_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_worm_arena_sessions_game_id ON worm_arena_sessions(game_id) WHERE game_id IS NOT NULL;
