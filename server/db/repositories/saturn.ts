/**
 * Saturn Repository
 * 
 * Handles all data access operations for Saturn solver sessions with:
 * - Session lifecycle management (create, update, complete)
 * - Event tracking and timeline reconstruction
 * - Real-time progress monitoring
 * - Performance analytics and debugging
 * 
 * @author Claude Code Assistant
 * @date August 23, 2025
 */

import { DatabaseConnection } from '../connection.js';
import { logger } from '../../utils/logger.js';
import {
  SaturnLogRow,
  SaturnEventRow
} from '../schemas.js';

/**
 * Saturn session with all events
 */
export interface SaturnSession {
  id: number;
  requestId: string;
  explanationId?: number;
  createdAt: Date;
  updatedAt: Date;
  status: 'running' | 'completed' | 'failed';
  totalEvents: number;
  sessionData?: Record<string, any>;
  events: SaturnEventRow[];
}

/**
 * Event data for Saturn solver tracking
 */
export interface SaturnEventData {
  eventType: string;
  data: Record<string, any>;
  provider?: string;
  model?: string;
  phase?: string;
  requestId?: string;
}

/**
 * Saturn session analytics
 */
export interface SaturnAnalytics {
  totalSessions: number;
  completedSessions: number;
  failedSessions: number;
  avgEventsPerSession: number;
  avgSessionDuration: number;
  successRate: number;
  commonFailureReasons: { reason: string; count: number }[];
  performanceByPhase: { phase: string; avgDuration: number; count: number }[];
}

/**
 * Repository for Saturn solver data access operations
 */
export class SaturnRepository {
  constructor(private db: DatabaseConnection) {}

  /**
   * Create a new Saturn solver session
   * @param requestId Unique session identifier
   * @param explanationId Optional linked explanation ID
   * @param initialData Optional session metadata
   * @returns Created session ID
   */
  async createSession(requestId: string, explanationId?: number, initialData?: Record<string, any>): Promise<number> {
    const sql = `
      INSERT INTO saturn_log (request_id, explanation_id, status, session_data)
      VALUES ($1, $2, 'running', $3)
      RETURNING id
    `;

    const sessionData = {
      ...initialData,
      started_at: new Date().toISOString(),
      created_by: 'saturn-solver'
    };

    try {
      const [row] = await this.db.query(sql, [requestId, explanationId || null, JSON.stringify(sessionData)]);
      const sessionId = row.id;

      logger.info(`Created Saturn session: ${requestId}`, {
        sessionId,
        explanationId,
        hasInitialData: !!initialData
      }, 'saturn-repo');

      return sessionId;
    } catch (error) {
      logger.error(`Failed to create Saturn session: ${requestId}`, {
        error: (error as Error).message,
        explanationId
      }, 'saturn-repo');
      throw error;
    }
  }

  /**
   * Add an event to a Saturn solver session
   * @param sessionId Saturn log ID
   * @param eventData Event information
   */
  async addEvent(sessionId: number, eventData: SaturnEventData): Promise<void> {
    const sql = `
      INSERT INTO saturn_events (saturn_log_id, event_type, timestamp, provider, model, phase, request_id, data)
      VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7)
    `;

    const params = [
      sessionId,
      eventData.eventType,
      eventData.provider || null,
      eventData.model || null,
      eventData.phase || null,
      eventData.requestId || null,
      JSON.stringify(eventData.data)
    ];

    try {
      await this.db.query(sql, params);

      // Update event counter and last update time
      await this.db.query(
        `UPDATE saturn_log SET total_events = total_events + 1, updated_at = NOW() WHERE id = $1`,
        [sessionId]
      );

      logger.debug(`Added Saturn event: ${eventData.eventType}`, {
        sessionId,
        eventType: eventData.eventType,
        phase: eventData.phase
      }, 'saturn-repo');
    } catch (error) {
      logger.error(`Failed to add Saturn event to session ${sessionId}`, {
        error: (error as Error).message,
        eventType: eventData.eventType
      }, 'saturn-repo');
      throw error;
    }
  }

  /**
   * Complete a Saturn solver session
   * @param sessionId Saturn log ID
   * @param status Final status
   * @param finalData Optional final session data
   */
  async completeSession(sessionId: number, status: 'completed' | 'failed', finalData?: Record<string, any>): Promise<void> {
    const sql = `
      UPDATE saturn_log 
      SET status = $1, updated_at = NOW(), session_data = COALESCE($2::jsonb, session_data)
      WHERE id = $3
    `;

    const completionData = finalData ? {
      ...finalData,
      completed_at: new Date().toISOString(),
      final_status: status
    } : null;

    try {
      await this.db.query(sql, [status, completionData ? JSON.stringify(completionData) : null, sessionId]);

      logger.info(`Completed Saturn session ${sessionId}`, {
        status,
        hasFinalData: !!finalData
      }, 'saturn-repo');
    } catch (error) {
      logger.error(`Failed to complete Saturn session ${sessionId}`, {
        error: (error as Error).message,
        status
      }, 'saturn-repo');
      throw error;
    }
  }

  /**
   * Get Saturn session by request ID with all events
   * @param requestId Session request ID
   * @returns Complete session with events or null
   */
  async getSessionByRequestId(requestId: string): Promise<SaturnSession | null> {
    try {
      // Get session details
      const sessionSql = `SELECT * FROM saturn_log WHERE request_id = $1`;
      const sessionRow = await this.db.queryOne<SaturnLogRow>(sessionSql, [requestId]);

      if (!sessionRow) return null;

      // Get all events for this session
      const eventsSql = `
        SELECT * FROM saturn_events 
        WHERE saturn_log_id = $1 
        ORDER BY timestamp ASC
      `;
      const eventRows = await this.db.query<SaturnEventRow>(eventsSql, [sessionRow.id]);

      return {
        id: sessionRow.id,
        requestId: sessionRow.request_id,
        explanationId: sessionRow.explanation_id,
        createdAt: sessionRow.created_at,
        updatedAt: sessionRow.updated_at,
        status: sessionRow.status,
        totalEvents: sessionRow.total_events,
        sessionData: sessionRow.session_data,
        events: eventRows
      };
    } catch (error) {
      logger.error(`Failed to get Saturn session: ${requestId}`, {
        error: (error as Error).message
      }, 'saturn-repo');
      throw error;
    }
  }

  /**
   * Get Saturn session by ID with all events
   * @param sessionId Session ID
   * @returns Complete session with events or null
   */
  async getSessionById(sessionId: number): Promise<SaturnSession | null> {
    try {
      // Get session details
      const sessionSql = `SELECT * FROM saturn_log WHERE id = $1`;
      const sessionRow = await this.db.queryOne<SaturnLogRow>(sessionSql, [sessionId]);

      if (!sessionRow) return null;

      // Get all events for this session
      const eventsSql = `
        SELECT * FROM saturn_events 
        WHERE saturn_log_id = $1 
        ORDER BY timestamp ASC
      `;
      const eventRows = await this.db.query<SaturnEventRow>(eventsSql, [sessionId]);

      return {
        id: sessionRow.id,
        requestId: sessionRow.request_id,
        explanationId: sessionRow.explanation_id,
        createdAt: sessionRow.created_at,
        updatedAt: sessionRow.updated_at,
        status: sessionRow.status,
        totalEvents: sessionRow.total_events,
        sessionData: sessionRow.session_data,
        events: eventRows
      };
    } catch (error) {
      logger.error(`Failed to get Saturn session by ID: ${sessionId}`, {
        error: (error as Error).message
      }, 'saturn-repo');
      throw error;
    }
  }

  /**
   * Get all active (running) Saturn sessions
   * @returns Array of active sessions
   */
  async getActiveSessions(): Promise<SaturnSession[]> {
    try {
      const sql = `
        SELECT sl.*, COUNT(se.id) as actual_event_count
        FROM saturn_log sl
        LEFT JOIN saturn_events se ON sl.id = se.saturn_log_id
        WHERE sl.status = 'running'
        GROUP BY sl.id
        ORDER BY sl.created_at DESC
      `;

      const rows = await this.db.query(sql);
      
      const sessions = await Promise.all(
        rows.map(async (row) => {
          const eventsSql = `
            SELECT * FROM saturn_events 
            WHERE saturn_log_id = $1 
            ORDER BY timestamp ASC
          `;
          const eventRows = await this.db.query<SaturnEventRow>(eventsSql, [row.id]);

          return {
            id: row.id,
            requestId: row.request_id,
            explanationId: row.explanation_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            status: row.status,
            totalEvents: row.total_events,
            sessionData: row.session_data,
            events: eventRows
          };
        })
      );

      logger.debug(`Retrieved ${sessions.length} active Saturn sessions`, 'saturn-repo');
      return sessions;
    } catch (error) {
      logger.error('Failed to get active Saturn sessions', {
        error: (error as Error).message
      }, 'saturn-repo');
      throw error;
    }
  }

  /**
   * Get Saturn analytics and performance metrics
   * @param daysPast Number of days to analyze (default: 30)
   * @returns Analytics data
   */
  async getAnalytics(daysPast: number = 30): Promise<SaturnAnalytics> {
    try {
      // Overall session stats
      const sessionStatsSql = `
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_sessions,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_sessions,
          AVG(total_events) as avg_events_per_session,
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_session_duration_seconds
        FROM saturn_log
        WHERE created_at >= NOW() - INTERVAL '${daysPast} days'
      `;

      const [sessionStats] = await this.db.query(sessionStatsSql);
      
      const totalSessions = parseInt(sessionStats.total_sessions || '0');
      const completedSessions = parseInt(sessionStats.completed_sessions || '0');
      const failedSessions = parseInt(sessionStats.failed_sessions || '0');
      const successRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

      // Common failure analysis
      const failureAnalysisSql = `
        SELECT 
          COALESCE(session_data->>'failure_reason', 'unknown') as reason,
          COUNT(*) as count
        FROM saturn_log
        WHERE status = 'failed' 
          AND created_at >= NOW() - INTERVAL '${daysPast} days'
        GROUP BY session_data->>'failure_reason'
        ORDER BY count DESC
        LIMIT 10
      `;

      const failureRows = await this.db.query(failureAnalysisSql);
      const commonFailureReasons = failureRows.map(row => ({
        reason: row.reason,
        count: parseInt(row.count)
      }));

      // Performance by phase analysis
      const phasePerformanceSql = `
        SELECT 
          COALESCE(phase, 'unknown') as phase,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (
            LEAD(timestamp) OVER (PARTITION BY saturn_log_id ORDER BY timestamp) - timestamp
          ))) as avg_duration_seconds
        FROM saturn_events se
        JOIN saturn_log sl ON se.saturn_log_id = sl.id
        WHERE sl.created_at >= NOW() - INTERVAL '${daysPast} days'
          AND phase IS NOT NULL
        GROUP BY phase
        ORDER BY count DESC
      `;

      const phaseRows = await this.db.query(phasePerformanceSql);
      const performanceByPhase = phaseRows.map(row => ({
        phase: row.phase,
        avgDuration: Math.round((row.avg_duration_seconds || 0) * 100) / 100,
        count: parseInt(row.count)
      }));

      const analytics = {
        totalSessions,
        completedSessions,
        failedSessions,
        avgEventsPerSession: Math.round((sessionStats.avg_events_per_session || 0) * 100) / 100,
        avgSessionDuration: Math.round((sessionStats.avg_session_duration_seconds || 0) * 100) / 100,
        successRate: Math.round(successRate * 100) / 100,
        commonFailureReasons,
        performanceByPhase
      };

      logger.info('Generated Saturn analytics', {
        daysPast,
        totalSessions: analytics.totalSessions,
        successRate: analytics.successRate
      }, 'saturn-repo');

      return analytics;
    } catch (error) {
      logger.error('Failed to get Saturn analytics', {
        error: (error as Error).message,
        daysPast
      }, 'saturn-repo');
      throw error;
    }
  }

  /**
   * Clean up old Saturn sessions and events (maintenance function)
   * @param daysOld Sessions older than this will be deleted
   * @returns Number of sessions deleted
   */
  async cleanupOldSessions(daysOld: number = 90): Promise<number> {
    const sql = `
      DELETE FROM saturn_log 
      WHERE created_at < NOW() - INTERVAL '${daysOld} days'
        AND status != 'running'
      RETURNING id
    `;

    try {
      const deletedRows = await this.db.query(sql);
      const deletedCount = deletedRows.length;

      logger.info(`Cleaned up ${deletedCount} old Saturn sessions`, {
        daysOld,
        deletedCount
      }, 'saturn-repo');

      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old Saturn sessions', {
        error: (error as Error).message,
        daysOld
      }, 'saturn-repo');
      throw error;
    }
  }

  /**
   * Update session data without changing status
   * @param sessionId Session ID
   * @param data Session data to merge
   */
  async updateSessionData(sessionId: number, data: Record<string, any>): Promise<void> {
    const sql = `
      UPDATE saturn_log 
      SET session_data = COALESCE(session_data, '{}'::jsonb) || $1::jsonb,
          updated_at = NOW()
      WHERE id = $2
    `;

    try {
      await this.db.query(sql, [JSON.stringify(data), sessionId]);

      logger.debug(`Updated session data for Saturn session ${sessionId}`, {
        updatedFields: Object.keys(data)
      }, 'saturn-repo');
    } catch (error) {
      logger.error(`Failed to update session data for Saturn session ${sessionId}`, {
        error: (error as Error).message
      }, 'saturn-repo');
      throw error;
    }
  }
}