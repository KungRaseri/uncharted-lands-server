/**
 * Resource Master Data
 * Single source of truth for all resources in the game
 */

export interface ResourceDefinition {
  id: string;
  name: string;
  description: string;
  category: 'plot' | 'energy' | 'consumable' | 'material';
}

export const RESOURCES: ResourceDefinition[] = [
  {
    id: 'area',
    name: 'area',
    description: 'Plot area required for construction',
    category: 'plot',
  },
  {
    id: 'solar',
    name: 'solar',
    description: 'Solar energy requirement',
    category: 'energy',
  },
  {
    id: 'wind',
    name: 'wind',
    description: 'Wind energy requirement',
    category: 'energy',
  },
  {
    id: 'food',
    name: 'food',
    description: 'Food resource',
    category: 'consumable',
  },
  {
    id: 'water',
    name: 'water',
    description: 'Water resource',
    category: 'consumable',
  },
  {
    id: 'wood',
    name: 'wood',
    description: 'Wood building material',
    category: 'material',
  },
  {
    id: 'stone',
    name: 'stone',
    description: 'Stone building material',
    category: 'material',
  },
  {
    id: 'ore',
    name: 'ore',
    description: 'Ore building material',
    category: 'material',
  },
];
