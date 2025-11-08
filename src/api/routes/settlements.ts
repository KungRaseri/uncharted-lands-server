import { Router } from 'express';
import { db } from '../../db/index.js';
import { settlements, settlementStorage, profiles, profileServerData, tiles } from '../../db/schema.js';
import { eq, and, gt, lt, gte, lte } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../../utils/logger.js';

const router = Router();

/**
 * GET /api/settlements
 * Get all settlements (with optional player filter)
 */
router.get('/', async (req, res) => {
  try {
    const { playerProfileId } = req.query;

    // Build the query
    const result = await db.query.settlements.findMany({
      where: playerProfileId ? eq(settlements.playerProfileId, playerProfileId as string) : undefined,
      with: {
        plot: {
          with: {
            tile: {
              with: {
                biome: true
              }
            }
          }
        },
        structures: true,
        storage: true
      }
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching settlements:', error);
    res.status(500).json({ error: 'Failed to fetch settlements' });
  }
});

/**
 * GET /api/settlements/:id
 * Get a specific settlement by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const settlement = await db.query.settlements.findFirst({
      where: eq(settlements.id, id),
      with: {
        plot: {
          with: {
            tile: {
              with: {
                biome: true,
                region: true
              }
            }
          }
        },
        structures: true,
        storage: true
      }
    });

    if (!settlement) {
      return res.status(404).json({ error: 'Settlement not found' });
    }

    res.json(settlement);
  } catch (error) {
    console.error('Error fetching settlement:', error);
    res.status(500).json({ error: 'Failed to fetch settlement' });
  }
});

/**
 * POST /api/settlements
 * Create a new settlement with profile and storage
 * 
 * Body: {
 *   username: string,
 *   serverId: string,
 *   worldId: string,
 *   accountId: string,
 *   picture?: string
 * }
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { username, serverId, worldId, accountId, picture } = req.body;

    // Validate required fields
    if (!username || !serverId || !worldId || !accountId) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['username', 'serverId', 'worldId', 'accountId']
      });
    }

    // Step 1: Find a suitable starting plot
    logger.info(`[SETTLEMENT CREATE] Finding suitable plot for world ${worldId}`);
    
    const suitableTiles = await db.query.tiles.findMany({
      where: and(
        gt(tiles.elevation, 0),      // Must be land
        lt(tiles.elevation, 25),     // Not too mountainous
        gte(tiles.precipitation, 150), // Adequate rainfall
        lte(tiles.precipitation, 350), // Not too much
        gte(tiles.temperature, 10),   // Warm enough
        lte(tiles.temperature, 28)    // Not too hot
      ),
      with: {
        region: true,
        plots: true
      },
      limit: 100 // Get a sample of good tiles
    });

    if (suitableTiles.length === 0) {
      return res.status(404).json({ 
        error: 'No suitable plots found in this world',
        code: 'NO_VIABLE_PLOTS'
      });
    }

    // Filter for plots with good resources
    let viablePlots = suitableTiles
      .filter(tile => tile.region.worldId === worldId) // Ensure correct world
      .flatMap(tile => tile.plots)
      .filter(plot => 
        plot.food >= 3 &&
        plot.water >= 3 &&
        plot.wood >= 3
      );

    // Fallback if no ideal plots
    if (viablePlots.length === 0) {
      logger.warn('[SETTLEMENT CREATE] No ideal plots, using relaxed criteria');
      viablePlots = suitableTiles
        .filter(tile => tile.region.worldId === worldId)
        .flatMap(tile => tile.plots)
        .filter(plot => 
          plot.food >= 2 &&
          plot.water >= 2 &&
          plot.wood >= 2
        );
    }

    if (viablePlots.length === 0) {
      return res.status(404).json({ 
        error: 'No viable plots with sufficient resources found',
        code: 'INSUFFICIENT_RESOURCES'
      });
    }

    // Pick a random plot
    const chosenPlot = viablePlots[Math.floor(Math.random() * viablePlots.length)];
    
    logger.info(`[SETTLEMENT CREATE] Chosen plot ${chosenPlot.id} with food=${chosenPlot.food}, water=${chosenPlot.water}, wood=${chosenPlot.wood}`);

    // Step 2: Create profile
    const profileId = createId();
    await db.insert(profiles).values({
      id: profileId,
      username,
      picture: picture || `https://via.placeholder.com/128x128?text=${username.charAt(0).toUpperCase()}`,
      accountId
    });

    logger.info(`[SETTLEMENT CREATE] Created profile ${profileId} for ${username}`);

    // Step 3: Create profile-server data
    await db.insert(profileServerData).values({
      profileId,
      serverId
    });

    // Step 4: Create storage
    const storageId = createId();
    await db.insert(settlementStorage).values({
      id: storageId,
      food: 5,
      water: 5,
      wood: 10,
      stone: 5,
      ore: 0
    });

    logger.info(`[SETTLEMENT CREATE] Created storage ${storageId}`);

    // Step 5: Create settlement
    const settlementId = createId();
    await db.insert(settlements).values({
      id: settlementId,
      name: 'Home Settlement',
      plotId: chosenPlot.id,
      playerProfileId: profileId,
      settlementStorageId: storageId
    });

    logger.info(`[SETTLEMENT CREATE] Created settlement ${settlementId} for profile ${profileId}`);

    // Fetch and return the complete settlement
    const newSettlement = await db.query.settlements.findFirst({
      where: eq(settlements.id, settlementId),
      with: {
        plot: {
          with: {
            tile: {
              with: {
                biome: true,
                region: {
                  with: {
                    world: true
                  }
                }
              }
            }
          }
        },
        storage: true,
        playerProfile: true
      }
    });

    res.status(201).json(newSettlement);
  } catch (error) {
    logger.error('[SETTLEMENT CREATE] Error:', error);
    
    // Handle unique constraint violations
    if (error instanceof Error && error.message.includes('unique')) {
      return res.status(409).json({ 
        error: 'Username already taken or account already has a profile',
        code: 'DUPLICATE_ENTRY'
      });
    }
    
    res.status(500).json({ error: 'Failed to create settlement' });
  }
});

export default router;
