/**
 * Structure Requirements Configuration
 *
 * Defines area, solar, and wind requirements for each structure type.
 * These are custom game mechanics not specified in the GDD.
 *
 * @see GDD Section 4.4 - Building & Construction System (for structure types)
 * @note This data was extracted from the old hardcoded structureTypes object
 *       in events/handlers.ts (lines 318-378)
 */

export interface StructureRequirements {
  area: number;
  solar: number;
  wind: number;
}

/**
 * Map of structure names (uppercase) to their requirements
 */
export const STRUCTURE_REQUIREMENTS: Record<string, StructureRequirements> = {
  // Tier 1: Basic Structures
  TENT: {
    area: 1,
    solar: 0,
    wind: 0,
  },
  HOUSE: {
    area: 1,
    solar: 0,
    wind: 0,
  },
  FARM: {
    area: 2,
    solar: 1,
    wind: 0,
  },
  WELL: {
    area: 1,
    solar: 0,
    wind: 0,
  },
  LUMBER_MILL: {
    area: 2,
    solar: 0,
    wind: 1,
  },
  QUARRY: {
    area: 3,
    solar: 1,
    wind: 0,
  },
  MINE: {
    area: 3,
    solar: 0,
    wind: 1,
  },
  WAREHOUSE: {
    area: 2,
    solar: 0,
    wind: 0,
  },

  // Tier 2: Intermediate Structures
  WORKSHOP: {
    area: 2,
    solar: 1,
    wind: 0,
  },
  MARKETPLACE: {
    area: 3,
    solar: 0,
    wind: 0,
  },
  NPC_EMBASSY: {
    area: 3,
    solar: 0,
    wind: 0,
  },
  TRADE_CARAVAN_STATION: {
    area: 2,
    solar: 0,
    wind: 0,
  },

  // Tier 3: Advanced Structures
  TOWN_HALL: {
    area: 4,
    solar: 1,
    wind: 0,
  },
  RESEARCH_LAB: {
    area: 3,
    solar: 1,
    wind: 0,
  },
  HOSPITAL: {
    area: 3,
    solar: 1,
    wind: 0,
  },
  LIBRARY: {
    area: 2,
    solar: 0,
    wind: 0,
  },
  RELIEF_CENTER: {
    area: 2,
    solar: 0,
    wind: 0,
  },
  DISASTER_COMMAND_CENTER: {
    area: 4,
    solar: 1,
    wind: 0,
  },

  // Tier 4: Disaster Defense
  EMERGENCY_SHELTER: {
    area: 2,
    solar: 0,
    wind: 0,
  },
  WATCHTOWER: {
    area: 1,
    solar: 0,
    wind: 1,
  },
  SEISMOLOGY_STATION: {
    area: 3,
    solar: 1,
    wind: 0,
  },
  METEOROLOGY_CENTER: {
    area: 3,
    solar: 0,
    wind: 1,
  },
  NPC_GUEST_QUARTERS: {
    area: 2,
    solar: 0,
    wind: 0,
  },

  // Tier 5: Guild & Specialization
  GUILD_HEADQUARTERS: {
    area: 5,
    solar: 1,
    wind: 0,
  },
  GUILD_OUTPOST: {
    area: 2,
    solar: 0,
    wind: 0,
  },
  GUILD_WORKSHOP: {
    area: 3,
    solar: 1,
    wind: 0,
  },
  GUILD_MONUMENT: {
    area: 10,
    solar: 0,
    wind: 0,
  },
  ALLIANCE_PAVILION: {
    area: 3,
    solar: 0,
    wind: 0,
  },
  ADVANCED_GREENHOUSE: {
    area: 4,
    solar: 2,
    wind: 0,
  },
  DEEP_MINING_COMPLEX: {
    area: 5,
    solar: 0,
    wind: 1,
  },
  FORTRESS: {
    area: 6,
    solar: 0,
    wind: 0,
  },
  GRAND_MARKET: {
    area: 4,
    solar: 0,
    wind: 0,
  },
  ADVANCED_ACADEMY: {
    area: 4,
    solar: 1,
    wind: 0,
  },
};

/**
 * Default requirements for structures not in the map
 */
export const DEFAULT_REQUIREMENTS: StructureRequirements = {
  area: 1,
  solar: 0,
  wind: 0,
};

/**
 * Get requirements for a structure by name
 * @param structureName - The structure name (case-insensitive)
 * @returns The structure requirements or default if not found
 */
export function getStructureRequirements(structureName: string): StructureRequirements {
  const upperName = structureName.toUpperCase();
  return STRUCTURE_REQUIREMENTS[upperName] || DEFAULT_REQUIREMENTS;
}

/**
 * Check if a structure has defined requirements
 * @param structureName - The structure name (case-insensitive)
 * @returns True if structure has custom requirements defined
 */
export function hasStructureRequirements(structureName: string): boolean {
  const upperName = structureName.toUpperCase();
  return upperName in STRUCTURE_REQUIREMENTS;
}
