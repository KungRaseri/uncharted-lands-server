/**
 * Structure Modifiers Configuration
 *
 * Defines production bonuses and other modifiers for each structure type.
 * These are custom game mechanics not specified in the GDD.
 *
 * @see GDD Section 4.4 - Building & Construction System (for structure types)
 * @note This data was extracted from the old hardcoded structureTypes object
 *       in events/handlers.ts (lines 318-378)
 */

export interface StructureModifier {
  name: string;
  description: string;
  value: number;
}

/**
 * Map of structure names (uppercase) to their modifiers
 */
export const STRUCTURE_MODIFIERS: Record<string, StructureModifier[]> = {
  // Housing - Population capacity
  TENT: [
    {
      name: 'population_capacity',
      description: 'Increases settlement population capacity',
      value: 2,
    },
  ],
  HOUSE: [
    {
      name: 'population_capacity',
      description: 'Increases settlement population capacity',
      value: 5,
    },
  ],

  // Resource Production - Extractors
  FARM: [
    {
      name: 'food_production',
      description: 'Increases food production',
      value: 10,
    },
  ],
  WELL: [
    {
      name: 'water_production',
      description: 'Increases water production',
      value: 15,
    },
  ],
  LUMBER_MILL: [
    {
      name: 'wood_production',
      description: 'Increases wood production',
      value: 8,
    },
  ],
  QUARRY: [
    {
      name: 'stone_production',
      description: 'Increases stone production',
      value: 6,
    },
  ],
  MINE: [
    {
      name: 'ore_production',
      description: 'Increases ore production',
      value: 4,
    },
  ],

  // Storage
  WAREHOUSE: [
    {
      name: 'storage_capacity',
      description: 'Increases resource storage capacity',
      value: 500,
    },
  ],

  // Advanced Production
  WORKSHOP: [
    {
      name: 'construction_speed',
      description: 'Increases construction speed',
      value: 10, // 10% faster
    },
  ],

  // Trade & Commerce
  MARKETPLACE: [
    {
      name: 'trade_efficiency',
      description: 'Improves trade rates',
      value: 10, // 10% better rates
    },
  ],

  // Research & Technology
  RESEARCH_LAB: [
    {
      name: 'research_speed',
      description: 'Increases research speed',
      value: 100, // Base research speed
    },
  ],
  LIBRARY: [
    {
      name: 'research_speed',
      description: 'Bonus research speed',
      value: 20, // +20% research speed
    },
  ],

  // Population Services
  HOSPITAL: [
    {
      name: 'casualty_reduction',
      description: 'Reduces disaster casualties',
      value: 50, // 50% casualty reduction
    },
  ],

  // Disaster Defense
  EMERGENCY_SHELTER: [
    {
      name: 'shelter_capacity',
      description: 'Population that can be protected during disasters',
      value: 50,
    },
  ],
  WATCHTOWER: [
    {
      name: 'disaster_warning_time',
      description: 'Advance warning time in seconds',
      value: 3600, // 1 hour
    },
  ],
  SEISMOLOGY_STATION: [
    {
      name: 'earthquake_warning_time',
      description: 'Earthquake warning time in seconds',
      value: 3600, // 1 hour
    },
  ],
  METEOROLOGY_CENTER: [
    {
      name: 'weather_warning_time',
      description: 'Weather disaster warning time in seconds',
      value: 7200, // 2 hours
    },
  ],

  // Guild Structures
  GUILD_HEADQUARTERS: [
    {
      name: 'guild_storage_capacity',
      description: 'Shared guild storage capacity',
      value: 50000,
    },
  ],
  GUILD_WORKSHOP: [
    {
      name: 'guild_project_speed',
      description: 'Guild cooperative project speed bonus',
      value: 20, // 20% faster
    },
  ],

  // Specialization Structures
  ADVANCED_GREENHOUSE: [
    {
      name: 'food_production',
      description: 'Food production bonus',
      value: 50, // 50% bonus
    },
    {
      name: 'herb_production',
      description: 'Herb production bonus',
      value: 40, // 40% bonus
    },
  ],
  DEEP_MINING_COMPLEX: [
    {
      name: 'ore_production',
      description: 'Ore production bonus',
      value: 60, // 60% bonus
    },
    {
      name: 'stone_production',
      description: 'Stone production bonus',
      value: 40, // 40% bonus
    },
  ],
  FORTRESS: [
    {
      name: 'disaster_resistance',
      description: 'All disaster resistance',
      value: 30, // 30% resistance
    },
  ],
  GRAND_MARKET: [
    {
      name: 'trade_discount',
      description: 'Trade discount percentage',
      value: 25, // 25% discount
    },
  ],
  ADVANCED_ACADEMY: [
    {
      name: 'research_speed',
      description: 'Research speed bonus',
      value: 50, // 50% bonus
    },
  ],
};

/**
 * Get modifiers for a structure by name
 * @param structureName - The structure name (case-insensitive)
 * @returns The structure modifiers array or undefined if none defined
 */
export function getStructureModifiers(structureName: string): StructureModifier[] | undefined {
  const upperName = structureName.toUpperCase();
  return STRUCTURE_MODIFIERS[upperName];
}

/**
 * Check if a structure has defined modifiers
 * @param structureName - The structure name (case-insensitive)
 * @returns True if structure has modifiers defined
 */
export function hasStructureModifiers(structureName: string): boolean {
  const upperName = structureName.toUpperCase();
  return upperName in STRUCTURE_MODIFIERS;
}
