import { Router } from 'express';
import { DEFAULT_GAME_CONFIG } from '../../config/game-config.js';

const router = Router();

/**
 * GET /api/config/game
 * Returns the game configuration (production rates, biome efficiencies, etc.)
 * This is public data that doesn't require authentication
 */
router.get('/game', async (_req, res) => {
  try {
    // Future enhancement: Fetch from database tables for dynamic configuration
    // For now, return the default configuration from code
    res.json(DEFAULT_GAME_CONFIG);
  } catch (error) {
    console.error('Error fetching game config:', error);
    res.status(500).json({ error: 'Failed to fetch game configuration' });
  }
});

/**
 * GET /api/config/version
 * Returns the current configuration version for cache invalidation
 */
router.get('/version', async (_req, res) => {
  try {
    // Future enhancement: Store version in database, increment when balance changes
    // For now, use a static version
    res.json({ version: '1.0.0', lastUpdated: new Date().toISOString() });
  } catch (error) {
    console.error('Error fetching config version:', error);
    res.status(500).json({ error: 'Failed to fetch configuration version' });
  }
});

export default router;
