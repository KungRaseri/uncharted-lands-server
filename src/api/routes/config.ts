import { Router } from 'express';
import { DEFAULT_GAME_CONFIG } from '../../config/game-config';

const router = Router();

/**
 * GET /api/config/game
 * Returns the game configuration (production rates, biome efficiencies, etc.)
 * This is public data that doesn't require authentication
 */
router.get('/game', async (_req, res) => {
  try {
    // TODO: In the future, fetch this from database tables instead of hardcoded config
    // For now, return the default configuration
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
    // TODO: Store config version in database, increment when game balance changes
    res.json({ version: '1.0.0', lastUpdated: new Date().toISOString() });
  } catch (error) {
    console.error('Error fetching config version:', error);
    res.status(500).json({ error: 'Failed to fetch configuration version' });
  }
});

export default router;
