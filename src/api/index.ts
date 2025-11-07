/**
 * REST API Router
 * 
 * Combines all API routes for admin operations
 */

import { Router } from 'express';
import worldsRouter from './routes/worlds.js';
import serversRouter from './routes/servers.js';
import geographyRouter from './routes/geography.js';
import playersRouter from './routes/players.js';
import adminRouter from './routes/admin.js';
import authRouter from './routes/auth.js';
import settlementsRouter from './routes/settlements.js';

const router = Router();

// Mount route handlers
router.use('/auth', authRouter);
router.use('/worlds', worldsRouter);
router.use('/servers', serversRouter);
router.use('/regions', geographyRouter);  // Handles regions, tiles, plots
router.use('/players', playersRouter);
router.use('/settlements', settlementsRouter);
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
