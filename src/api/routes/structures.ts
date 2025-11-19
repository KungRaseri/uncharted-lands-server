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
  settlements,
  plots,
  worlds,
  structures,
} from '../../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../../utils/logger.js';
import type { WorldTemplateType } from '../../types/world-templates.js';
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
      const validation = await validateAndDeductResources(
        tx,
        settlementId,
        structureDefinition.name
      );

      if (!validation.success) {
        // Throw error to rollback transaction
        const error = new Error('INSUFFICIENT_RESOURCES') as Error & {
          validation: ValidationResult;
        };
        error.validation = validation;
        throw error;
      }

      // 3. Create the settlement structure instance
      const [structure] = await tx
        .insert(settlementStructures)
        .values({
          id: createId(),
          structureId: structureDefinition.id,
          settlementId,
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
    const worldId = settlement.worldId;
    if (worldId && req.app.get('io')) {
      req.app.get('io').to(`world:${worldId}`).emit('structure:built', {
        settlementId,
        structure: result.structure,
        category: result.structureDefinition.category,
        structureName: result.structureDefinition.name,
        resourcesDeducted: result.validation.deductedResources,
      });
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

        // Phase 1D: Load world template for production multiplier
        const { getWorldTemplateConfig } = await import('../../types/world-templates.js');
        const world = await db.query.worlds.findFirst({
          where: eq(worlds.id, structure.settlement.worldId),
        });
        const worldTemplate = getWorldTemplateConfig(
          (world?.worldTemplateType as WorldTemplateType) || 'STANDARD'
        );

        const newProductionRate = calculateProductionRate({
          resourceType: plot.resourceType,
          extractorType: structure.extractorType,
          biomeName: plot.tile?.biome?.name || '',
          structureLevel: nextLevel,
          worldTemplateMultiplier: worldTemplate.productionMultiplier,
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
