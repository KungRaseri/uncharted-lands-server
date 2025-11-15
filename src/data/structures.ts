/**
 * Structure Master Data
 * Single source of truth for all structures in the game
 */

export type StructureCategory = 'BUILDING' | 'EXTRACTOR';
export type ExtractorType =
  | 'FARM'
  | 'WELL'
  | 'LUMBER_MILL'
  | 'QUARRY'
  | 'MINE'
  | 'FISHING_DOCK'
  | 'HUNTERS_LODGE'
  | 'HERB_GARDEN'
  | null;
export type BuildingType =
  | 'HOUSE'
  | 'STORAGE'
  | 'BARRACKS'
  | 'WORKSHOP'
  | 'MARKETPLACE'
  | 'TOWN_HALL'
  | 'WALL'
  | null;

export interface StructureDefinition {
  id: string;
  name: string;
  description: string;
  category: StructureCategory;
  extractorType: ExtractorType;
  buildingType: BuildingType;
  maxLevel: number;
  requirements: {
    area?: number;
    solar?: number;
    wind?: number;
    food?: number;
    water?: number;
    wood?: number;
    stone?: number;
    ore?: number;
  };
}

export const STRUCTURES: StructureDefinition[] = [
  {
    id: 'tent',
    name: 'Tent',
    description: 'Basic shelter for settlers',
    category: 'BUILDING',
    extractorType: null,
    buildingType: 'HOUSE',
    maxLevel: 3,
    requirements: {
      area: 1,
      food: 5,
      water: 2,
      wood: 10,
    },
  },
  {
    id: 'house',
    name: 'House',
    description: 'Provides housing capacity for settlers',
    category: 'BUILDING',
    extractorType: null,
    buildingType: 'HOUSE',
    maxLevel: 10,
    requirements: {
      area: 2,
      solar: 5,
      wood: 50,
      stone: 20,
    },
  },
  {
    id: 'warehouse',
    name: 'Warehouse',
    description: 'Increases storage capacity',
    category: 'BUILDING',
    extractorType: null,
    buildingType: 'STORAGE',
    maxLevel: 10,
    requirements: {
      area: 3,
      wood: 40,
      stone: 20,
    },
  },
  {
    id: 'town_hall',
    name: 'Town Hall',
    description: 'Administrative center for the settlement',
    category: 'BUILDING',
    extractorType: null,
    buildingType: 'TOWN_HALL',
    maxLevel: 5,
    requirements: {
      area: 5,
      solar: 10,
      wood: 200,
      stone: 150,
      ore: 50,
    },
  },
  {
    id: 'workshop',
    name: 'Workshop',
    description: 'Allows upgrading structures',
    category: 'BUILDING',
    extractorType: null,
    buildingType: 'WORKSHOP',
    maxLevel: 10,
    requirements: {
      area: 3,
      solar: 8,
      wood: 60,
      stone: 60,
      ore: 30,
    },
  },
  {
    id: 'farm',
    name: 'Farm',
    description: 'Produces food',
    category: 'EXTRACTOR',
    extractorType: 'FARM',
    buildingType: null,
    maxLevel: 5,
    requirements: {
      area: 4,
      solar: 5,
      wood: 20,
      stone: 10,
    },
  },
  {
    id: 'quarry',
    name: 'Quarry',
    description: 'Extracts stone from the ground',
    category: 'EXTRACTOR',
    extractorType: 'QUARRY',
    buildingType: null,
    maxLevel: 5,
    requirements: {
      area: 5,
      wood: 30,
      stone: 20,
    },
  },
  {
    id: 'mine',
    name: 'Mine',
    description: 'Extracts ore from the ground',
    category: 'EXTRACTOR',
    extractorType: 'MINE',
    buildingType: null,
    maxLevel: 5,
    requirements: {
      area: 6,
      wood: 40,
      stone: 30,
    },
  },
  {
    id: 'lumber_mill',
    name: 'Lumber Mill',
    description: 'Produces wood',
    category: 'EXTRACTOR',
    extractorType: 'LUMBER_MILL',
    buildingType: null,
    maxLevel: 5,
    requirements: {
      area: 4,
      wood: 20,
      stone: 10,
    },
  },
  {
    id: 'fishing_dock',
    name: 'Fishing Dock',
    description: 'Produces food from water',
    category: 'EXTRACTOR',
    extractorType: 'FISHING_DOCK',
    buildingType: null,
    maxLevel: 5,
    requirements: {
      area: 3,
      wood: 30,
      stone: 15,
    },
  },
  {
    id: 'hunters_lodge',
    name: "Hunter's Lodge",
    description: 'Produces pelts and food from hunting',
    category: 'EXTRACTOR',
    extractorType: 'HUNTERS_LODGE',
    buildingType: null,
    maxLevel: 5,
    requirements: {
      area: 3,
      wood: 25,
      stone: 10,
    },
  },
  {
    id: 'well',
    name: 'Well',
    description: 'Provides water to the settlement',
    category: 'EXTRACTOR',
    extractorType: 'WELL',
    buildingType: null,
    maxLevel: 5,
    requirements: {
      area: 2,
      wood: 15,
      stone: 20,
    },
  },
  {
    id: 'herb_garden',
    name: 'Herb Garden',
    description: 'Grows medicinal herbs',
    category: 'EXTRACTOR',
    extractorType: 'HERB_GARDEN',
    buildingType: null,
    maxLevel: 5,
    requirements: {
      area: 2,
      wood: 15,
      stone: 5,
    },
  },
  {
    id: 'marketplace',
    name: 'Marketplace',
    description: 'Enables trading with other settlements',
    category: 'BUILDING',
    extractorType: null,
    buildingType: 'MARKETPLACE',
    maxLevel: 5,
    requirements: {
      area: 4,
      solar: 7,
      wood: 120,
      stone: 80,
    },
  },
];
