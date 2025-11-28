import { Router } from 'express';
import { db } from '../../db/index.js';
import {
  settlements,
  settlementStorage,
  settlementStructures,
  structureModifiers,
  profiles,
  profileServerData,
  tiles,
} from '../../db/schema.js';
import { eq } from 'drizzle-orm';
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
      where: playerProfileId
        ? eq(settlements.playerProfileId, playerProfileId as string)
        : undefined,
      with: {
        tile: {
          with: {
            biome: true,
          },
        },
        structures: true,
        storage: true,
      },
    });

    res.json(result);
  } catch (error) {
    logger.error('[API] Error fetching settlements', error);
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
        tile: {
          with: {
            biome: true,
            region: true,
          },
        },
        structures: {
          with: {
            modifiers: true,
          },
        },
        storage: true,
      },
    });

    if (!settlement) {
      return res.status(404).json({ error: 'Settlement not found' });
    }

    // Ensure structures array exists (Drizzle might omit it if empty)
    if (!settlement.structures) {
      settlement.structures = [];
    }

    // Ensure each structure has a modifiers array
    settlement.structures = settlement.structures.map((structure: { modifiers?: unknown[] }) => ({
      ...structure,
      modifiers: structure.modifiers || [],
    }));

    res.json(settlement);
  } catch (error) {
    logger.error('[API] Error fetching settlement', error);
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
        required: ['username', 'serverId', 'worldId', 'accountId'],
      });
    }

    // Step 1: Find a suitable starting TILE (settlements claim tiles, not plots)
    logger.info(`[SETTLEMENT CREATE] Finding suitable tile for world ${worldId}`);

    // SCHEMA NOTE: Tiles don't have worldId directly, must query through regions
    // First, get all regions in this world
    const worldRegions = await db.query.regions.findMany({
      where: (regions, { eq }) => eq(regions.worldId, worldId),
      columns: { id: true },
    });

    const regionIds = worldRegions.map((r) => r.id);
    logger.info(`[SETTLEMENT CREATE] Found ${regionIds.length} regions in world ${worldId}`);

    if (regionIds.length === 0) {
      return res.status(404).json({
        error: 'World has no regions',
        code: 'NO_REGIONS',
      });
    }

    // Query unclaimed tiles in this world's regions
    const suitableTiles = await db.query.tiles.findMany({
      where: (tiles, { inArray, and, isNull }) =>
        and(
          inArray(tiles.regionId, regionIds), // In this world
          isNull(tiles.settlementId) // Not already claimed
        ),
      with: {
        region: true, // Include region for debugging
      },
      limit: 1000, // Get a large sample of tiles
    });

    // DEBUG: Log sample tiles
    logger.info(
      `[SETTLEMENT CREATE] Found ${suitableTiles.length} unclaimed tiles in world, analyzing first 3...`
    );
    for (let i = 0; i < Math.min(3, suitableTiles.length); i++) {
      const tile = suitableTiles[i];
      logger.info(
        `[SETTLEMENT CREATE] Tile ${i}: regionWorldId=${tile.region?.worldId}, elevation=${tile.elevation}, precipitation=${tile.precipitation}, temperature=${tile.temperature}`
      );
    }

    // Filter for tiles with suitable terrain for settlement
    // Per GDD: elevation is -100 to 100, precipitation 0-100, temperature -50 to 50
    let viableTiles = suitableTiles.filter(
      (tile) =>
        (tile.elevation ?? -101) > 0 && // Land (elevation > 0, ocean is <= 0)
        (tile.elevation ?? 101) < 80 && // Not too mountainous (< 80 out of 100)
        (tile.precipitation ?? 0) >= 20 && // Some rainfall for crops
        (tile.temperature ?? -100) > -20 // Not frozen tundra
    );

    logger.info(`[SETTLEMENT CREATE] Found ${viableTiles.length} ideal tiles (worldId=${worldId})`);

    // Fallback if no ideal tiles
    if (viableTiles.length === 0) {
      logger.warn('[SETTLEMENT CREATE] No ideal tiles, using relaxed criteria');
      viableTiles = suitableTiles.filter(
        (tile) => (tile.elevation ?? -101) > 0 // Must still be land (elevation > 0)
      );
      logger.info(`[SETTLEMENT CREATE] Found ${viableTiles.length} relaxed tiles`);
    }

    if (viableTiles.length === 0) {
      return res.status(404).json({
        error: 'No viable tiles for settlement found',
        code: 'NO_SUITABLE_TILES',
      });
    }

    // Pick a random tile
    const chosenTile = viableTiles[Math.floor(Math.random() * viableTiles.length)];

    logger.info(
      `[SETTLEMENT CREATE] Chosen tile ${chosenTile.id} with elevation=${chosenTile.elevation}, precipitation=${chosenTile.precipitation}, temperature=${chosenTile.temperature}`
    );

    // Step 2: Get or create profile
    // PRODUCTION BUG #8 FIX: Check if profile exists before creating
    let existingProfile = await db.query.profiles.findFirst({
      where: (profiles, { eq }) => eq(profiles.accountId, accountId),
    });

    let profileId: string;
    if (existingProfile) {
      profileId = existingProfile.id;
      logger.info(
        `[SETTLEMENT CREATE] Using existing profile ${profileId} for account ${accountId}`
      );
    } else {
      profileId = createId();
      await db.insert(profiles).values({
        id: profileId,
        username,
        picture:
          picture || `https://via.placeholder.com/128x128?text=${username.charAt(0).toUpperCase()}`,
        accountId,
      });
      logger.info(`[SETTLEMENT CREATE] Created new profile ${profileId} for ${username}`);
    }

    // Step 3: Create profile-server data
    await db.insert(profileServerData).values({
      profileId,
      serverId,
    });

    // Step 4: Create storage with starting resources (per GDD specification)
    const storageId = createId();
    await db.insert(settlementStorage).values({
      id: storageId,
      food: 50, // ~2.5 hours for 10 population at GDD rates
      water: 100, // ~2.5 hours for 10 population
      wood: 50, // Can build 2 FARMs (20 wood each) or 5 TENTs (10 wood each)
      stone: 30, // Can build 3 FARMs (10 stone each) or other structures
      ore: 10, // Per GDD spec - starting ore for basic tools/equipment
    });

    logger.info(`[SETTLEMENT CREATE] Created storage ${storageId}`);

    // Step 5: Create settlement ON THE TILE (not on a plot!)
    const settlementId = createId();
    await db.insert(settlements).values({
      id: settlementId,
      name: 'Home Settlement',
      tileId: chosenTile.id, // Settlement claims the TILE
      playerProfileId: profileId,
      settlementStorageId: storageId,
    });

    logger.info(
      `[SETTLEMENT CREATE] Created settlement ${settlementId} for profile ${profileId} on tile ${chosenTile.id}`
    );

    // Step 6: Update Tile.settlementId to point back to settlement (bidirectional FK)
    await db.update(tiles).set({ settlementId }).where(eq(tiles.id, chosenTile.id));

    logger.info(
      `[SETTLEMENT CREATE] Updated tile ${chosenTile.id} settlementId to ${settlementId}`
    );

    // Step 7: Create starting TENT structure on tile slot 0
    // First, look up the master "Tent" structure definition
    const tentMaster = await db.query.structures.findFirst({
      where: (structures, { eq }) => eq(structures.name, 'Tent'),
    });

    if (!tentMaster) {
      return res.status(500).json({
        error: 'Master TENT structure not found in database',
        code: 'MISSING_MASTER_STRUCTURE',
      });
    }

    const tentId = createId();
    await db.insert(settlementStructures).values({
      id: tentId,
      structureId: tentMaster.id, // FK to master structure definition
      settlementId: settlementId,
      tileId: chosenTile.id, // Structure built ON TILE
      slotPosition: 0, // First slot (0-4 available)
      level: 1,
    });

    logger.info(
      `[SETTLEMENT CREATE] Created starting TENT structure ${tentId} on tile ${chosenTile.id} slot 0`
    );

    // Step 9: Create structure modifier for TENT (+5 population capacity per GDD spec)
    const tentModifierId = createId();
    await db.insert(structureModifiers).values({
      id: tentModifierId,
      settlementStructureId: tentId,
      name: 'Housing Capacity',
      description: 'Provides shelter for 5 people',
      value: 5,
    });

    logger.info(
      `[SETTLEMENT CREATE] Created TENT modifier ${tentModifierId} (+5 population capacity)`
    );

    // Fetch and return the complete settlement
    const newSettlement = await db.query.settlements.findFirst({
      where: eq(settlements.id, settlementId),
      with: {
        tile: {
          with: {
            biome: true,
            region: {
              with: {
                world: true,
              },
            },
          },
        },
        storage: true,
        playerProfile: true,
      },
    });

    res.status(201).json(newSettlement);
  } catch (error) {
    logger.error('[SETTLEMENT CREATE] Error:', error);

    // Handle unique constraint violations
    if (error instanceof Error && error.message.includes('unique')) {
      return res.status(409).json({
        error: 'Username already taken or account already has a profile',
        code: 'DUPLICATE_ENTRY',
      });
    }

    res.status(500).json({ error: 'Failed to create settlement' });
  }
});

export default router;
