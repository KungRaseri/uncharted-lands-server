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
import { db, settlementStructures, settlements, structures } from '../../db/index.js';
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
 * Must come before /:id route to avoid route collision
 */
router.get('/metadata', async (req: Request, res: Response) => {
  try {
    const allCosts = getAllStructureCosts();
    const metadata = allCosts.map((structure) => {
      const requirements = getStructureRequirements(structure.name);
      const modifiers = getStructureModifiers(structure.name);

      return {
        id: structure.id,
        name: structure.name,
        displayName: structure.displayName,
        description: structure.description,
        category: structure.category,
        tier: structure.tier,
        costs: structure.costs,
        constructionTimeSeconds: structure.constructionTimeSeconds,
        populationRequired: structure.populationRequired,
        requirements,
        modifiers: modifiers || [],
      };
    });

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
 * Create a new settlement building (non-extractor)
 */
router.post('/create', authenticate, async (req: Request, res: Response) => {
  try {
    const { settlementId, structureName } = req.body;

    if (!settlementId || !structureName) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        code: 'MISSING_FIELDS',
        message: 'settlementId and structureName are required',
      });
    }

    // Verify settlement exists
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

    // Verify user owns the settlement
    if (!req.user || settlement.playerProfileId !== req.user.profileId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        code: 'NOT_SETTLEMENT_OWNER',
        message: 'You do not own this settlement',
      });
    }

    // Create structure in transaction
    const result = await db.transaction(async (tx) => {
      // 1. Query structure definition from database by name
      const [structureDefinition] = await tx
        .select()
        .from(structures)
        .where(eq(structures.name, structureName))
        .limit(1);

      if (!structureDefinition) {
        throw new Error(`Structure not found: ${structureName}`);
      }

      // 2. Validate and deduct resources BEFORE creating structure
      // Use extractorType or buildingType depending on category
      const structureType = structureDefinition.extractorType || structureDefinition.buildingType;
      if (!structureType) {
        throw new Error(`Invalid structure definition for ${structureName}: missing type`);
      }

      const validation = await validateAndDeductResources(tx, settlementId, structureType);

      if (!validation.success) {
        // Throw error to rollback transaction
        const error = new Error('INSUFFICIENT_RESOURCES') as Error & {
          validation: ValidationResult;
        };
        error.validation = validation;
        throw error;
      }

      // 3. Create the settlement structure instance
      // ✅ FIX: Set tileId to settlement's founding tile for extractors
      // This allows the game loop to find extractors by filtering on tile.id

      // Use settlement.tileId directly (it's a required field on settlements table)
      const [structure] = await tx
        .insert(settlementStructures)
        .values({
          id: createId(),
          structureId: structureDefinition.id,
          settlementId,
          tileId: settlement.tileId, // Use settlement's founding tile ID directly
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
