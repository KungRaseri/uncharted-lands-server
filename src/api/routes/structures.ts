/**
 * Structure Management API Routes
 *
 * Handles settlement building operations:
 * - Building settlement structures (non-extractors)
 * - Upgrading structures
 * - Viewing structure details
 */

import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import {
  db,
  settlementStructures,
  structureRequirements,
  settlements,
  plots,
} from '../../db/index.js';
import { generateId } from '../../db/queries.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../../utils/logger.js';

const router = Router();

/**
 * Map client structure IDs to database BuildingType enum values
 * This is a temporary solution until we add all structure types to the database
 */
function mapStructureToBuildingType(structureId: string): string | null {
  const mapping: Record<string, string> = {
    // Housing
    tent: 'HOUSE',
    cottage: 'HOUSE',
    house: 'HOUSE',
    mansion: 'HOUSE',
    // Production
    farm: 'WORKSHOP',
    well: 'WORKSHOP',
    lumbermill: 'WORKSHOP',
    quarry: 'WORKSHOP',
    mine: 'WORKSHOP',
    windmill: 'WORKSHOP',
    solar_panel: 'WORKSHOP',
    // Storage
    warehouse: 'STORAGE',
    silo: 'STORAGE',
    cellar: 'STORAGE',
    // Defense
    watchtower: 'BARRACKS',
    barracks: 'BARRACKS',
    wall: 'WALL',
    gate: 'WALL',
    // Utility
    market: 'MARKETPLACE',
    town_hall: 'TOWN_HALL',
    workshop: 'WORKSHOP',
  };

  return mapping[structureId] || null;
}

/**
 * GET /api/structures/:id
 * Get structure details
 */
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const structure = await db.query.settlementStructures.findFirst({
      where: eq(settlementStructures.id, id),
      with: {
        buildRequirements: true,
        settlement: true,
        plot: true,
      },
    });

    if (!structure) {
      return res.status(404).json({
        error: 'Not Found',
        code: 'STRUCTURE_NOT_FOUND',
        message: 'Structure not found',
      });
    }

    return res.json(structure);
  } catch (error) {
    logger.error('[API] Failed to fetch structure', { error, structureId: req.params.id });
    return res.status(500).json({
      error: 'Internal Server Error',
      code: 'FETCH_FAILED',
      message: 'Failed to fetch structure details',
    });
  }
});

/**
 * POST /api/structures/create
 * Create a new settlement building (non-extractor)
 */
router.post('/create', authenticate, async (req: Request, res: Response) => {
  try {
    const { settlementId, buildingType, name, description } = req.body;

    if (!settlementId || !buildingType) {
      return res.status(400).json({
        error: 'Bad Request',
        code: 'MISSING_FIELDS',
        message: 'settlementId and buildingType are required',
      });
    }

    // Map client structure ID to database building type
    const dbBuildingType = mapStructureToBuildingType(buildingType);

    if (!dbBuildingType) {
      return res.status(400).json({
        error: 'Bad Request',
        code: 'INVALID_BUILDING_TYPE',
        message: `Unknown building type: ${buildingType}`,
      });
    }

    // Verify settlement exists
    const settlement = await db.query.settlements.findFirst({
      where: eq(settlements.id, settlementId),
    });

    if (!settlement) {
      return res.status(404).json({
        error: 'Not Found',
        code: 'SETTLEMENT_NOT_FOUND',
        message: 'Settlement not found',
      });
    }

    // Verify user owns the settlement
    if (!req.user || settlement.playerProfileId !== req.user.profileId) {
      return res.status(403).json({
        error: 'Forbidden',
        code: 'NOT_SETTLEMENT_OWNER',
        message: 'You do not own this settlement',
      });
    }

    // Create building in transaction
    const newStructure = await db.transaction(async (tx) => {
      // Create structure requirements (placeholder - in future, check actual requirements)
      const [requirements] = await tx
        .insert(structureRequirements)
        .values({
          id: generateId(),
        })
        .returning();

      // Create the building
      const [building] = await tx
        .insert(settlementStructures)
        .values({
          id: generateId(),
          settlementId,
          structureRequirementsId: requirements.id,
          category: 'BUILDING',
          buildingType: dbBuildingType,
          level: 1,
          name: name || `${buildingType} Level 1`,
          description: description || `A ${buildingType.toLowerCase()} for your settlement`,
        })
        .returning();

      return building;
    });

    logger.info('[API] Building created', {
      structureId: newStructure.id,
      settlementId,
      buildingType: dbBuildingType,
      clientBuildingType: buildingType,
    });

    return res.status(201).json(newStructure);
  } catch (error) {
    logger.error('[API] Failed to create building', { error, body: req.body });
    return res.status(500).json({
      error: 'Internal Server Error',
      code: 'CREATE_FAILED',
      message: 'Failed to create building',
    });
  }
});

/**
 * POST /api/structures/:id/upgrade
 * Upgrade a structure to the next level
 */
router.post('/:id/upgrade', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const structure = await db.query.settlementStructures.findFirst({
      where: eq(settlementStructures.id, id),
      with: {
        settlement: true,
      },
    });

    if (!structure) {
      return res.status(404).json({
        error: 'Not Found',
        code: 'STRUCTURE_NOT_FOUND',
        message: 'Structure not found',
      });
    }

    // Verify user owns the settlement
    if (!req.user || structure.settlement?.playerProfileId !== req.user.profileId) {
      return res.status(403).json({
        error: 'Forbidden',
        code: 'NOT_SETTLEMENT_OWNER',
        message: 'You do not own this settlement',
      });
    }

    // TODO: In future, check upgrade requirements (resources, etc.)

    // Upgrade the structure
    const nextLevel = structure.level + 1;
    const [upgraded] = await db
      .update(settlementStructures)
      .set({
        level: nextLevel,
        name: structure.name.replace(/Level \d+/, `Level ${nextLevel}`),
      })
      .where(eq(settlementStructures.id, id))
      .returning();

    // If it's an extractor, also update the plot's production rate
    if (structure.category === 'EXTRACTOR' && structure.plotId) {
      const plot = await db.query.plots.findFirst({
        where: eq(plots.id, structure.plotId),
        with: {
          tile: {
            with: {
              biome: true,
            },
          },
        },
      });

      if (plot?.resourceType && structure.extractorType) {
        const { calculateProductionRate } = await import('../../utils/resource-production.js');
        const newProductionRate = calculateProductionRate({
          resourceType: plot.resourceType,
          extractorType: structure.extractorType,
          biomeName: plot.tile?.biome?.name || '',
          structureLevel: nextLevel,
        });

        await db
          .update(plots)
          .set({
            baseProductionRate: newProductionRate,
            updatedAt: new Date(),
          })
          .where(eq(plots.id, structure.plotId));
      }
    }

    logger.info('[API] Structure upgraded', {
      structureId: id,
      level: nextLevel,
      category: structure.category,
    });

    return res.json(upgraded);
  } catch (error) {
    logger.error('[API] Failed to upgrade structure', { error, structureId: req.params.id });
    return res.status(500).json({
      error: 'Internal Server Error',
      code: 'UPGRADE_FAILED',
      message: 'Failed to upgrade structure',
    });
  }
});

/**
 * GET /api/structures/by-settlement/:settlementId
 * Get all structures in a settlement
 */
router.get('/by-settlement/:settlementId', authenticate, async (req: Request, res: Response) => {
  try {
    const { settlementId } = req.params;

    const structureList = await db.query.settlementStructures.findMany({
      where: eq(settlementStructures.settlementId, settlementId),
      with: {
        plot: true,
        buildRequirements: true,
      },
    });

    return res.json(structureList);
  } catch (error) {
    logger.error('[API] Failed to fetch structures by settlement', {
      error,
      settlementId: req.params.settlementId,
    });
    return res.status(500).json({
      error: 'Internal Server Error',
      code: 'FETCH_FAILED',
      message: 'Failed to fetch structures',
    });
  }
});

/**
 * DELETE /api/structures/:id
 * Demolish a structure
 */
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const structure = await db.query.settlementStructures.findFirst({
      where: eq(settlementStructures.id, id),
      with: {
        settlement: true,
      },
    });

    if (!structure) {
      return res.status(404).json({
        error: 'Not Found',
        code: 'STRUCTURE_NOT_FOUND',
        message: 'Structure not found',
      });
    }

    // Verify user owns the settlement
    if (!req.user || structure.settlement?.playerProfileId !== req.user.profileId) {
      return res.status(403).json({
        error: 'Forbidden',
        code: 'NOT_SETTLEMENT_OWNER',
        message: 'You do not own this settlement',
      });
    }

    // Delete structure (cascade will handle requirements)
    await db.delete(settlementStructures).where(eq(settlementStructures.id, id));

    logger.info('[API] Structure demolished', {
      structureId: id,
      settlementId: structure.settlementId,
      type: structure.category,
    });

    return res.json({
      success: true,
      message: `${structure.name} demolished`,
    });
  } catch (error) {
    logger.error('[API] Failed to demolish structure', { error, structureId: req.params.id });
    return res.status(500).json({
      error: 'Internal Server Error',
      code: 'DEMOLISH_FAILED',
      message: 'Failed to demolish structure',
    });
  }
});

export default router;
