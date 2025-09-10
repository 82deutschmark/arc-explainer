/**
 * Metrics Routes
 * 
 * Defines API routes for accessing metric and analytic data.
 * 
 * @author Gemini 2.5 Pro
 * @date 2025-09-10
 */

import express from 'express';
import metricsController from '../controllers/metricsController.ts';

const router = express.Router();

// Route to get model reliability stats
router.route('/reliability').get(metricsController.getModelReliability);
router.route('/comprehensive-dashboard').get(metricsController.getComprehensiveDashboard);

export default router;
