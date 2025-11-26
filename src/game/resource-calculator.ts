/**
 * Resource Calculator
 *
 * Calculates resource production const EXTRACTOR_TIER_MAP: Record<string, number> = {
  // Tier 1 Extractors (5x base)
  FARM: 5,
  WELL: 5,
  LUMBER_MILL: 5,
  QUARRY: 5,
  MINE: 5,
  // Tier 2 Extractors (8x base) - planned
  FISHING_DOCK: 8,
  HUNTERS_LODGE: 8,
  HERB_GARDEN: 8,
  // Tier 3 Extractors (12x base) - planned
  DEEP_MINE: 12,
  ADVANCED_FARM: 12,
};

/**
 * Calculate base (passive) resource production from a plot
 * This production happens even WITHOUT extractors (20% of max potential)
 *
 * Per GDD Section 3.1: "Base production = tileQuality × biomeEfficiency × 0.2"
 *
 * @param plot - Plot with quality and resource data
 * @param biomeEfficiency - Biome efficiency for specific resource (0.5-2.0)
 * @returns Base production rate (20% of max potential)
 *
 * @example
 * // Plot with quality=50, grassland food efficiency 1.2
 * calculateBaseProduction(plot, 1.2)
 * // Returns: 50 × 1.2 × 0.2 = 12 units/tick
 *
 * @example
 * // Plot with quality=80, forest wood efficiency 2.0
 * calculateBaseProduction(plot, 2.0)
 * // Returns: 80 × 2.0 × 0.2 = 32 units/tick
 */
function calculateBaseProduction(plot: Plot, biomeEfficiency: number): number {
  const quality = plot.qualityMultiplier || 1;
  return quality * biomeEfficiency * 0.2;
}

/**
 * Get extractor tier multiplier based on structure level
 *
 * Per GDD Section 3.4: Tier-based multipliers for extractors
 * - Tier 1 (Levels 1-3):  5x multiplier  (Basic extractors - FARM, MINE, etc.)
 * - Tier 2 (Levels 4-6):  10x multiplier (Advanced extractors)
 * - Tier 3 (Levels 7-10): 16x multiplier (Elite extractors)
 *
 * This replaces the old linear levelMultiplier = 1 + (level-1) × 0.2
 *
 * @param level - Extractor structure level (1-10)
 * @returns Tier multiplier (5, 10, or 16)
 *
 * @example
 * getExtractorTierMultiplier(1)  // Returns: 5  (Tier 1)
 * getExtractorTierMultiplier(3)  // Returns: 5  (Tier 1)
 * getExtractorTierMultiplier(4)  // Returns: 10 (Tier 2)
 * getExtractorTierMultiplier(6)  // Returns: 10 (Tier 2)
 * getExtractorTierMultiplier(9)  // Returns: 16 (Tier 3)
 * getExtractorTierMultiplier(10) // Returns: 16 (Tier 3)
 */
function getExtractorTierMultiplier(level: number): number {
  if (level <= 3) return 5; // Tier 1: Basic
  if (level <= 6) return 10; // Tier 2: Advanced
  return 16; // Tier 3: Elite
}

/**
 * DEPRECATED: Old getExtractorMultiplier function with tier systemion for settlements
 */

import type { Plot, SettlementStructure } from '../db/schema.js';
import { getBiomeEfficiency } from '../config/biome-config.js';
import { getEffectiveness } from './structure-effectiveness.js';

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
 * Extended structure info with category and type information
 * (Requires joining settlementStructures with structures table)
 */
export interface StructureWithInfo extends SettlementStructure {
  category?: 'EXTRACTOR' | 'BUILDING' | null;
  extractorType?: string | null;
  buildingType?: string | null;
}

/**
 * Extractor type to resource mapping
 */
const EXTRACTOR_RESOURCE_MAP: Record<string, keyof Resources> = {
  FARM: 'food',
  WELL: 'water',
  LUMBER_MILL: 'wood',
  QUARRY: 'stone',
  MINE: 'ore',
  FISHING_DOCK: 'food', // Alternative food source
  HUNTERS_LODGE: 'food', // Alternative food source
  HERB_GARDEN: 'food', // Special resource (treated as food for now)
  // Tier 3 Extractors
  DEEP_MINE: 'ore', // Advanced ore extraction
  ADVANCED_FARM: 'food', // Advanced food production
};

/**
 * Extractor tier definitions (determines base multiplier)
 *
 * ISSUE #2 Spec:
 * - Tier 1: 5x base multiplier (FARM, LUMBER_MILL, QUARRY, MINE, WELL)
 * - Tier 2: 8x base multiplier (FISHING_DOCK, HUNTERS_LODGE, HERB_GARDEN - planned)
 * - Tier 3: 12x base multiplier (DEEP_MINE, ADVANCED_FARM - planned)
 *
 * Formula: Multiplier = TierBase + (level - 1) × 1
 * Example: Tier 1 Level 5 = 5 + (5 - 1) × 1 = 9x
 */
const EXTRACTOR_TIER_MAP: Record<string, number> = {
  // Tier 1 Extractors (5x base)
  FARM: 5,
  WELL: 5,
  LUMBER_MILL: 5,
  QUARRY: 5,
  MINE: 5,
  // Tier 2 Extractors (8x base) - planned
  FISHING_DOCK: 8,
  HUNTERS_LODGE: 8,
  HERB_GARDEN: 8,
  // Tier 3 Extractors (12x base) - planned
  DEEP_MINE: 12,
  ADVANCED_FARM: 12,
};

/**
 * DEPRECATED: Get extractor multiplier based on type and level
 *
 * This function is no longer used after BLOCKER 2 fix.
 * Keeping for reference in case tier system is re-introduced.
 *
 * ISSUE #2: Extractor multipliers are variable by tier and level
 * Formula: TierBase + (level - 1) × 1
 *
 * @param extractorType - Type of extractor (e.g., 'FARM', 'LUMBER_MILL')
 * @param level - Structure level (1-5 typically)
 * @returns Multiplier to apply to base production
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getExtractorMultiplier(extractorType: string, level: number): number {
  const tierBase = EXTRACTOR_TIER_MAP[extractorType] || 5; // Default to Tier 1 if unknown
  const levelBonus = (level - 1) * 1; // +1 per level above 1
  return tierBase + levelBonus;
}

/**
 * Calculate base production rates for a settlement based on its plot and extractors
 *
 * BLOCKER 2 FIX: Hybrid Production System (GDD Section 3.1)
 *
 * Formula:
 * - Base Production = Quality × BiomeEfficiency × 0.20 (ALWAYS active, even without extractors)
 * - Tier Multiplier = 5x (L1-3), 10x (L4-6), or 16x (L7-10) if extractor exists, else 1x
 * - Health Modifier = StructureHealth / 100 (disaster damage impact)
 * - Final Production = BaseProduction × TierMultiplier × HealthModifier × Ticks × WorldTemplate
 *
 * Example (Plot with quality=50, biome efficiency=1.2 for food):
 * - No Extractor: 50 × 1.2 × 0.2 × 1 × 1.0 × 1 × 1 = 12 food/tick
 * - Tier 1 Farm (L2): 50 × 1.2 × 0.2 × 5 × 1.0 × 1 × 1 = 60 food/tick
 * - Tier 2 Farm (L5, 70% health): 50 × 1.2 × 0.2 × 10 × 0.7 × 1 × 1 = 84 food/tick
 * - Tier 3 Farm (L9): 50 × 1.2 × 0.2 × 16 × 1.0 × 1 × 1 = 192 food/tick
 *
 * @param plot - The plot where the settlement is located
 * @param extractors - Extractor structures on this plot (must include category and extractorType)
 * @param tickCount - Number of ticks elapsed (for time-based calculation)
 * @param biomeName - Name of the biome (for efficiency multiplier)
 * @param worldTemplateMultiplier - World template production multiplier (Phase 1D)
 * @returns Production rates per resource type
 */
export function calculateProduction(
  plot: Plot,
  extractors: StructureWithInfo[],
  tickCount: number = 1,
  biomeName?: string | null,
  worldTemplateMultiplier: number = 1
): Resources {
  // Get biome efficiency multipliers for all resources
  const biomeEfficiency = getBiomeEfficiency(biomeName);

  // Initialize production object
  const production: Resources = {
    food: 0,
    water: 0,
    wood: 0,
    stone: 0,
    ore: 0,
  };

  // BLOCKER 2 FIX: Process EACH resource type independently
  // Base production (20%) happens even WITHOUT extractors
  const resourceTypes: (keyof Resources)[] = ['food', 'water', 'wood', 'stone', 'ore'];

  for (const resourceType of resourceTypes) {
    // Step 1: Calculate base production (20% of max potential - ALWAYS active)
    const baseProduction = calculateBaseProduction(plot, biomeEfficiency[resourceType]);

    // Step 2: Find extractor for this specific resource (if any)
    // If multiple extractors of same type, use HIGHEST level only
    const extractor = extractors
      ?.filter(
        (e) =>
          e.category === 'EXTRACTOR' &&
          e.extractorType &&
          EXTRACTOR_RESOURCE_MAP[e.extractorType] === resourceType
      )
      .reduce(
        (highest, current) => {
          return !highest || (current.level || 1) > (highest.level || 1) ? current : highest;
        },
        undefined as StructureWithInfo | undefined
      );

    // Step 3: Determine tier multiplier
    let tierMultiplier = 1; // Default: No extractor = 1x (base production only)
    let healthModifier = 1; // Default: No structure = 100% health

    if (extractor) {
      // Apply tier-based multiplier (5x/10x/16x based on level)
      tierMultiplier = getExtractorTierMultiplier(extractor.level || 1);

      // Apply structure health modifier (disaster damage impact)
      healthModifier = getEffectiveness(extractor.health);
    }

    // Step 4: Calculate final production for this resource
    // Formula: BaseProduction × TierMultiplier × HealthModifier × Ticks × WorldTemplate
    production[resourceType] =
      baseProduction * tierMultiplier * healthModifier * tickCount * worldTemplateMultiplier;
  }

  return production;
}

/**
 * Calculate time-based production since last collection
 *
 * @param plot - The plot where the settlement is located
 * @param extractors - Extractor structures on this plot (must include category and extractorType)
 * @param lastCollectionTime - Timestamp of last collection (in milliseconds)
 * @param currentTime - Current timestamp (in milliseconds)
 * @param biomeName - Name of the biome (for efficiency multiplier)
 * @param worldTemplateMultiplier - World template production multiplier (Phase 1D)
 * @returns Total resources produced since last collection
 */
export function calculateTimedProduction(
  plot: Plot,
  extractors: StructureWithInfo[],
  lastCollectionTime: number,
  currentTime: number = Date.now(),
  biomeName?: string | null,
  worldTemplateMultiplier: number = 1
): Resources {
  // Calculate elapsed time in milliseconds
  const elapsedMs = currentTime - lastCollectionTime;

  // Convert to ticks (60 ticks per second)
  const ticksElapsed = Math.floor(elapsedMs / (1000 / 60));

  // Calculate production for elapsed ticks
  return calculateProduction(plot, extractors, ticksElapsed, biomeName, worldTemplateMultiplier);
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
export function subtractResources(storage: Resources, resources: Resources): Resources {
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
export function hasEnoughResources(storage: Resources, required: Resources): boolean {
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
 * @param extractors - Extractor structures on this plot (must include category and extractorType)
 * @param populationCount - Number of people in settlement
 * @param structureCount - Number of structures
 * @param tickCount - Number of ticks elapsed
 * @param biomeName - Name of the biome (for efficiency multiplier)
 * @returns Net resources (can be negative if consumption exceeds production)
 */
export function calculateNetProduction(
  plot: Plot,
  extractors: StructureWithInfo[],
  populationCount: number = 0,
  structureCount: number = 0,
  tickCount: number = 1,
  biomeName?: string | null
): Resources {
  const production = calculateProduction(plot, extractors, tickCount, biomeName);
  const consumption = calculateConsumption(populationCount, structureCount);

  return {
    food: production.food - consumption.food * tickCount,
    water: production.water - consumption.water * tickCount,
    wood: production.wood - consumption.wood * tickCount,
    stone: production.stone - consumption.stone * tickCount,
    ore: production.ore - consumption.ore * tickCount,
  };
}

// ===========================
// HELPER FUNCTIONS
// ===========================

/**
 * Check if a structure is an extractor
 *
 * @param structure - Structure to check (with category and extractorType fields)
 * @returns True if the structure is an extractor
 */
export function isExtractor(structure: StructureWithInfo): boolean {
  return structure.category === 'EXTRACTOR' && !!structure.extractorType;
}

/**
 * Get the average level of extractors
 *
 * Useful for calculating overall production efficiency
 *
 * @param extractors - Array of extractor structures
 * @returns Average level, or 0 if no extractors
 */
export function getAverageLevel(extractors: StructureWithInfo[]): number {
  if (extractors.length === 0) return 0;

  const totalLevel = extractors.reduce((sum, extractor) => sum + extractor.level, 0);
  return totalLevel / extractors.length;
}

/**
 * Get the maximum level among extractors
 *
 * Useful for determining the highest tier of production available
 *
 * @param extractors - Array of extractor structures
 * @returns Maximum level, or 0 if no extractors
 */
export function getMaxLevel(extractors: StructureWithInfo[]): number {
  if (extractors.length === 0) return 0;

  return Math.max(...extractors.map((extractor) => extractor.level));
}

/**
 * Get extractors for a specific resource type
 *
 * @param extractors - Array of extractor structures
 * @param resourceType - Type of resource to filter by
 * @returns Array of extractors that produce the specified resource
 */
export function getExtractorsByResource(
  extractors: StructureWithInfo[],
  resourceType: keyof Resources
): StructureWithInfo[] {
  return extractors.filter((extractor) => {
    if (!extractor.extractorType) return false;
    return EXTRACTOR_RESOURCE_MAP[extractor.extractorType] === resourceType;
  });
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
