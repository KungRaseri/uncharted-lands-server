/**
 * Game Loop System
 *
 * Manages the 60Hz tick system for automatic resource generation
 * and other time-based game mechanics
 *
 * DISASTER SYSTEM INTEGRATION (November 2025 - Phase 4):
 * - Hourly disaster checks at tick % (TICK_RATE * 3600) === 0
 * - Disaster event processing at 10Hz (every 6 ticks)
 */

import type { Server as SocketIOServer } from 'socket.io';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import {
  getPlayerSettlements,
  updateSettlementStorage,
  getSettlementWithDetails,
  getSettlementStructures,
  getSettlementPopulation,
  updateSettlementPopulation,
} from '../db/queries.js';
import { calculateProduction, addResources, subtractResources } from './resource-calculator.js';
import {
  calculatePopulation,
  calculateConsumption,
  hasResourcesForPopulation,
  type Structure,
} from './consumption-calculator.js';
import { getWorldTemplateConfig, type WorldTemplateType } from '../types/world-templates.js';
import {
  calculatePopulationState,
  applyPopulationGrowth,
  calculateImmigrationAmount,
  calculateEmigrationAmount,
  getPopulationSummary,
} from './population-calculator.js';
import {
  calculateStorageCapacity,
  clampToCapacity,
  calculateWaste,
  isNearCapacity,
} from './storage-calculator.js';
import {
  autoAssignPopulation,
  calculateAllStaffingBonuses,
  type StructureWithType,
} from './population-assignment.js';
import { processHourlyDisasterChecks } from './disaster-scheduler.js';
import { processDisasters } from './disaster-processor.js';
import { settlementStructures } from '../db/schema.js';
import { db } from '../db/index.js';

// Game loop configuration
const TICK_RATE = Number.parseInt(process.env.TICK_RATE || '60', 10); // Default: 60 ticks per second
const TICK_INTERVAL_MS = 1000 / TICK_RATE; // ~16.67ms per tick (at 60 ticks/sec)

// Track active game loop
let gameLoopInterval: NodeJS.Timeout | null = null;
let currentTick = 0;
let isRunning = false;
let lastStatusLog = 0;
const STATUS_LOG_INTERVAL = TICK_RATE * 300; // Log status every 5 minutes (300 seconds)

// Track active settlements that need updates
const activeSettlements = new Map<
  string,
  {
    settlementId: string;
    playerId: string;
    worldId: string;
    lastUpdateTick: number;
  }
>();

/**
 * Start the game loop
 */
export function startGameLoop(io: SocketIOServer): void {
  if (isRunning) {
    logger.warn('[GAME LOOP] ⚠️  Attempted to start game loop that is already running');
    return;
  }

  logger.info('[GAME LOOP] 🎮 Starting game loop...', {
    tickRate: `${TICK_RATE} ticks/second`,
    tickInterval: `${TICK_INTERVAL_MS.toFixed(2)}ms`,
  });

  isRunning = true;
  currentTick = 0;

  gameLoopInterval = setInterval(async () => {
    try {
      await processTick(io);
    } catch (error) {
      logger.error('[GAME LOOP] ✗ Error processing tick', error, { tick: currentTick });
    }
  }, TICK_INTERVAL_MS);

  logger.info('[GAME LOOP] ✓ Game loop started successfully');
}

/**
 * Stop the game loop
 */
export function stopGameLoop(): void {
  if (!isRunning) {
    logger.warn('[GAME LOOP] ⚠️  Attempted to stop game loop that is not running');
    return;
  }

  logger.info('[GAME LOOP] 🛑 Stopping game loop...', {
    finalTick: currentTick,
    activeSettlements: activeSettlements.size,
  });

  if (gameLoopInterval) {
    clearInterval(gameLoopInterval);
    gameLoopInterval = null;
  }

  isRunning = false;
  currentTick = 0;
  activeSettlements.clear();

  logger.info('[GAME LOOP] ✓ Game loop stopped successfully');
}

/**
 * Process a single tick
 */
async function processTick(io: SocketIOServer): Promise<void> {
  currentTick++;

  // Log status periodically
  if (currentTick - lastStatusLog >= STATUS_LOG_INTERVAL) {
    logger.info('[GAME LOOP] 📊 Status update', {
      tick: currentTick,
      uptime: `${Math.floor(currentTick / TICK_RATE / 60)}m ${Math.floor((currentTick / TICK_RATE) % 60)}s`,
      activeSettlements: activeSettlements.size,
      connections: io.engine.clientsCount,
    });
    lastStatusLog = currentTick;
  }

  // ===== DISASTER SYSTEM PROCESSING (Phase 4 - November 2025) =====

  // Process disaster events at 10Hz (every 6 ticks)
  // GDD Reference: Section 5.6.4 (Disaster Event Processing)
  if (currentTick % 6 === 0) {
    const currentTime = Date.now();
    await processDisasters(io, currentTime);
  }

  // Check for new disasters hourly (every 3600 seconds)
  // GDD Reference: Section 3.5.4 (Disaster System)
  const HOURLY_TICKS = TICK_RATE * 3600; // 60 ticks/sec × 3600 sec = 216,000 ticks
  if (currentTick % HOURLY_TICKS === 0) {
    const currentTime = Date.now();
    await processHourlyDisasterChecks(currentTime);
  }

  // Update every 60 ticks (once per second)
  // This prevents overwhelming the database with updates
  if (currentTick % TICK_RATE !== 0) {
    return;
  }

  // Process all active settlements
  if (activeSettlements.size === 0) {
    return;
  }

  const settlements = Array.from(activeSettlements.values());

  // Process settlements in batches to avoid overwhelming the database
  const batchSize = 10;
  for (let i = 0; i < settlements.length; i += batchSize) {
    const batch = settlements.slice(i, i + batchSize);
    await Promise.all(batch.map((settlement) => processSettlement(settlement, io)));
  }
}

/**
 * Process resource generation for a single settlement
 */
async function processSettlement(
  settlement: {
    settlementId: string;
    playerId: string;
    worldId: string;
    lastUpdateTick: number;
  },
  io: SocketIOServer
): Promise<void> {
  try {
    // Fetch settlement details
    const settlementData = await getSettlementWithDetails(settlement.settlementId);

    if (!settlementData?.settlement || !settlementData.storage || !settlementData.plot) {
      logger.warn('[GAME LOOP] Settlement data incomplete, removing from active list', {
        settlementId: settlement.settlementId,
      });
      activeSettlements.delete(settlement.settlementId);
      return;
    }

    const { storage, plot, biome, world } = settlementData;
    const worldTemplateType = world?.worldTemplateType || 'STANDARD';

    // Get template config and extract multipliers (Phase 1D)
    const templateConfig = getWorldTemplateConfig(worldTemplateType as WorldTemplateType);
    const consumptionMultiplier = templateConfig.consumptionMultiplier;
    const productionMultiplier = templateConfig.productionMultiplier;

    // Fetch settlement structures for consumption/storage calculations
    const structureData = await getSettlementStructures(settlement.settlementId);

    // Transform structure data into format expected by calculators
    const structures: Structure[] = structureData
      .map((row) => ({
        name: row.structure.name,
        modifiers: structureData
          .filter((r) => r.structure.id === row.structure.id && r.modifiers)
          .map((r) => ({
            name: r.modifiers!.name,
            value: r.modifiers!.value,
          })),
      }))
      .filter(
        (struct, index, self) =>
          // Remove duplicates (each structure appears once per modifier)
          index === self.findIndex((s) => s.name === struct.name)
      );

    // Filter extractors on this specific plot (BLOCKER 2 FIX)
    const extractors = structureData
      .filter(
        (row) => row.structure.plotId === plot.id && row.structureDef?.category === 'EXTRACTOR'
      )
      .map((row) => ({
        ...row.structure,
        category: row.structureDef?.category,
        extractorType: row.structureDef?.extractorType,
        buildingType: row.structureDef?.buildingType,
      }));

    // ============================================
    // PHASE 1D: POPULATION ASSIGNMENT SYSTEM
    // ============================================

    // Get settlement population
    const populationData = await getSettlementPopulation(settlement.settlementId);
    const totalPopulation = populationData?.currentPopulation || 0;

    // Map all settlement structures to StructureWithType format for assignment
    const allStructuresForAssignment: StructureWithType[] = structureData.map((row) => ({
      ...row.structure,
      category: (row.structureDef?.category as 'EXTRACTOR' | 'BUILDING') || 'BUILDING',
    }));

    // Run auto-assignment algorithm
    const assignmentResult = autoAssignPopulation(totalPopulation, allStructuresForAssignment);

    // Update database with new assignments
    for (const [structureId, assigned] of assignmentResult.assignments) {
      await db
        .update(settlementStructures)
        .set({ populationAssigned: assigned })
        .where(eq(settlementStructures.id, structureId));
    }

    // Calculate staffing bonuses for production
    const staffingBonuses = calculateAllStaffingBonuses(allStructuresForAssignment);

    // Log assignment statistics (at debug level to avoid spam)
    if (assignmentResult.totalAssigned > 0 || assignmentResult.understaffedStructures.length > 0) {
      logger.debug('[GAME LOOP] Population assignment', {
        settlementId: settlement.settlementId,
        totalPopulation,
        assigned: assignmentResult.totalAssigned,
        remaining: assignmentResult.remainingPopulation,
        understaffed: assignmentResult.understaffedStructures.length,
        fullyStaffed: assignmentResult.fullyStaffedStructures.length,
      });
    }

    // Calculate ticks since last update
    const ticksSinceUpdate = currentTick - settlement.lastUpdateTick;

    // Calculate base production for those ticks (GDD formula now applied with biome efficiency and world template multiplier)
    const baseProduction = calculateProduction(
      plot,
      extractors,
      ticksSinceUpdate,
      biome?.name,
      productionMultiplier
    );

    // Apply staffing bonuses to extractor production
    // Map extractors to their bonuses and apply them
    const production = { ...baseProduction };
    for (const extractor of extractors) {
      const bonus = staffingBonuses.get(extractor.id) || 1;
      const extractorType = extractor.extractorType;

      // Apply bonus to the appropriate resource
      if (extractorType === 'FARM') {
        production.food *= bonus;
      } else if (extractorType === 'WELL') {
        production.water *= bonus;
      } else if (extractorType === 'LUMBER_MILL') {
        production.wood *= bonus;
      } else if (extractorType === 'QUARRY') {
        production.stone *= bonus;
      } else if (extractorType === 'MINE') {
        production.ore *= bonus;
      }
    }

    // Calculate consumption for those ticks (population + structure maintenance)
    const population = calculatePopulation(structures);
    const structureCount = structures.length;
    const consumption = calculateConsumption(
      population,
      structureCount,
      ticksSinceUpdate,
      consumptionMultiplier
    );

    // Calculate net resource changes (production - consumption)
    const netProduction = subtractResources(production, consumption);

    // Get current resources
    const currentResources = {
      food: storage.food,
      water: storage.water,
      wood: storage.wood,
      stone: storage.stone,
      ore: storage.ore,
    };

    // Add net production to current resources
    const proposedResources = addResources(currentResources, netProduction);

    // Calculate storage capacity
    const capacity = calculateStorageCapacity(structures);

    // Calculate waste (resources exceeding capacity)
    const waste = calculateWaste(currentResources, netProduction, capacity);

    // Clamp resources to capacity
    const finalResources = clampToCapacity(proposedResources, capacity);

    // Update storage in database
    await updateSettlementStorage(storage.id, finalResources);

    // Update last update tick
    settlement.lastUpdateTick = currentTick;

    // Broadcast resource update to world
    io.to(`world:${settlement.worldId}`).emit('resource-update', {
      type: 'auto-production',
      settlementId: settlement.settlementId,
      resources: finalResources,
      production: production,
      consumption: consumption,
      netProduction: netProduction,
      population: population,
      timestamp: Date.now(),
    });

    // Broadcast waste event if any resources were wasted
    if (waste.food > 0 || waste.water > 0 || waste.wood > 0 || waste.stone > 0 || waste.ore > 0) {
      io.to(`world:${settlement.worldId}`).emit('resource-waste', {
        settlementId: settlement.settlementId,
        waste: waste,
        capacity: capacity,
        timestamp: Date.now(),
      });

      logger.debug('[GAME LOOP] Resources wasted due to capacity', {
        settlementId: settlement.settlementId,
        waste,
      });
    }

    // Check storage capacity warnings (>90% full)
    const nearCapacity = isNearCapacity(finalResources, capacity);
    const hasWarnings = Object.values(nearCapacity).some(Boolean);

    if (hasWarnings) {
      io.to(`world:${settlement.worldId}`).emit('storage-warning', {
        settlementId: settlement.settlementId,
        nearCapacity: nearCapacity,
        resources: finalResources,
        capacity: capacity,
        timestamp: Date.now(),
      });
    }

    // Check if settlement has enough resources for population (1 hour buffer)
    const hasResources = hasResourcesForPopulation(population, structureCount, finalResources);

    if (!hasResources && population > 0) {
      io.to(`world:${settlement.worldId}`).emit('resource-shortage', {
        settlementId: settlement.settlementId,
        population: population,
        resources: finalResources,
        timestamp: Date.now(),
      });

      logger.warn('[GAME LOOP] Settlement has insufficient resources', {
        settlementId: settlement.settlementId,
        population,
        resources: finalResources,
      });
    }

    logger.debug('[GAME LOOP] Settlement resources updated', {
      settlementId: settlement.settlementId,
      production,
      consumption,
      netProduction,
      population,
      finalResources,
    });

    // Process population growth every 10 minutes (36,000 ticks at 60Hz)
    if (currentTick % 36000 === 0) {
      await processPopulation(
        settlement.settlementId,
        settlement.worldId,
        structures,
        currentResources,
        io
      );
    }
  } catch (error) {
    logger.error('[GAME LOOP] Error processing settlement:', error, {
      settlementId: settlement.settlementId,
    });
  }
}

/**
 * Process population growth for a single settlement
 */
async function processPopulation(
  settlementId: string,
  worldId: string,
  structures: Structure[],
  resources: { food: number; water: number; wood: number; stone: number; ore: number },
  io: SocketIOServer
): Promise<void> {
  try {
    // Get current population data
    const popData = await getSettlementPopulation(settlementId);

    // Calculate current population state
    const popState = calculatePopulationState(
      popData.currentPopulation,
      structures,
      resources,
      popData.lastGrowthTick.getTime()
    );

    // Apply natural growth
    const timeSinceLastUpdate = Date.now() - popData.lastGrowthTick.getTime();
    const newPopulation = applyPopulationGrowth(
      popData.currentPopulation,
      popState.growthRate,
      timeSinceLastUpdate
    );

    // Check for immigration event (if happy enough)
    let immigrantCount = 0;
    if (Math.random() < popState.immigrationChance && newPopulation < popState.capacity) {
      immigrantCount = calculateImmigrationAmount();

      // Emit settler arrived event
      io.to(`world:${worldId}`).emit('settler-arrived', {
        settlementId,
        population: newPopulation + immigrantCount,
        immigrantCount,
        happiness: Math.floor(popState.happiness),
        timestamp: Date.now(),
      });

      logger.info('[GAME LOOP] Settlers arrived at settlement', {
        settlementId,
        immigrantCount,
        newTotal: newPopulation + immigrantCount,
      });
    }

    // Check for emigration event (if unhappy)
    let emigrantCount = 0;
    if (Math.random() < popState.emigrationChance && newPopulation > 1) {
      emigrantCount = calculateEmigrationAmount(newPopulation);

      // Emit population warning event
      io.to(`world:${worldId}`).emit('population-warning', {
        settlementId,
        population: newPopulation - emigrantCount,
        happiness: Math.floor(popState.happiness),
        warning: 'emigration_risk',
        message: `${emigrantCount} settlers left due to low happiness`,
        timestamp: Date.now(),
      });

      logger.warn('[GAME LOOP] Settlers emigrated from settlement', {
        settlementId,
        emigrantCount,
        newTotal: newPopulation - emigrantCount,
        happiness: popState.happiness,
      });
    }

    // Calculate final population
    const finalPopulation = Math.max(
      1,
      Math.min(popState.capacity, newPopulation + immigrantCount - emigrantCount)
    );

    // Update database only if population changed
    if (finalPopulation !== popData.currentPopulation || popState.happiness !== popData.happiness) {
      await updateSettlementPopulation(settlementId, {
        currentPopulation: finalPopulation,
        happiness: Math.floor(popState.happiness),
        lastGrowthTick: new Date(),
      });

      // Emit population growth event
      if (finalPopulation !== popData.currentPopulation) {
        io.to(`world:${worldId}`).emit('population-growth', {
          settlementId,
          oldPopulation: popData.currentPopulation,
          newPopulation: finalPopulation,
          happiness: Math.floor(popState.happiness),
          growthRate: popState.growthRate,
          timestamp: Date.now(),
        });
      }
    }

    // Emit population state update
    const summary = getPopulationSummary(popState);
    io.to(`world:${worldId}`).emit('population-state', {
      settlementId,
      current: finalPopulation,
      capacity: popState.capacity,
      happiness: summary.happiness,
      happinessDescription: summary.happinessDescription,
      growthRate: popState.growthRate,
      status: summary.status,
      timestamp: Date.now(),
    });

    // Warn if happiness is critically low
    if (popState.happiness < 35 && popState.emigrationChance > 0) {
      io.to(`world:${worldId}`).emit('population-warning', {
        settlementId,
        population: finalPopulation,
        happiness: Math.floor(popState.happiness),
        warning: 'low_happiness',
        message: 'Settlement happiness is critically low! Settlers may leave.',
        timestamp: Date.now(),
      });
    }

    logger.debug('[GAME LOOP] Population processed', {
      settlementId,
      oldPop: popData.currentPopulation,
      newPop: finalPopulation,
      happiness: popState.happiness,
      growthRate: popState.growthRate,
    });
  } catch (error) {
    logger.error('[GAME LOOP] Error processing population:', error, {
      settlementId,
    });
  }
}

/**
 * Register a settlement for automatic updates
 */
export function registerSettlement(settlementId: string, playerId: string, worldId: string): void {
  if (activeSettlements.has(settlementId)) {
    logger.debug('[GAME LOOP] Settlement already registered', { settlementId });
    return;
  }

  activeSettlements.set(settlementId, {
    settlementId,
    playerId,
    worldId,
    lastUpdateTick: currentTick,
  });

  logger.debug('[GAME LOOP] Settlement registered for auto-updates', {
    settlementId,
    playerId,
    worldId,
    activeSettlementCount: activeSettlements.size,
  });
}

/**
 * Unregister a settlement from automatic updates
 */
export function unregisterSettlement(settlementId: string): void {
  const removed = activeSettlements.delete(settlementId);

  if (removed) {
    logger.debug('[GAME LOOP] Settlement unregistered from auto-updates', {
      settlementId,
      activeSettlementCount: activeSettlements.size,
    });
  }
}

/**
 * Get game loop status
 */
export function getGameLoopStatus(): {
  isRunning: boolean;
  currentTick: number;
  activeSettlements: number;
  tickRate: number;
} {
  return {
    isRunning,
    currentTick,
    activeSettlements: activeSettlements.size,
    tickRate: TICK_RATE,
  };
}

/**
 * Register all player settlements when they join a world
 */
export async function registerPlayerSettlements(playerId: string, worldId: string): Promise<void> {
  try {
    const settlements = await getPlayerSettlements(playerId);

    for (const settlement of settlements) {
      registerSettlement(settlement.id, playerId, worldId);
    }

    logger.info('[GAME LOOP] Registered all player settlements', {
      playerId,
      worldId,
      settlementCount: settlements.length,
    });
  } catch (error) {
    logger.error('[GAME LOOP] Error registering player settlements:', error, {
      playerId,
      worldId,
    });
  }
}

/**
 * Unregister all player settlements when they leave a world
 */
export async function unregisterPlayerSettlements(playerId: string): Promise<void> {
  try {
    // Find and remove all settlements belonging to this player
    const toRemove: string[] = [];

    for (const [settlementId, settlement] of activeSettlements.entries()) {
      if (settlement.playerId === playerId) {
        toRemove.push(settlementId);
      }
    }

    for (const settlementId of toRemove) {
      unregisterSettlement(settlementId);
    }

    logger.info('[GAME LOOP] Unregistered all player settlements', {
      playerId,
      settlementCount: toRemove.length,
    });
  } catch (error) {
    logger.error('[GAME LOOP] Error unregistering player settlements:', error, {
      playerId,
    });
  }
}
