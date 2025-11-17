/**
 * Plot Management API Routes
 *
 * Handles plot operations:
 * - Creating/claiming plots within owned tiles
 * - Building extractors on plots
 * - Harvesting accumulated resources
 * - Viewing plot production details
 */

import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import {
  db,
  plots,
  tiles,
  settlementStructures,
  settlementStorage,
  worlds,
} from '../../db/index.js';
import {
  calculateProductionRate,
  calculateAccumulatedResources,
} from '../../utils/resource-production.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../../utils/logger.js';
import type { WorldTemplateType } from '../../types/world-templates.js';
import { createId } from '@paralleldrive/cuid2';
import {
  validateAndDeductResources,
  type ValidationResult,
} from '../../game/structure-validation.js';

const router = Router();

/**
 * GET /api/plots/:id
 * Get plot details with production information
 */
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const plot = await db.query.plots.findFirst({
      where: eq(plots.id, id),
      with: {
        tile: {
          with: {
            biome: true,
            settlement: true,
          },
        },
        structure: true,
        settlement: true,
      },
    });

    if (!plot) {
      return res.status(404).json({
        error: 'Not Found',
        code: 'PLOT_NOT_FOUND',
        message: 'Plot not found',
      });
    }

    // Calculate current accumulated resources
    let accumulatedResources = plot.accumulatedResources;
    if (plot.lastHarvested && plot.baseProductionRate > 0) {
      accumulatedResources += calculateAccumulatedResources(
        plot.baseProductionRate,
        plot.lastHarvested
      );
    }

    return res.json({
      ...plot,
      accumulatedResources,
    });
  } catch (error) {
    logger.error('[API] Failed to fetch plot', { error, plotId: req.params.id });
    return res.status(500).json({
      error: 'Internal Server Error',
      code: 'FETCH_FAILED',
      message: 'Failed to fetch plot details',
    });
  }
});

/**
 * POST /api/plots/create
 * Create a new plot on a tile (claim a plot slot)
 */
router.post('/create', authenticate, async (req: Request, res: Response) => {
  try {
    const { tileId, settlementId, position } = req.body;

    if (!tileId || !settlementId || position === undefined) {
      return res.status(400).json({
        error: 'Bad Request',
        code: 'MISSING_FIELDS',
        message: 'tileId, settlementId, and position are required',
      });
    }

    // Verify tile exists and get its data
    const tile = await db.query.tiles.findFirst({
      where: eq(tiles.id, tileId),
      with: {
        settlement: true,
        plots: true,
      },
    });

    if (!tile) {
      return res.status(404).json({
        error: 'Not Found',
        code: 'TILE_NOT_FOUND',
        message: 'Tile not found',
      });
    }

    // Verify settlement owns the tile
    if (tile.settlementId !== settlementId) {
      return res.status(403).json({
        error: 'Forbidden',
        code: 'NOT_TILE_OWNER',
        message: 'Settlement does not own this tile',
      });
    }

    // Check if plot slots are available
    const existingPlots = tile.plots?.length || 0;
    if (existingPlots >= tile.plotSlots) {
      return res.status(400).json({
        error: 'Bad Request',
        code: 'NO_PLOT_SLOTS',
        message: `Tile has no available plot slots (${existingPlots}/${tile.plotSlots} used)`,
      });
    }

    // Check if position is already taken
    const positionTaken = tile.plots?.some((p: { position: number }) => p.position === position);
    if (positionTaken) {
      return res.status(400).json({
        error: 'Bad Request',
        code: 'POSITION_TAKEN',
        message: 'Plot position is already occupied',
      });
    }

    // Create the plot
    const [newPlot] = await db
      .insert(plots)
      .values({
        id: createId(),
        tileId,
        settlementId,
        position,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    logger.info('[API] Plot created', {
      plotId: newPlot.id,
      tileId,
      settlementId,
      position,
    });

    return res.status(201).json(newPlot);
  } catch (error) {
    logger.error('[API] Failed to create plot', { error, body: req.body });
    return res.status(500).json({
      error: 'Internal Server Error',
      code: 'CREATE_FAILED',
      message: 'Failed to create plot',
    });
  }
});

/**
 * POST /api/plots/:id/build-extractor
 * Build an extractor structure on a plot
 */
router.post('/:id/build-extractor', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { extractorType, resourceType, structureName, structureDescription } = req.body;

    if (!extractorType || !resourceType) {
      return res.status(400).json({
        error: 'Bad Request',
        code: 'MISSING_FIELDS',
        message: 'extractorType and resourceType are required',
      });
    }

    // Get plot with related data
    const plot = await db.query.plots.findFirst({
      where: eq(plots.id, id),
      with: {
        tile: {
          with: {
            biome: true,
          },
        },
        settlement: true,
        structure: true,
      },
    });

    if (!plot) {
      return res.status(404).json({
        error: 'Not Found',
        code: 'PLOT_NOT_FOUND',
        message: 'Plot not found',
      });
    }

    // Check if plot already has a structure
    if (plot.structure) {
      return res.status(400).json({
        error: 'Bad Request',
        code: 'PLOT_OCCUPIED',
        message: 'Plot already has a structure',
      });
    }

    // Verify user owns the settlement
    if (!req.user || plot.settlement?.playerProfileId !== req.user.profileId) {
      return res.status(403).json({
        error: 'Forbidden',
        code: 'NOT_SETTLEMENT_OWNER',
        message: 'You do not own this settlement',
      });
    }

    // Verify plot belongs to a settlement
    if (!plot.settlementId) {
      return res.status(400).json({
        error: 'Bad Request',
        code: 'PLOT_NOT_CLAIMED',
        message: 'Plot must be claimed by a settlement before building',
      });
    }

    // Phase 1D: Load world template for production multiplier
    const { getWorldTemplateConfig } = await import('../../types/world-templates.js');
    const world = await db.query.worlds.findFirst({
      where: eq(worlds.id, plot.settlement?.worldId || ''),
    });
    const worldTemplate = getWorldTemplateConfig(
      (world?.worldTemplateType as WorldTemplateType) || 'STANDARD'
    );

    // Calculate production rate
    const productionRate = calculateProductionRate({
      resourceType,
      extractorType,
      biomeName: plot.tile?.biome?.name || '',
      structureLevel: 1,
      worldTemplateMultiplier: worldTemplate.productionMultiplier,
    });

    if (productionRate === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        code: 'INVALID_EXTRACTOR',
        message: `${extractorType} cannot extract ${resourceType}`,
      });
    }

    // Get quality multiplier for the resource
    let qualityMultiplier = 1;
    if (plot.tile) {
      const qualityMap: Record<string, number> = {
        FOOD: plot.tile.foodQuality,
        WOOD: plot.tile.woodQuality,
        STONE: plot.tile.stoneQuality,
        ORE: plot.tile.oreQuality,
      };
      const quality = qualityMap[resourceType] || 50;
      qualityMultiplier = quality / 50; // Normalize around 1.0
    }

    // Create structure in transaction
    const result = await db.transaction(async (tx) => {
      // 1. Validate and deduct resources BEFORE creating structure
      const validation = await validateAndDeductResources(tx, plot.settlementId, extractorType);

      if (!validation.success) {
        // Throw error to rollback transaction
        const error = new Error('INSUFFICIENT_RESOURCES') as Error & {
          validation: ValidationResult;
        };
        error.validation = validation;
        throw error;
      }

      // 2. Create the structure
      const [structure] = await tx
        .insert(settlementStructures)
        .values({
          id: createId(),
          settlementId: plot.settlementId!,
          category: 'EXTRACTOR',
          extractorType,
          level: 1,
          plotId: id,
          name: structureName || `${extractorType} Level 1`,
          description: structureDescription || `Extracts ${resourceType} from this plot`,
        })
        .returning();

      // 3. Update plot with structure and production info
      await tx
        .update(plots)
        .set({
          structureId: structure.id,
          resourceType,
          baseProductionRate: productionRate,
          qualityMultiplier,
          lastHarvested: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(plots.id, id));

      return { structure, validation };
    });

    logger.info('[API] Extractor built on plot', {
      plotId: id,
      extractorType,
      resourceType,
      productionRate,
      resourcesDeducted: result.validation.deductedResources,
    });

    // Emit Socket.IO event for real-time updates
    const worldId = plot.tile?.region?.worldId;
    if (worldId && req.app.get('io')) {
      req.app.get('io').to(`world:${worldId}`).emit('structure:built', {
        settlementId: plot.settlementId,
        structure: result.structure,
        type: 'EXTRACTOR',
        extractorType,
        resourceType,
        resourcesDeducted: result.validation.deductedResources,
      });
    }

    // Fetch updated plot
    const updatedPlot = await db.query.plots.findFirst({
      where: eq(plots.id, id),
      with: {
        structure: true,
        tile: true,
      },
    });

    return res.status(201).json(updatedPlot);
  } catch (error) {
    // Handle validation errors (insufficient resources)
    if (error instanceof Error && error.message === 'INSUFFICIENT_RESOURCES') {
      const validationError = (error as Error & { validation: ValidationResult }).validation;
      logger.warn('[API] Insufficient resources for extractor', {
        plotId: req.params.id,
        extractorType: req.body.extractorType,
        shortages: validationError.shortages,
      });
      return res.status(400).json({
        error: 'Bad Request',
        code: 'INSUFFICIENT_RESOURCES',
        message: validationError.error || 'Not enough resources to build this structure',
        shortages: validationError.shortages,
      });
    }

    // Handle all other errors
    logger.error('[API] Failed to build extractor', { error, plotId: req.params.id });
    return res.status(500).json({
      error: 'Internal Server Error',
      code: 'BUILD_FAILED',
      message: 'Failed to build extractor',
    });
  }
});

/**
 * POST /api/plots/:id/harvest
 * Harvest accumulated resources from a plot
 */
router.post('/:id/harvest', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const plot = await db.query.plots.findFirst({
      where: eq(plots.id, id),
      with: {
        settlement: {
          with: {
            storage: true,
          },
        },
      },
    });

    if (!plot) {
      return res.status(404).json({
        error: 'Not Found',
        code: 'PLOT_NOT_FOUND',
        message: 'Plot not found',
      });
    }

    // Verify user owns the settlement
    if (!req.user || plot.settlement?.playerProfileId !== req.user.profileId) {
      return res.status(403).json({
        error: 'Forbidden',
        code: 'NOT_SETTLEMENT_OWNER',
        message: 'You do not own this settlement',
      });
    }

    // Check if plot has production
    if (!plot.resourceType || plot.baseProductionRate === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        code: 'NO_PRODUCTION',
        message: 'Plot is not producing any resources',
      });
    }

    // Calculate total accumulated resources
    let totalAccumulated = plot.accumulatedResources;
    if (plot.lastHarvested) {
      totalAccumulated += calculateAccumulatedResources(
        plot.baseProductionRate,
        plot.lastHarvested
      );
    }

    if (totalAccumulated === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        code: 'NO_RESOURCES',
        message: 'No resources available to harvest',
      });
    }

    // Add to settlement storage
    const storage = plot.settlement?.storage;
    if (!storage) {
      return res.status(500).json({
        error: 'Internal Server Error',
        code: 'NO_STORAGE',
        message: 'Settlement has no storage',
      });
    }

    // Update storage and reset plot accumulation
    await db.transaction(async (tx) => {
      // Update storage based on resource type
      const resourceField = plot.resourceType!.toLowerCase() as 'food' | 'wood' | 'stone' | 'ore';
      await tx
        .update(settlementStorage)
        .set({
          [resourceField]: storage[resourceField] + Math.floor(totalAccumulated),
        })
        .where(eq(settlementStorage.id, storage.id));

      // Reset plot accumulation
      await tx
        .update(plots)
        .set({
          accumulatedResources: 0,
          lastHarvested: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(plots.id, id));
    });

    logger.info('[API] Resources harvested', {
      plotId: id,
      resourceType: plot.resourceType,
      amount: Math.floor(totalAccumulated),
      settlementId: plot.settlementId,
    });

    return res.json({
      success: true,
      resourceType: plot.resourceType,
      amount: Math.floor(totalAccumulated),
      message: `Harvested ${Math.floor(totalAccumulated)} ${plot.resourceType}`,
    });
  } catch (error) {
    logger.error('[API] Failed to harvest resources', { error, plotId: req.params.id });
    return res.status(500).json({
      error: 'Internal Server Error',
      code: 'HARVEST_FAILED',
      message: 'Failed to harvest resources',
    });
  }
});

/**
 * GET /api/plots/by-tile/:tileId
 * Get all plots on a specific tile
 */
router.get('/by-tile/:tileId', authenticate, async (req: Request, res: Response) => {
  try {
    const { tileId } = req.params;

    const plotList = await db.query.plots.findMany({
      where: eq(plots.tileId, tileId),
      with: {
        structure: true,
      },
    });

    return res.json(plotList);
  } catch (error) {
    logger.error('[API] Failed to fetch plots by tile', { error, tileId: req.params.tileId });
    return res.status(500).json({
      error: 'Internal Server Error',
      code: 'FETCH_FAILED',
      message: 'Failed to fetch plots',
    });
  }
});

/**
 * GET /api/plots/by-settlement/:settlementId
 * Get all plots owned by a settlement
 */
router.get('/by-settlement/:settlementId', authenticate, async (req: Request, res: Response) => {
  try {
    const { settlementId } = req.params;

    const plotList = await db.query.plots.findMany({
      where: eq(plots.settlementId, settlementId),
      with: {
        tile: {
          with: {
            biome: true,
          },
        },
        structure: true,
      },
    });

    // Calculate accumulated resources for each plot
    const plotsWithAccumulation = plotList.map((plot) => {
      let accumulated = plot.accumulatedResources;
      if (plot.lastHarvested && plot.baseProductionRate > 0) {
        accumulated += calculateAccumulatedResources(plot.baseProductionRate, plot.lastHarvested);
      }
      return {
        ...plot,
        currentAccumulated: accumulated,
      };
    });

    return res.json(plotsWithAccumulation);
  } catch (error) {
    logger.error('[API] Failed to fetch plots by settlement', {
      error,
      settlementId: req.params.settlementId,
    });
    return res.status(500).json({
      error: 'Internal Server Error',
      code: 'FETCH_FAILED',
      message: 'Failed to fetch plots',
    });
  }
});

export default router;
