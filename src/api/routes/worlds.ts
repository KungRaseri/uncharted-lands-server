/**
 * Worlds API Routes
 *
 * CRUD operations for world management
 */

import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { db, worlds, regions, tiles, plots } from '../../db/index.js';
import { authenticate, authenticateAdmin } from '../middleware/auth.js';
import { logger } from '../../utils/logger.js';
import { sendServerError, sendNotFoundError, sendBadRequestError } from '../utils/responses.js';

const router = Router();

/**
 * GET /api/worlds
 * List all worlds with server information
 * Accessible to all authenticated users (needed for settlement creation)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const allWorlds = await db.query.worlds.findMany({
      with: {
        server: {
          columns: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: (worlds, { desc }) => [desc(worlds.createdAt)],
    });

    res.json(allWorlds);
  } catch (error) {
    sendServerError(res, error, 'Failed to fetch worlds', 'FETCH_FAILED');
  }
});

/**
 * GET /api/worlds/:id
 * Get world details with regions, tiles, and statistics
 * Accessible to all authenticated users
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const world = await db.query.worlds.findFirst({
      where: eq(worlds.id, id),
      with: {
        server: true,
        regions: {
          with: {
            tiles: {
              with: {
                biome: true,
                plots: {
                  with: {
                    settlement: {
                      columns: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!world) {
      return sendNotFoundError(res, 'World not found');
    }

    // Calculate statistics
    const stats = calculateWorldStatistics(world.regions || []);

    // Add stats to response
    const worldWithStats = {
      ...world,
      _count: stats,
    };

    res.json(worldWithStats);
  } catch (error) {
    sendServerError(res, error, 'Failed to fetch world', 'FETCH_FAILED');
  }
});

/**
 * Helper function to calculate world statistics
 * Extracted to reduce cognitive complexity
 */
function calculateWorldStatistics(regions: any[]) {
  let landTilesCount = 0;
  let oceanTilesCount = 0;
  const settlementIds = new Set<string>();

  for (const region of regions) {
    const tiles = region.tiles || [];
    for (const tile of tiles) {
      const tileStats = processTile(tile);
      landTilesCount += tileStats.landTiles;
      oceanTilesCount += tileStats.oceanTiles;
      for (const id of tileStats.settlementIds) {
        settlementIds.add(id);
      }
    }
  }

  return {
    regions: regions.length,
    settlements: settlementIds.size,
    landTiles: landTilesCount,
    oceanTiles: oceanTilesCount,
  };
}

/**
 * Helper function to process a single tile
 */
function processTile(tile: any) {
  const landTiles = tile.type === 'LAND' ? 1 : 0;
  const oceanTiles = tile.type === 'OCEAN' ? 1 : 0;
  const settlementIds = new Set<string>();

  for (const plot of tile.plots || []) {
    if (plot.settlement?.id) {
      settlementIds.add(plot.settlement.id);
    }
  }

  return { landTiles, oceanTiles, settlementIds };
}

/**
 * POST /api/worlds
 * Create new world with optional bulk regions/tiles/plots
 *
 * Body: {
 *   name: string,
 *   serverId: string,
 *   elevationSettings: object,
 *   precipitationSettings: object,
 *   temperatureSettings: object,
 *   regions?: Region[],  // Optional bulk create
 *   tiles?: Tile[],      // Optional bulk create
 *   plots?: Plot[]       // Optional bulk create
 * }
 */
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const {
      name,
      serverId,
      elevationSettings,
      precipitationSettings,
      temperatureSettings,
      regions: worldRegions,
      tiles: worldTiles,
      plots: worldPlots,
    } = req.body;

    // Validation
    if (!name || !serverId) {
      return sendBadRequestError(res, 'Missing required fields: name and serverId');
    }

    // Create world
    const [newWorld] = await db
      .insert(worlds)
      .values({
        id: createId(),
        name,
        serverId,
        elevationSettings: elevationSettings || {},
        precipitationSettings: precipitationSettings || {},
        temperatureSettings: temperatureSettings || {},
      })
      .returning();

    logger.info(`[API] Created world: ${newWorld.id} - ${newWorld.name}`);

    // Bulk insert regions if provided
    if (worldRegions && Array.isArray(worldRegions) && worldRegions.length > 0) {
      const regionsToInsert = worldRegions.map((r) => ({
        ...r,
        worldId: newWorld.id, // Ensure worldId is set
      }));
      await db.insert(regions).values(regionsToInsert);
      logger.info(`[API] Created ${regionsToInsert.length} regions for world ${newWorld.id}`);
    }

    // Bulk insert tiles if provided
    if (worldTiles && Array.isArray(worldTiles) && worldTiles.length > 0) {
      await db.insert(tiles).values(worldTiles);
      logger.info(`[API] Created ${worldTiles.length} tiles for world ${newWorld.id}`);
    }

    // Bulk insert plots if provided
    if (worldPlots && Array.isArray(worldPlots) && worldPlots.length > 0) {
      await db.insert(plots).values(worldPlots);
      logger.info(`[API] Created ${worldPlots.length} plots for world ${newWorld.id}`);
    }

    res.status(201).json(newWorld);
  } catch (error) {
    sendServerError(res, error, 'Failed to create world', 'CREATE_FAILED');
  }
});

/**
 * PUT /api/worlds/:id
 * Update world settings
 */
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, elevationSettings, precipitationSettings, temperatureSettings } = req.body;

    // Check if world exists
    const existing = await db.query.worlds.findFirst({
      where: eq(worlds.id, id),
    });

    if (!existing) {
      return sendNotFoundError(res, 'World not found');
    }

    // Update world
    const [updated] = await db
      .update(worlds)
      .set({
        name: name || existing.name,
        elevationSettings: elevationSettings || existing.elevationSettings,
        precipitationSettings: precipitationSettings || existing.precipitationSettings,
        temperatureSettings: temperatureSettings || existing.temperatureSettings,
        updatedAt: new Date(),
      })
      .where(eq(worlds.id, id))
      .returning();

    logger.info(`[API] Updated world: ${id}`);
    res.json(updated);
  } catch (error) {
    sendServerError(res, error, 'Failed to update world', 'UPDATE_FAILED');
  }
});

/**
 * DELETE /api/worlds/:id
 * Delete world (cascade deletes regions, tiles, plots)
 */
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if world exists
    const existing = await db.query.worlds.findFirst({
      where: eq(worlds.id, id),
    });

    if (!existing) {
      return sendNotFoundError(res, 'World not found');
    }

    // Delete world (cascade will handle related data)
    await db.delete(worlds).where(eq(worlds.id, id));

    logger.info(`[API] Deleted world: ${id} - ${existing.name}`);
    res.json({
      success: true,
      message: `World "${existing.name}" deleted successfully`,
    });
  } catch (error) {
    sendServerError(res, error, 'Failed to delete world', 'DELETE_FAILED');
  }
});

export default router;
