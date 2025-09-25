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
import costController from '../controllers/costController.ts';

const router = express.Router();

// Metrics routes
router.route('/reliability').get(metricsController.getModelReliability);
router.route('/comprehensive-dashboard').get(metricsController.getComprehensiveDashboard);

// Cost-specific routes following RESTful principles
router.route('/costs/models').get(costController.getAllModelCosts);
router.route('/costs/models/map').get(costController.getModelCostMap);
router.route('/costs/models/:modelName').get(costController.getModelCostSummary);
router.route('/costs/models/:modelName/trends').get(costController.getModelCostTrends);
router.route('/costs/system/stats').get(costController.getSystemCostStats);

export default router;
