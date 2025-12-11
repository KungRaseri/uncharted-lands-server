/**
 * Structure Management API Routes
 *
 * Handles settlement building operations:
 * - Building settlement structures (non-extractors)
 * - Upgrading structures
 * - Viewing structure details
 */

import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db, settlementStructures, settlements, structures, tiles } from '../../db/index.js';
import type { Structure, Settlement } from '../../db/schema.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../../utils/logger.js';
import { createId } from '@paralleldrive/cuid2';
import {
  validateAndDeductResources,
  type ValidationResult,
} from '../../game/structure-validation.js';
import { getAllStructureCosts } from '../../data/structure-costs.js';
import { getStructureRequirements } from '../../data/structure-requirements.js';
import { getStructureModifiers } from '../../data/structure-modifiers.js';

const router = Router();

/**
 * GET /api/structures/metadata
 * Get all structure definitions (costs, requirements, modifiers)
 * Returns database IDs (CUIDs) for use in create structure endpoint
 * Must come before /:id route to avoid route collision
 */
router.get('/metadata', async (req: Request, res: Response) => {
  try {
    // Get structure definitions from database (with CUIDs)
    const dbStructures = await db.query.structures.findMany();

    // Map to include cost and requirement data
    const allCosts = getAllStructureCosts();
    const metadata = dbStructures
      .map((dbStructure) => {
        // Find matching cost definition by name
        const costDef = allCosts.find((c) => c.name === dbStructure.name);

        if (!costDef) {
          logger.warn(`[API] No cost definition found for structure: ${dbStructure.name}`);
          return null;
        }

        const requirements = getStructureRequirements(dbStructure.name);
        const modifiers = getStructureModifiers(dbStructure.name);

        return {
          id: dbStructure.id, // ✅ Database CUID, not hardcoded string
          name: costDef.name, // capitalized structure name
          displayName: costDef.displayName,
          description: dbStructure.description,
          category: dbStructure.category,
          extractorType: dbStructure.extractorType,
          buildingType: dbStructure.buildingType,
          tier: costDef.tier,
          costs: costDef.costs,
          constructionTimeSeconds: costDef.constructionTimeSeconds,
          populationRequired: costDef.populationRequired,
          requirements,
          modifiers: modifiers || [],
        };
      })
      .filter(Boolean); // Remove nulls

    return res.json({
      success: true,
      data: metadata,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('[API] Failed to fetch structure metadata', { error });
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      code: 'METADATA_FETCH_FAILED',
      message: 'Failed to fetch structure metadata',
    });
  }
});

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
        structure: true,
        settlement: true,
        modifiers: true,
      },
    });

    if (!structure) {
      return res.status(404).json({
        error: 'Not Found',
        code: 'STRUCTURE_NOT_FOUND',
        message: 'Structure not found',
      });
    }

    // Flatten master structure fields into response
    const structureDef = structure.structure as Structure | undefined;
    const response = {
      ...structure,
      name: structureDef?.name,
      description: structureDef?.description,
      category: structureDef?.category,
      buildingType: structureDef?.buildingType,
      extractorType: structureDef?.extractorType,
      maxLevel: structureDef?.maxLevel,
    };

    return res.json(response);
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
 * Create a new settlement structure (extractor or building)
 *
 * Required body params:
 * - settlementId: string
 * - structureId: string (Structure.id from database)
 * - tileId: string (for extractors, where to place it)
 * - slotPosition: number (for extractors, which slot 0-4)
 */
router.post('/create', authenticate, async (req: Request, res: Response) => {
  try {
    let { settlementId, structureId, tileId, slotPosition } = req.body;

    // Validate required fields
    if (!settlementId || !structureId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        code: 'MISSING_FIELDS',
        message: 'settlementId and structureId are required',
      });
    }

    // Parse slotPosition if provided (comes as string from form data)
    if (slotPosition !== undefined && slotPosition !== null) {
      slotPosition = Number.parseInt(slotPosition, 10);
      if (Number.isNaN(slotPosition)) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          code: 'INVALID_SLOT',
          message: 'Slot position must be a valid number',
        });
      }
    }

    // 1. Get structure definition BEFORE transaction
    const structureDefinition = await db.query.structures.findFirst({
      where: eq(structures.id, structureId),
    });

    if (!structureDefinition) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        code: 'STRUCTURE_NOT_FOUND',
        message: `Structure not found with id: ${structureId}`,
      });
    }

    // 2. Verify settlement exists
    const settlement = await db.query.settlements.findFirst({
      where: eq(settlements.id, settlementId),
      with: {
        tile: {
          with: {
            region: true,
          },
        },
      },
    });

    if (!settlement) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        code: 'SETTLEMENT_NOT_FOUND',
        message: 'Settlement not found',
      });
    }

    // 3. Verify user owns the settlement
    if (!req.user || settlement.playerProfileId !== req.user.profileId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        code: 'NOT_SETTLEMENT_OWNER',
        message: 'You do not own this settlement',
      });
    }

    // 4. For extractors, validate tileId and slotPosition
    if (structureDefinition.category === 'EXTRACTOR') {
      if (!tileId) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          code: 'MISSING_TILE',
          message: 'tileId is required for extractor structures',
        });
      }

      if (slotPosition === undefined || slotPosition === null) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          code: 'MISSING_SLOT',
          message: 'slotPosition is required for extractor structures',
        });
      }

      // Verify tile exists
      const tile = await db.query.tiles.findFirst({
        where: eq(tiles.id, tileId),
      });

      if (!tile) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          code: 'TILE_NOT_FOUND',
          message: 'Tile not found',
        });
      }

      // Validate slot position range
      if (slotPosition < 0 || slotPosition > tile.plotSlots - 1) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          code: 'INVALID_SLOT',
          message: `Slot position must be between 0 and ${tile.plotSlots - 1}`,
        });
      }

      // 5. Check if slot is already occupied by another EXTRACTOR on the SAME tile
      const existingExtractorInSlot = await db.query.settlementStructures.findFirst({
        where: and(
          eq(settlementStructures.settlementId, settlementId),
          eq(settlementStructures.tileId, tileId),
          eq(settlementStructures.slotPosition, slotPosition)
        ),
        with: {
          structure: true,
        },
      });

      if (
        existingExtractorInSlot?.structure &&
        'category' in existingExtractorInSlot.structure &&
        existingExtractorInSlot.structure.category === 'EXTRACTOR'
      ) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          code: 'SLOT_OCCUPIED',
          message: `Slot ${slotPosition} on tile ${tileId} is already occupied by another extractor`,
        });
      }
    }

    // 6. Start transaction to validate resources and create structure
    const result = await db.transaction(async (tx) => {
      // Get structure type for resource validation
      const structureType = structureDefinition.extractorType || structureDefinition.buildingType;
      if (!structureType) {
        throw new Error(`Invalid structure definition: missing extractorType/buildingType`);
      }

      // Validate and deduct resources
      const validation = await validateAndDeductResources(tx, settlementId, structureType);

      if (!validation.success) {
        const error = new Error('INSUFFICIENT_RESOURCES') as Error & {
          validation: ValidationResult;
        };
        error.validation = validation;
        throw error;
      }

      // Create the settlement structure instance
      const [structure] = await tx
        .insert(settlementStructures)
        .values({
          id: createId(),
          structureId: structureDefinition.id,
          settlementId,
          tileId: structureDefinition.category === 'EXTRACTOR' ? tileId : null,
          slotPosition: structureDefinition.category === 'EXTRACTOR' ? slotPosition : null,
          level: 1,
        })
        .returning();

      return { structure, structureDefinition, validation };
    });

    logger.info('[API] Structure created', {
      structureId: result.structure.id,
      settlementId,
      category: result.structureDefinition.category,
      structureName: result.structureDefinition.name,
      resourcesDeducted: result.validation.deductedResources,
    });

    // Emit Socket.IO event for real-time updates
    const worldId = settlement.tile?.region?.worldId;
    console.log('[SERVER] Attempting to emit structure:built event', {
      worldId,
      settlementId,
      hasIo: !!req.app.get('io'),
      structureName: result.structureDefinition.name,
    });
    if (worldId && req.app.get('io')) {
      const io = req.app.get('io');
      console.log('[SERVER] Emitting structure:built to room:', `world:${worldId}`);
      io.to(`world:${worldId}`).emit('structure:built', {
        settlementId,
        structure: result.structure,
        category: result.structureDefinition.category,
        structureName: result.structureDefinition.name,
        resourcesDeducted: result.validation.deductedResources,
      });
      console.log('[SERVER] structure:built event emitted successfully');
    } else {
      console.log('[SERVER] FAILED to emit - missing worldId or io instance');
    }

    return res.status(201).json({
      success: true,
      structure: result.structure,
    });
  } catch (error) {
    // Handle validation errors (insufficient resources)
    if (error instanceof Error && error.message === 'INSUFFICIENT_RESOURCES') {
      const validationError = (error as Error & { validation: ValidationResult }).validation;
      logger.warn('[API] Insufficient resources for structure', {
        settlementId: req.body.settlementId,
        structureName: req.body.structureName,
        shortages: validationError.shortages,
      });
      return res.status(400).json({
        success: false,
        error: validationError.error || 'Insufficient resources to build structure',
        shortages: validationError.shortages,
      });
    }

    // Handle all other errors
    logger.error('[API] Failed to create structure', {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      body: req.body,
    });
    return res.status(500).json({
      error: 'Internal Server Error',
      code: 'CREATE_FAILED',
      message: 'Failed to create structure',
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
        structure: true,
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
    const settlementData = structure.settlement as Settlement | undefined;
    if (!req.user || settlementData?.playerProfileId !== req.user.profileId) {
      return res.status(403).json({
        error: 'Forbidden',
        code: 'NOT_SETTLEMENT_OWNER',
        message: 'You do not own this settlement',
      });
    }

    // Upgrade the structure
    const nextLevel = structure.level + 1;
    const [upgraded] = await db
      .update(settlementStructures)
      .set({
        level: nextLevel,
      })
      .where(eq(settlementStructures.id, id))
      .returning();

    // Note: Extractor upgrades no longer update Plot production rates
    // (Plot table removed - production now calculated from Tile quality fields)

    const structureDef = structure.structure as Structure | undefined;
    logger.info('[API] Structure upgraded', {
      structureId: id,
      level: nextLevel,
      category: structureDef?.category,
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
        structure: true,
        modifiers: true,
        tile: true,
      },
    });

    // Flatten master structure fields for each structure
    const flattenedList = structureList.map((s) => {
      const structureDef = s.structure as Structure | undefined;
      return {
        ...s,
        name: structureDef?.name,
        description: structureDef?.description,
        category: structureDef?.category,
        buildingType: structureDef?.buildingType,
        extractorType: structureDef?.extractorType,
        maxLevel: structureDef?.maxLevel,
      };
    });

    return res.json(flattenedList);
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
        structure: true,
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
    const settlementData = structure.settlement as Settlement | undefined;
    if (!req.user || settlementData?.playerProfileId !== req.user.profileId) {
      return res.status(403).json({
        error: 'Forbidden',
        code: 'NOT_SETTLEMENT_OWNER',
        message: 'You do not own this settlement',
      });
    }

    // Delete structure (cascade will handle requirements)
    await db.delete(settlementStructures).where(eq(settlementStructures.id, id));

    const structureDef = structure.structure as Structure | undefined;
    logger.info('[API] Structure demolished', {
      structureId: id,
      settlementId: structure.settlementId,
      type: structureDef?.category,
    });

    return res.json({
      success: true,
      message: `${structureDef?.name || 'Structure'} demolished`,
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
