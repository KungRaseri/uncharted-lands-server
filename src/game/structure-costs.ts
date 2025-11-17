/**
 * Structure Costs and Requirements
 * Centralized definition of all structure building costs from GDD Section 4.7
 *
 * Cost format: { wood, stone, ore, time (seconds), population (required) }
 */

export interface StructureCost {
  wood: number;
  stone: number;
  ore: number;
  time: number; // seconds (not yet implemented, for future construction queue)
  population: number; // required population to staff (not yet implemented)
}

/**
 * Tier 1: Basic Structures (Early Game - 0-10 minutes)
 * Essential starting structures for resource production and storage
 */
export const TIER1_COSTS: Record<string, StructureCost> = {
  TENT: { wood: 10, stone: 0, ore: 0, time: 0, population: 0 },
  FARM: { wood: 20, stone: 10, ore: 0, time: 180, population: 2 },
  LUMBER_MILL: { wood: 20, stone: 10, ore: 0, time: 180, population: 2 },
  QUARRY: { wood: 20, stone: 10, ore: 0, time: 180, population: 3 },
  MINE: { wood: 30, stone: 20, ore: 0, time: 240, population: 3 },
  FISHING_DOCK: { wood: 20, stone: 10, ore: 0, time: 180, population: 2 }, // Same as FARM
  WAREHOUSE: { wood: 40, stone: 20, ore: 0, time: 300, population: 0 },
};

/**
 * Tier 2: Intermediate Structures (Mid Game - 10-30 minutes)
 * Advanced infrastructure for settlement development
 */
export const TIER2_COSTS: Record<string, StructureCost> = {
  HOUSE: { wood: 50, stone: 20, ore: 0, time: 600, population: 0 },
  WORKSHOP: { wood: 60, stone: 60, ore: 30, time: 900, population: 2 },
  MARKETPLACE: { wood: 120, stone: 80, ore: 0, time: 1800, population: 0 },
};

/**
 * Tier 3: Advanced Structures (Late Game - 1-4 hours)
 * High-level structures requiring significant investment
 */
export const TIER3_COSTS: Record<string, StructureCost> = {
  TOWN_HALL: { wood: 200, stone: 150, ore: 50, time: 3600, population: 0 },
  RESEARCH_LAB: { wood: 500, stone: 400, ore: 200, time: 5400, population: 5 },
  HOSPITAL: { wood: 500, stone: 300, ore: 100, time: 7200, population: 3 },
};

/**
 * Tier 4: Disaster Defense Structures (2-8 hours)
 * Planned disaster response structures (not yet implemented)
 */
export const TIER4_COSTS: Record<string, StructureCost> = {
  EMERGENCY_SHELTER: { wood: 300, stone: 200, ore: 0, time: 7200, population: 0 },
  WATCHTOWER: { wood: 200, stone: 150, ore: 0, time: 10800, population: 2 },
  SEISMOLOGY_STATION: { wood: 600, stone: 500, ore: 300, time: 21600, population: 3 },
};

/**
 * Complete structure costs lookup (all tiers combined)
 */
export const STRUCTURE_COSTS: Record<string, StructureCost> = {
  ...TIER1_COSTS,
  ...TIER2_COSTS,
  ...TIER3_COSTS,
  ...TIER4_COSTS,
};

/**
 * Get the cost for a specific structure type
 * @param structureType - The type of structure (e.g., 'FARM', 'HOUSE')
 * @returns The structure cost, or null if structure type not found
 */
export function getStructureCost(structureType: string): StructureCost | null {
  return STRUCTURE_COSTS[structureType] || null;
}

/**
 * Calculate upgrade cost for a structure
 * From GDD: "Cost scales exponentially (Level N cost = Base × 1.5^N)"
 *
 * @param baseStructureType - The base structure type
 * @param targetLevel - The level to upgrade to (2, 3, 4, etc.)
 * @returns The upgrade cost, or null if structure type not found
 */
export function getUpgradeCost(
  baseStructureType: string,
  targetLevel: number
): StructureCost | null {
  const baseCost = getStructureCost(baseStructureType);
  if (!baseCost) return null;

  const multiplier = Math.pow(1.5, targetLevel - 1);

  return {
    wood: Math.ceil(baseCost.wood * multiplier),
    stone: Math.ceil(baseCost.stone * multiplier),
    ore: Math.ceil(baseCost.ore * multiplier),
    time: Math.ceil(baseCost.time * 0.5), // Upgrade time = 50% of original
    population: baseCost.population, // Population requirement doesn't scale
  };
}
