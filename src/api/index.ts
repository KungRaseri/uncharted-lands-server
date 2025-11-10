/**
 * REST API Router
 *
 * Combines all API routes for admin operations
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import worldsRouter from './routes/worlds.js';
import serversRouter from './routes/servers.js';
import geographyRouter from './routes/geography.js';
import playersRouter from './routes/players.js';
import adminRouter from './routes/admin.js';
import authRouter from './routes/auth.js';
import settlementsRouter from './routes/settlements.js';
import accountRouter from './routes/account.js';
import plotsRouter from './routes/plots.js';
import structuresRouter from './routes/structures.js';
import configRouter from './routes/config.js';

const router = Router();

// Request logging middleware
router.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Log request
  logger.debug('[API] → Request', {
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    ip: req.ip,
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'debug';
    
    logger[level]('[API] ← Response', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
    });
  });

  next();
});

// Mount route handlers
router.use('/auth', authRouter);
router.use('/account', accountRouter);
router.use('/config', configRouter);
router.use('/worlds', worldsRouter);
router.use('/servers', serversRouter);
router.use('/regions', geographyRouter); // Handles regions, tiles, plots
router.use('/players', playersRouter);
router.use('/settlements', settlementsRouter);
router.use('/plots', plotsRouter);
router.use('/structures', structuresRouter);
router.use('/admin', adminRouter);

// Health check for API
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    api: 'REST API v1',
    timestamp: new Date().toISOString(),
  });
});

export default router;
