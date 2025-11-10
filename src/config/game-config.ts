/**
 * Game Configuration Types and Constants
 * 
 * This file defines the shared game configuration that should be consistent
 * between client and server. These can be stored in the database and fetched
 * via API to ensure consistency.
 */

// ===========================
// ENUMS (Shared between client/server)
// ===========================

export const RESOURCE_TYPES = [
  'FOOD',
  'WOOD',
  'STONE',
  'ORE',
  'CLAY',
  'HERBS',
  'PELTS',
  'GEMS',
  'EXOTIC_WOOD',
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const EXTRACTOR_TYPES = [
  'FARM',
  'LUMBER_MILL',
  'QUARRY',
  'MINE',
  'FISHING_DOCK',
  'HUNTERS_LODGE',
  'HERB_GARDEN',
] as const;

export type ExtractorType = (typeof EXTRACTOR_TYPES)[number];

export const BUILDING_TYPES = [
  'HOUSE',
  'STORAGE',
  'BARRACKS',
  'WORKSHOP',
  'MARKETPLACE',
  'TOWN_HALL',
  'WALL',
] as const;

export type BuildingType = (typeof BUILDING_TYPES)[number];

export const SPECIAL_RESOURCES = [
  'GEMS',
  'EXOTIC_WOOD',
  'MAGICAL_HERBS',
  'ANCIENT_STONE',
] as const;

export type SpecialResource = (typeof SPECIAL_RESOURCES)[number];

// ===========================
// CONFIGURATION TYPES
// ===========================

export interface ProductionRateConfig {
  resourceType: ResourceType;
  extractorType: ExtractorType;
  baseRate: number; // Units per hour at level 1
}

export interface BiomeEfficiencyConfig {
  biomeName: string;
  resourceType: ResourceType;
  efficiency: number; // Multiplier (0-2+)
}

export interface StructureLevelConfig {
  level: number;
  multiplier: number;
  requirements?: {
    food?: number;
    wood?: number;
    stone?: number;
    ore?: number;
  };
}

export interface GameConfig {
  productionRates: ProductionRateConfig[];
  biomeEfficiencies: BiomeEfficiencyConfig[];
  structureLevels: StructureLevelConfig[];
  qualityThresholds: {
    veryPoor: number;
    poor: number;
    average: number;
    good: number;
    excellent: number;
  };
}

// ===========================
// DEFAULT CONFIG (Fallback)
// ===========================

export const DEFAULT_GAME_CONFIG: GameConfig = {
  productionRates: [
    { resourceType: 'FOOD', extractorType: 'FARM', baseRate: 10 },
    { resourceType: 'WOOD', extractorType: 'LUMBER_MILL', baseRate: 8 },
    { resourceType: 'STONE', extractorType: 'QUARRY', baseRate: 6 },
    { resourceType: 'ORE', extractorType: 'MINE', baseRate: 4 },
    { resourceType: 'CLAY', extractorType: 'QUARRY', baseRate: 3 },
    { resourceType: 'HERBS', extractorType: 'HERB_GARDEN', baseRate: 5 },
    { resourceType: 'PELTS', extractorType: 'HUNTERS_LODGE', baseRate: 4 },
    { resourceType: 'GEMS', extractorType: 'MINE', baseRate: 1 },
    { resourceType: 'EXOTIC_WOOD', extractorType: 'LUMBER_MILL', baseRate: 2 },
  ],
  biomeEfficiencies: [
    // Tropical Rainforest
    { biomeName: 'Tropical Rainforest', resourceType: 'FOOD', efficiency: 1.5 },
    { biomeName: 'Tropical Rainforest', resourceType: 'WOOD', efficiency: 2 },
    { biomeName: 'Tropical Rainforest', resourceType: 'STONE', efficiency: 0.5 },
    { biomeName: 'Tropical Rainforest', resourceType: 'ORE', efficiency: 0.5 },
    { biomeName: 'Tropical Rainforest', resourceType: 'HERBS', efficiency: 1.8 },
    { biomeName: 'Tropical Rainforest', resourceType: 'PELTS', efficiency: 1.2 },
    // Add more as needed...
  ],
  structureLevels: [
    { level: 1, multiplier: 1 },
    { level: 2, multiplier: 1.5, requirements: { wood: 100, stone: 50 } },
    { level: 3, multiplier: 2.25, requirements: { wood: 200, stone: 100, ore: 50 } },
    { level: 4, multiplier: 3.375, requirements: { wood: 400, stone: 200, ore: 100 } },
    { level: 5, multiplier: 5.0625, requirements: { wood: 800, stone: 400, ore: 200 } },
  ],
  qualityThresholds: {
    veryPoor: 20,
    poor: 40,
    average: 60,
    good: 80,
    excellent: 100,
  },
};
