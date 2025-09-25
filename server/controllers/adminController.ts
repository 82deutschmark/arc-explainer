/**
 * Author: Cascade (using Gemini 2.5 Pro)
 * Date: 2025-09-24
 * PURPOSE: This controller provides administrative endpoints, such as manually triggering the data recovery process.
 * SRP and DRY check: Pass - This controller has a single responsibility related to administrative actions.
 */

import { Router } from 'express';
import { recoveryService } from '../services/recoveryService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

/**
 * @route   POST /api/admin/start-recovery
 * @desc    Manually starts the data recovery process.
 * @access  Private (to be implemented)
 */
router.post('/start-recovery', asyncHandler(async (req: import('express').Request, res: import('express').Response) => {
  console.log('[API] Manual data recovery process initiated.');
  
  // Start the recovery process but do not wait for it to complete.
  // This allows the API to respond immediately.
  recoveryService.processRecovery(true); // Always run in non-interactive mode.

  res.status(202).json({ 
    success: true, 
    message: 'Data recovery process has been initiated. Check server logs for progress.' 
  });
}));

export default router;
