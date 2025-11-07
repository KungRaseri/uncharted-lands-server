/**
 * REST API Router
 * 
 * Combines all API routes for admin operations
 */

import { Router } from 'express';
import worldsRouter from './routes/worlds';
import serversRouter from './routes/servers';
import geographyRouter from './routes/geography';
import playersRouter from './routes/players';
import adminRouter from './routes/admin';

const router = Router();

// Mount route handlers
router.use('/worlds', worldsRouter);
router.use('/servers', serversRouter);
router.use('/regions', geographyRouter);  // Handles regions, tiles, plots
router.use('/players', playersRouter);
router.use('/admin', adminRouter);

// Health check for API
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    api: 'REST API v1',
    timestamp: new Date().toISOString()
  });
});

export default router;
