/**
 * Regions, Tiles, and Plots API Routes
 * 
 * Read operations for world geography data
 */

import { Router } from 'express';
import { eq, and, gte, lte } from 'drizzle-orm';
import { db, regions, tiles, plots } from '../../db/index';
import { authenticateAdmin, authenticate } from '../middleware/auth';
import { logger } from '../../utils/logger';

const router = Router();

// ===========================
// REGIONS
// ===========================

/**
 * GET /api/regions?worldId=xxx&xMin=&xMax=&yMin=&yMax=
 * Get all regions for a world, optionally filtered by coordinate bounds
 * 
 * Also supports centerX, centerY, radius for lazy loading
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { worldId, xMin, xMax, yMin, yMax, centerX, centerY, radius } = req.query;

    if (!worldId || typeof worldId !== 'string') {
      return res.status(400).json({ 
        error: 'Missing required query parameter: worldId', 
        code: 'INVALID_INPUT' 
      });
    }

    // Build coordinate bounds filters if provided
    let xMinBound: number | undefined;
    let xMaxBound: number | undefined;
    let yMinBound: number | undefined;
    let yMaxBound: number | undefined;

    // Calculate bounds from center + radius OR use explicit bounds
    if (centerX && centerY) {
      const centerXNum = Number.parseInt(centerX as string);
      const centerYNum = Number.parseInt(centerY as string);
      const radiusNum = Number.parseInt((radius as string) || '1');
      xMinBound = centerXNum - radiusNum;
      xMaxBound = centerXNum + radiusNum;
      yMinBound = centerYNum - radiusNum;
      yMaxBound = centerYNum + radiusNum;
    } else if (xMin && xMax && yMin && yMax) {
      xMinBound = Number.parseInt(xMin as string);
      xMaxBound = Number.parseInt(xMax as string);
      yMinBound = Number.parseInt(yMin as string);
      yMaxBound = Number.parseInt(yMax as string);
    }

    // Build WHERE clause with optional coordinate filters
    const whereConditions = [eq(regions.worldId, worldId)];
    
    if (xMinBound !== undefined && xMaxBound !== undefined) {
      whereConditions.push(gte(regions.xCoord, xMinBound));
      whereConditions.push(lte(regions.xCoord, xMaxBound));
    }
    
    if (yMinBound !== undefined && yMaxBound !== undefined) {
      whereConditions.push(gte(regions.yCoord, yMinBound));
      whereConditions.push(lte(regions.yCoord, yMaxBound));
    }

    const worldRegions = await db.query.regions.findMany({
      where: and(...whereConditions),
      with: {
        tiles: {
          with: {
            biome: true,
            plots: {
              with: {
                settlement: true
              }
            }
          }
        }
      }
    });

    logger.info(`[API] Fetched ${worldRegions.length} regions for world ${worldId}` + 
      (xMinBound !== undefined ? ` (bounds: ${xMinBound}-${xMaxBound}, ${yMinBound}-${yMaxBound})` : ''));

    res.json({
      regions: worldRegions,
      count: worldRegions.length,
      bounds: xMinBound !== undefined ? {
        xMin: xMinBound,
        xMax: xMaxBound,
        yMin: yMinBound,
        yMax: yMaxBound
      } : undefined
    });
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
