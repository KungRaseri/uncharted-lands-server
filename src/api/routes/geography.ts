/**
 * Regions, Tiles, and Plots API Routes
 * 
 * Read operations for world geography data
 */

import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, regions, tiles, plots } from '../../db/index';
import { authenticateAdmin } from '../middleware/auth';
import { logger } from '../../utils/logger';

const router = Router();

// ===========================
// REGIONS
// ===========================

/**
 * GET /api/regions?worldId=xxx
 * Get all regions for a world
 */
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const { worldId } = req.query;

    if (!worldId || typeof worldId !== 'string') {
      return res.status(400).json({ 
        error: 'Missing required query parameter: worldId', 
        code: 'INVALID_INPUT' 
      });
    }

    const worldRegions = await db.query.regions.findMany({
      where: eq(regions.worldId, worldId),
      with: {
        tiles: {
          with: {
            biome: true
          }
        }
      }
    });

    res.json(worldRegions);
  } catch (error) {
    logger.error('[API] Error fetching regions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch regions', 
      code: 'FETCH_FAILED' 
    });
  }
});

/**
 * GET /api/regions/:id
 * Get region details
 */
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const region = await db.query.regions.findFirst({
      where: eq(regions.id, id),
      with: {
        world: true,
        tiles: {
          with: {
            biome: true
          }
        }
      }
    });

    if (!region) {
      return res.status(404).json({ 
        error: 'Region not found', 
        code: 'NOT_FOUND' 
      });
    }

    res.json(region);
  } catch (error) {
    logger.error('[API] Error fetching region:', error);
    res.status(500).json({ 
      error: 'Failed to fetch region', 
      code: 'FETCH_FAILED' 
    });
  }
});

// ===========================
// TILES
// ===========================

/**
 * GET /api/tiles/:id
 * Get tile details
 */
router.get('/tiles/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const tile = await db.query.tiles.findFirst({
      where: eq(tiles.id, id),
      with: {
        region: {
          with: {
            world: true
          }
        },
        biome: true,
        plots: true
      }
    });

    if (!tile) {
      return res.status(404).json({ 
        error: 'Tile not found', 
        code: 'NOT_FOUND' 
      });
    }

    res.json(tile);
  } catch (error) {
    logger.error('[API] Error fetching tile:', error);
    res.status(500).json({ 
      error: 'Failed to fetch tile', 
      code: 'FETCH_FAILED' 
    });
  }
});

// ===========================
// PLOTS
// ===========================

/**
 * GET /api/plots/:id
 * Get plot details
 */
router.get('/plots/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const plot = await db.query.plots.findFirst({
      where: eq(plots.id, id),
      with: {
        tile: {
          with: {
            region: {
              with: {
                world: true
              }
            },
            biome: true
          }
        }
      }
    });

    if (!plot) {
      return res.status(404).json({ 
        error: 'Plot not found', 
        code: 'NOT_FOUND' 
      });
    }

    res.json(plot);
  } catch (error) {
    logger.error('[API] Error fetching plot:', error);
    res.status(500).json({ 
      error: 'Failed to fetch plot', 
      code: 'FETCH_FAILED' 
    });
  }
});

export default router;
