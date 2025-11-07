/**
 * Worlds API Routes
 * 
 * CRUD operations for world management
 */

import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { db, worlds, regions, tiles, plots } from '../../db/index';
import { authenticateAdmin } from '../middleware/auth';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/worlds
 * List all worlds with server information
 */
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const allWorlds = await db.query.worlds.findMany({
      with: {
        server: {
          columns: {
            id: true,
            name: true,
            status: true
          }
        }
      },
      orderBy: (worlds, { desc }) => [desc(worlds.createdAt)]
    });
    
    res.json(allWorlds);
  } catch (error) {
    logger.error('[API] Error fetching worlds:', error);
    res.status(500).json({ 
      error: 'Failed to fetch worlds', 
      code: 'FETCH_FAILED' 
    });
  }
});

/**
 * GET /api/worlds/:id
 * Get world details with regions and tiles
 */
router.get('/:id', authenticateAdmin, async (req, res) => {
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
                biome: true
              }
            }
          }
        }
      }
    });
    
    if (!world) {
      return res.status(404).json({ 
        error: 'World not found', 
        code: 'NOT_FOUND' 
      });
    }
    
    res.json(world);
  } catch (error) {
    logger.error('[API] Error fetching world:', error);
    res.status(500).json({ 
      error: 'Failed to fetch world', 
      code: 'FETCH_FAILED' 
    });
  }
});

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
      plots: worldPlots
    } = req.body;

    // Validation
    if (!name || !serverId) {
      return res.status(400).json({ 
        error: 'Missing required fields: name and serverId', 
        code: 'INVALID_INPUT' 
      });
    }

    // Create world
    const [newWorld] = await db.insert(worlds).values({
      id: createId(),
      name,
      serverId,
      elevationSettings: elevationSettings || {},
      precipitationSettings: precipitationSettings || {},
      temperatureSettings: temperatureSettings || {}
    }).returning();

    logger.info(`[API] Created world: ${newWorld.id} - ${newWorld.name}`);

    // Bulk insert regions if provided
    if (worldRegions && Array.isArray(worldRegions) && worldRegions.length > 0) {
      const regionsToInsert = worldRegions.map(r => ({
        ...r,
        worldId: newWorld.id // Ensure worldId is set
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
    logger.error('[API] Error creating world:', error);
    res.status(500).json({ 
      error: 'Failed to create world', 
      code: 'CREATE_FAILED',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
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
      where: eq(worlds.id, id)
    });

    if (!existing) {
      return res.status(404).json({ 
        error: 'World not found', 
        code: 'NOT_FOUND' 
      });
    }

    // Update world
    const [updated] = await db.update(worlds)
      .set({
        name: name || existing.name,
        elevationSettings: elevationSettings || existing.elevationSettings,
        precipitationSettings: precipitationSettings || existing.precipitationSettings,
        temperatureSettings: temperatureSettings || existing.temperatureSettings,
        updatedAt: new Date()
      })
      .where(eq(worlds.id, id))
      .returning();

    logger.info(`[API] Updated world: ${id}`);
    res.json(updated);
  } catch (error) {
    logger.error('[API] Error updating world:', error);
    res.status(500).json({ 
      error: 'Failed to update world', 
      code: 'UPDATE_FAILED' 
    });
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
      where: eq(worlds.id, id)
    });

    if (!existing) {
      return res.status(404).json({ 
        error: 'World not found', 
        code: 'NOT_FOUND' 
      });
    }

    // Delete world (cascade will handle related data)
    await db.delete(worlds).where(eq(worlds.id, id));

    logger.info(`[API] Deleted world: ${id} - ${existing.name}`);
    res.json({ 
      success: true, 
      message: `World "${existing.name}" deleted successfully` 
    });
  } catch (error) {
    logger.error('[API] Error deleting world:', error);
    res.status(500).json({ 
      error: 'Failed to delete world', 
      code: 'DELETE_FAILED' 
    });
  }
});

export default router;
