/**
 * Consumption Calculator
 *
 * Calculates resource consumption for settlements including:
 * - Population food/water consumption
 * - Structure maintenance costs (future)
 * - Resource decay/spoilage (future)
 */

import type { Resources } from './resource-calculator.js';

/**
 * Per-capita consumption rates per tick (60 ticks per second)
 * Based on GDD specifications (Section 4.6.2)
 *
 * Food:  0.005 units per person per tick  = 1,080 units/hour = 25,920 units/day
 * Water: 0.010 units per person per tick  = 2,160 units/hour = 51,840 units/day
 *
 * Note: These rates create significant resource pressure, requiring active management.
 * A settlement of 10 population consumes 10,800 food and 21,600 water per hour.
 */
export const CONSUMPTION_RATES = {
  /** Food consumed per person per tick (GDD spec: 0.005) */
  FOOD_PER_CAPITA_PER_TICK: 0.005,

  /** Water consumed per person per tick (GDD spec: 0.01) */
  WATER_PER_CAPITA_PER_TICK: 0.01,

  /** Base population capacity without structures */
  BASE_POPULATION_CAPACITY: 10,

  /** Structure maintenance rates per tick */
  WOOD_MAINTENANCE_PER_STRUCTURE_PER_TICK: 0.001, // 3.6 wood/hour per structure
  STONE_MAINTENANCE_PER_STRUCTURE_PER_TICK: 0.0005, // 1.8 stone/hour per structure
  ORE_MAINTENANCE_PER_STRUCTURE_PER_TICK: 0.00025, // 0.9 ore/hour per structure
};

/**
 * Structure modifiers that affect population
 */
export interface StructureModifier {
  name: string;
  value: number;
}

/**
 * Structure with modifiers
 */
export interface Structure {
  name: string;
  modifiers: StructureModifier[];
}

/**
 * Calculate population capacity from settlement structures
 * Based on "Population Capacity" modifiers plus base capacity
 *
 * @param structures Array of settlement structures with modifiers
 * @returns Total population capacity
 */
export function calculatePopulationCapacity(structures: Structure[]): number {
  let capacity = CONSUMPTION_RATES.BASE_POPULATION_CAPACITY;

  for (const structure of structures) {
    for (const modifier of structure.modifiers) {
      if (modifier.name === 'Population Capacity') {
        capacity += modifier.value;
      }
    }
  }

  return Math.max(0, Math.floor(capacity));
}

/**
 * Calculate actual population (for now, same as capacity)
 *
 * Future: Track actual population with growth/decline mechanics
 * - Population grows when food/water abundant
 * - Population declines when resources scarce
 * - Population capped by capacity
 *
 * @param structures Array of settlement structures
 * @param _currentPopulation Current population (optional, for future use)
 * @returns Current population count
 */
export function calculatePopulation(structures: Structure[], _currentPopulation?: number): number {
  const capacity = calculatePopulationCapacity(structures);

  // For now, assume settlements are at max capacity
  // Future: Return Math.min(currentPopulation ?? capacity, capacity)
  return capacity;
}

/**
 * Calculate resource consumption per tick for a settlement
 *
 * Formula: baseConsumption × worldTemplateMultiplier
 *
 * @param population Current population count
 * @param structureCount Total number of structures in settlement
 * @param tickCount Number of ticks to calculate for (default: 1)
 * @param worldTemplateMultiplier Consumption modifier from world template (default: 1, Phase 1D)
 * @returns Resource consumption amounts
 */
export function calculateConsumption(
  population: number,
  structureCount: number = 0,
  tickCount: number = 1,
  worldTemplateMultiplier: number = 1
): Resources {
  // Calculate base consumption rates
  const baseFoodConsumption = population * CONSUMPTION_RATES.FOOD_PER_CAPITA_PER_TICK * tickCount;
  const baseWaterConsumption = population * CONSUMPTION_RATES.WATER_PER_CAPITA_PER_TICK * tickCount;

  // Structure maintenance costs (GDD Section 4.6.2)
  const baseWoodMaintenance =
    structureCount * CONSUMPTION_RATES.WOOD_MAINTENANCE_PER_STRUCTURE_PER_TICK * tickCount;
  const baseStoneMaintenance =
    structureCount * CONSUMPTION_RATES.STONE_MAINTENANCE_PER_STRUCTURE_PER_TICK * tickCount;
  const baseOreMaintenance =
    structureCount * CONSUMPTION_RATES.ORE_MAINTENANCE_PER_STRUCTURE_PER_TICK * tickCount;

  // Apply world template multiplier (Phase 1D)
  return {
    food: baseFoodConsumption * worldTemplateMultiplier,
    water: baseWaterConsumption * worldTemplateMultiplier,
    wood: baseWoodMaintenance * worldTemplateMultiplier,
    stone: baseStoneMaintenance * worldTemplateMultiplier,
    ore: baseOreMaintenance * worldTemplateMultiplier,
  };
}

/**
 * Calculate morale from structures
 * Based on "Morale Boost" modifiers
 *
 * @param structures Array of settlement structures
 * @returns Morale value (0-100)
 */
export function calculateMorale(structures: Structure[]): number {
  let morale = 50; // Base morale

  for (const structure of structures) {
    for (const modifier of structure.modifiers) {
      if (modifier.name === 'Morale Boost') {
        morale += modifier.value;
      }
    }
  }

  // Clamp to 0-100 range
  return Math.max(0, Math.min(100, morale));
}

/**
 * Calculate consumption summary for display
 *
 * @param structures Array of settlement structures
 * @param currentPopulation Current population (optional)
 * @returns Consumption summary with rates and totals
 */
export function getConsumptionSummary(structures: Structure[], currentPopulation?: number) {
  const population = calculatePopulation(structures, currentPopulation);
  const capacity = calculatePopulationCapacity(structures);
  const structureCount = structures.length;
  const consumption = calculateConsumption(population, structureCount, 60); // Per second
  const morale = calculateMorale(structures);

  return {
    population,
    capacity,
    structureCount,
    consumption,
    morale,
    perCapitaPerSecond: {
      food: CONSUMPTION_RATES.FOOD_PER_CAPITA_PER_TICK * 60,
      water: CONSUMPTION_RATES.WATER_PER_CAPITA_PER_TICK * 60,
    },
    perCapitaPerHour: {
      food: CONSUMPTION_RATES.FOOD_PER_CAPITA_PER_TICK * 60 * 60 * 60,
      water: CONSUMPTION_RATES.WATER_PER_CAPITA_PER_TICK * 60 * 60 * 60,
    },
    perStructurePerHour: {
      wood: CONSUMPTION_RATES.WOOD_MAINTENANCE_PER_STRUCTURE_PER_TICK * 60 * 60 * 60,
      stone: CONSUMPTION_RATES.STONE_MAINTENANCE_PER_STRUCTURE_PER_TICK * 60 * 60 * 60,
      ore: CONSUMPTION_RATES.ORE_MAINTENANCE_PER_STRUCTURE_PER_TICK * 60 * 60 * 60,
    },
  };
}

/**
 * Check if settlement has sufficient resources for population
 * Returns true if resources can sustain population for at least 1 hour
 *
 * @param population Current population
 * @param structureCount Total number of structures
 * @param resources Current resource amounts
 * @returns Whether resources are sufficient
 */
export function hasResourcesForPopulation(
  population: number,
  structureCount: number,
  resources: Resources
): boolean {
  // Calculate consumption for 1 hour (60 * 60 * 60 ticks)
  const hourlyConsumption = calculateConsumption(population, structureCount, 60 * 60 * 60);

  return (
    resources.food >= hourlyConsumption.food &&
    resources.water >= hourlyConsumption.water &&
    resources.wood >= hourlyConsumption.wood &&
    resources.stone >= hourlyConsumption.stone &&
    resources.ore >= hourlyConsumption.ore
  );
}
