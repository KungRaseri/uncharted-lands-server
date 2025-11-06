/**
 * Resource Calculator
 * 
 * Calculates resource production rates and consumption for settlements
 */

import type { Plot } from '../db/schema';

/**
 * Resource types in the game
 */
export interface Resources {
  food: number;
  water: number;
  wood: number;
  stone: number;
  ore: number;
}

/**
 * Production rates per tick (1/60th of a second)
 */
export interface ProductionRates extends Resources {}

/**
 * Calculate base production rates for a settlement based on its plot
 * 
 * @param plot - The plot where the settlement is located
 * @param tickCount - Number of ticks elapsed (for time-based calculation)
 * @returns Production rates per resource type
 */
export function calculateProduction(plot: Plot, tickCount: number = 1): Resources {
  // Base production per tick (60 ticks = 1 second)
  // These values are per-resource-point per tick
  const BASE_RATE_PER_TICK = 0.01; // 0.01 resource per resource point per tick
  
  // Calculate production for the number of ticks elapsed
  const multiplier = BASE_RATE_PER_TICK * tickCount;
  
  return {
    food: plot.food * multiplier,
    water: plot.water * multiplier,
    wood: plot.wood * multiplier,
    stone: plot.stone * multiplier,
    ore: plot.ore * multiplier,
  };
}

/**
 * Calculate time-based production since last collection
 * 
 * @param plot - The plot where the settlement is located
 * @param lastCollectionTime - Timestamp of last collection (in milliseconds)
 * @param currentTime - Current timestamp (in milliseconds)
 * @returns Total resources produced since last collection
 */
export function calculateTimedProduction(
  plot: Plot,
  lastCollectionTime: number,
  currentTime: number = Date.now()
): Resources {
  // Calculate elapsed time in milliseconds
  const elapsedMs = currentTime - lastCollectionTime;
  
  // Convert to ticks (60 ticks per second)
  const ticksElapsed = Math.floor(elapsedMs / (1000 / 60));
  
  // Calculate production for elapsed ticks
  return calculateProduction(plot, ticksElapsed);
}

/**
 * Add resources to storage
 * 
 * @param storage - Current storage amounts
 * @param resources - Resources to add
 * @param maxCapacity - Maximum storage capacity (optional, defaults to no limit)
 * @returns Updated storage amounts
 */
export function addResources(
  storage: Resources,
  resources: Resources,
  maxCapacity?: number
): Resources {
  const updated = {
    food: storage.food + resources.food,
    water: storage.water + resources.water,
    wood: storage.wood + resources.wood,
    stone: storage.stone + resources.stone,
    ore: storage.ore + resources.ore,
  };
  
  // Apply capacity limits if specified
  if (maxCapacity) {
    return {
      food: Math.min(updated.food, maxCapacity),
      water: Math.min(updated.water, maxCapacity),
      wood: Math.min(updated.wood, maxCapacity),
      stone: Math.min(updated.stone, maxCapacity),
      ore: Math.min(updated.ore, maxCapacity),
    };
  }
  
  return updated;
}

/**
 * Subtract resources from storage
 * 
 * @param storage - Current storage amounts
 * @param resources - Resources to subtract
 * @returns Updated storage amounts (won't go below 0)
 */
export function subtractResources(
  storage: Resources,
  resources: Resources
): Resources {
  return {
    food: Math.max(0, storage.food - resources.food),
    water: Math.max(0, storage.water - resources.water),
    wood: Math.max(0, storage.wood - resources.wood),
    stone: Math.max(0, storage.stone - resources.stone),
    ore: Math.max(0, storage.ore - resources.ore),
  };
}

/**
 * Check if storage has enough resources
 * 
 * @param storage - Current storage amounts
 * @param required - Required resource amounts
 * @returns True if storage has enough of all resources
 */
export function hasEnoughResources(
  storage: Resources,
  required: Resources
): boolean {
  return (
    storage.food >= required.food &&
    storage.water >= required.water &&
    storage.wood >= required.wood &&
    storage.stone >= required.stone &&
    storage.ore >= required.ore
  );
}

/**
 * Calculate consumption rates for a settlement
 * (Future: based on population, structures, etc.)
 * 
 * @param populationCount - Number of people in settlement
 * @param structureCount - Number of structures (for maintenance)
 * @returns Consumption rates per tick
 */
export function calculateConsumption(
  populationCount: number = 0,
  structureCount: number = 0
): Resources {
  // Base consumption per person per tick
  const FOOD_PER_PERSON_PER_TICK = 0.005;
  const WATER_PER_PERSON_PER_TICK = 0.01;
  
  // Maintenance cost per structure per tick
  const MAINTENANCE_PER_STRUCTURE_PER_TICK = 0.001;
  
  return {
    food: populationCount * FOOD_PER_PERSON_PER_TICK,
    water: populationCount * WATER_PER_PERSON_PER_TICK,
    wood: structureCount * MAINTENANCE_PER_STRUCTURE_PER_TICK,
    stone: structureCount * MAINTENANCE_PER_STRUCTURE_PER_TICK * 0.5,
    ore: structureCount * MAINTENANCE_PER_STRUCTURE_PER_TICK * 0.25,
  };
}

/**
 * Calculate net production (production - consumption)
 * 
 * @param plot - The plot where the settlement is located
 * @param populationCount - Number of people in settlement
 * @param structureCount - Number of structures
 * @param tickCount - Number of ticks elapsed
 * @returns Net resources (can be negative if consumption exceeds production)
 */
export function calculateNetProduction(
  plot: Plot,
  populationCount: number = 0,
  structureCount: number = 0,
  tickCount: number = 1
): Resources {
  const production = calculateProduction(plot, tickCount);
  const consumption = calculateConsumption(populationCount, structureCount);
  
  return {
    food: production.food - (consumption.food * tickCount),
    water: production.water - (consumption.water * tickCount),
    wood: production.wood - (consumption.wood * tickCount),
    stone: production.stone - (consumption.stone * tickCount),
    ore: production.ore - (consumption.ore * tickCount),
  };
}

/**
 * Format resources for display
 * 
 * @param resources - Resource amounts
 * @returns Formatted string
 */
export function formatResources(resources: Resources): string {
  return `Food: ${Math.floor(resources.food)}, Water: ${Math.floor(resources.water)}, Wood: ${Math.floor(resources.wood)}, Stone: ${Math.floor(resources.stone)}, Ore: ${Math.floor(resources.ore)}`;
}
