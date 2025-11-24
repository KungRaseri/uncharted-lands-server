/**
 * Tests for Resource Calculator
 */

import { describe, it, expect } from 'vitest';
import {
  calculateProduction,
  calculateTimedProduction,
  addResources,
  subtractResources,
  hasEnoughResources,
  calculateConsumption,
  calculateNetProduction,
  formatResources,
  type Resources,
} from '../../../src/game/resource-calculator.js';
import type { Plot } from '../../../src/db/schema.js';

describe('resource-calculator', () => {
  // Mock plot data for testing
  const mockPlot: Plot = {
    id: 'test-plot-1',
    tileId: 'test-tile-1',
    position: 0,
    resourceType: null,
    baseProductionRate: 0,
    qualityMultiplier: 1,
    lastHarvested: null,
    accumulatedResources: 0,
    area: 100,
    solar: 5,
    wind: 5,
    food: 10,
    water: 10,
    wood: 10,
    stone: 10,
    ore: 10,
    structureId: null,
    settlementId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock extractors for production testing
  // Each extractor produces its corresponding resource from the plot
  const mockExtractors = [
    {
      id: 'extractor-farm',
      structureId: 'structure-farm', // Required by SettlementStructure
      settlementId: 'settlement-1',
      plotId: 'plot-1',
      level: 1,
      populationAssigned: 0,
      health: 100, // Part 6: Structure damage system
      damagedAt: null,
      lastRepairedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      // StructureWithInfo extensions
      category: 'EXTRACTOR' as const,
      buildingType: null,
      extractorType: 'FARM',
    },
    {
      id: 'extractor-well',
      structureId: 'structure-well',
      settlementId: 'settlement-1',
      plotId: 'plot-1',
      level: 1,
      populationAssigned: 0,
      health: 100,
      damagedAt: null,
      lastRepairedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: 'EXTRACTOR' as const,
      buildingType: null,
      extractorType: 'WELL',
    },
    {
      id: 'extractor-lumber',
      structureId: 'structure-lumber',
      settlementId: 'settlement-1',
      plotId: 'plot-1',
      level: 1,
      populationAssigned: 0,
      health: 100,
      damagedAt: null,
      lastRepairedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: 'EXTRACTOR' as const,
      buildingType: null,
      extractorType: 'LUMBER_MILL',
    },
    {
      id: 'extractor-quarry',
      structureId: 'structure-quarry',
      settlementId: 'settlement-1',
      plotId: 'plot-1',
      level: 1,
      populationAssigned: 0,
      health: 100,
      damagedAt: null,
      lastRepairedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: 'EXTRACTOR' as const,
      buildingType: null,
      extractorType: 'QUARRY',
    },
    {
      id: 'extractor-mine',
      structureId: 'structure-mine',
      settlementId: 'settlement-1',
      plotId: 'plot-1',
      level: 1,
      populationAssigned: 0,
      health: 100,
      damagedAt: null,
      lastRepairedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: 'EXTRACTOR' as const,
      buildingType: null,
      extractorType: 'MINE',
    },
  ];
  const emptyResources: Resources = {
    food: 0,
    water: 0,
    wood: 0,
    stone: 0,
    ore: 0,
  };

  describe('calculateProduction', () => {
    it('should calculate production for 1 tick with extractors (level 1)', () => {
      const production = calculateProduction(mockPlot, mockExtractors, 1);

      // New system: BaseRate × PlotResource × Quality × BiomeEfficiency × LevelMultiplier × Ticks
      // Level 1 = 1.0x multiplier
      // Formula: 0.01 × resourceValue × 1.0 × 1.0 × 1.0 × 1 = resourceValue × 0.01
      expect(production.food).toBeCloseTo(mockPlot.food * 0.01, 10);
      expect(production.water).toBeCloseTo(mockPlot.water * 0.01, 10);
      expect(production.wood).toBeCloseTo(mockPlot.wood * 0.01, 10);
      expect(production.stone).toBeCloseTo(mockPlot.stone * 0.01, 10);
      expect(production.ore).toBeCloseTo(mockPlot.ore * 0.01, 10);
    });

    it('should scale production with tick count', () => {
      const tickCount = 60; // 1 second
      const production = calculateProduction(mockPlot, mockExtractors, tickCount);

      // New system: BaseRate × PlotResource × Quality × BiomeEfficiency × LevelMultiplier × Ticks
      // Formula: 0.01 × resourceValue × 1.0 × 1.0 × 1.0 × 60 = resourceValue × 0.6
      expect(production.food).toBeCloseTo(mockPlot.food * 0.01 * tickCount, 10);
      expect(production.water).toBeCloseTo(mockPlot.water * 0.01 * tickCount, 10);
    });

    it('should produce ZERO without extractors (no passive gathering)', () => {
      const zeroPlot = { ...mockPlot, food: 0, water: 0, wood: 0, stone: 0, ore: 0 };
      const production = calculateProduction(zeroPlot, [], 1);

      // BLOCKER 2 FIX: No extractors = zero production (no passive gathering)
      expect(production.food).toBe(0);
      expect(production.water).toBe(0);
      expect(production.wood).toBe(0);
      expect(production.stone).toBe(0);
      expect(production.ore).toBe(0);
    });

    // DEPRECATED: Old "ISSUE #2" tests removed
    // The hybrid production system (20% passive + tier multipliers) was replaced
    // with extractor-based production (no passive gathering, level multipliers only)
    // See production-system.test.ts for current behavior tests
  });

  describe('calculateTimedProduction', () => {
    it('should calculate production over elapsed time', () => {
      const lastCollection = Date.now() - 1000; // 1 second ago
      const currentTime = Date.now();

      const production = calculateTimedProduction(
        mockPlot,
        mockExtractors,
        lastCollection,
        currentTime
      );

      // In 1 second (60 ticks), each resource should produce resourceValue * 0.01 * 60
      // Use 0 decimal places for comparison due to timing precision
      expect(production.food).toBeCloseTo(mockPlot.food * 0.01 * 60, 0);
      expect(production.water).toBeCloseTo(mockPlot.water * 0.01 * 60, 0);
    });

    it('should handle zero elapsed time', () => {
      const currentTime = Date.now();
      const production = calculateTimedProduction(mockPlot, [], currentTime, currentTime);

      expect(production.food).toBe(0);
      expect(production.water).toBe(0);
    });

    it('should calculate production for longer time periods', () => {
      const lastCollection = Date.now() - 5000; // 5 seconds ago
      const currentTime = Date.now();

      const production = calculateTimedProduction(
        mockPlot,
        mockExtractors,
        lastCollection,
        currentTime
      );

      // In 5 seconds (300 ticks)
      expect(production.food).toBeCloseTo(mockPlot.food * 0.01 * 300, 1);
    });
  });

  describe('addResources', () => {
    it('should add resources correctly', () => {
      const storage: Resources = { food: 100, water: 50, wood: 25, stone: 10, ore: 5 };
      const toAdd: Resources = { food: 10, water: 20, wood: 5, stone: 2, ore: 1 };

      const result = addResources(storage, toAdd);

      expect(result.food).toBe(110);
      expect(result.water).toBe(70);
      expect(result.wood).toBe(30);
      expect(result.stone).toBe(12);
      expect(result.ore).toBe(6);
    });

    it('should respect max capacity when provided', () => {
      const storage: Resources = { food: 100, water: 100, wood: 100, stone: 100, ore: 100 };
      const toAdd: Resources = { food: 50, water: 50, wood: 50, stone: 50, ore: 50 };
      const maxCapacity = 120;

      const result = addResources(storage, toAdd, maxCapacity);

      // All resources should be capped at 120
      expect(result.food).toBe(120);
      expect(result.water).toBe(120);
      expect(result.wood).toBe(120);
      expect(result.stone).toBe(120);
      expect(result.ore).toBe(120);
    });

    it('should work with empty storage', () => {
      const toAdd: Resources = { food: 10, water: 20, wood: 5, stone: 2, ore: 1 };

      const result = addResources(emptyResources, toAdd);

      expect(result).toEqual(toAdd);
    });
  });

  describe('subtractResources', () => {
    it('should subtract resources correctly', () => {
      const storage: Resources = { food: 100, water: 50, wood: 25, stone: 10, ore: 5 };
      const toSubtract: Resources = { food: 10, water: 20, wood: 5, stone: 2, ore: 1 };

      const result = subtractResources(storage, toSubtract);

      expect(result.food).toBe(90);
      expect(result.water).toBe(30);
      expect(result.wood).toBe(20);
      expect(result.stone).toBe(8);
      expect(result.ore).toBe(4);
    });

    it('should not go below zero', () => {
      const storage: Resources = { food: 10, water: 5, wood: 2, stone: 1, ore: 0 };
      const toSubtract: Resources = { food: 20, water: 10, wood: 5, stone: 5, ore: 1 };

      const result = subtractResources(storage, toSubtract);

      expect(result.food).toBe(0);
      expect(result.water).toBe(0);
      expect(result.wood).toBe(0);
      expect(result.stone).toBe(0);
      expect(result.ore).toBe(0);
    });

    it('should handle subtracting from empty storage', () => {
      const toSubtract: Resources = { food: 10, water: 20, wood: 5, stone: 2, ore: 1 };

      const result = subtractResources(emptyResources, toSubtract);

      expect(result).toEqual(emptyResources);
    });
  });

  describe('hasEnoughResources', () => {
    it('should return true when storage has enough resources', () => {
      const storage: Resources = { food: 100, water: 50, wood: 25, stone: 10, ore: 5 };
      const required: Resources = { food: 50, water: 25, wood: 10, stone: 5, ore: 2 };

      expect(hasEnoughResources(storage, required)).toBe(true);
    });

    it('should return false when any resource is insufficient', () => {
      const storage: Resources = { food: 100, water: 50, wood: 25, stone: 10, ore: 5 };
      const required: Resources = { food: 50, water: 25, wood: 10, stone: 15, ore: 2 };

      expect(hasEnoughResources(storage, required)).toBe(false);
    });

    it('should return true when exactly enough resources', () => {
      const storage: Resources = { food: 100, water: 50, wood: 25, stone: 10, ore: 5 };
      const required: Resources = { food: 100, water: 50, wood: 25, stone: 10, ore: 5 };

      expect(hasEnoughResources(storage, required)).toBe(true);
    });

    it('should return true when checking against empty requirements', () => {
      const storage: Resources = { food: 100, water: 50, wood: 25, stone: 10, ore: 5 };

      expect(hasEnoughResources(storage, emptyResources)).toBe(true);
    });
  });

  describe('calculateConsumption', () => {
    it('should calculate consumption for population only', () => {
      const consumption = calculateConsumption(10, 0);

      // 10 people * 0.005 food = 0.05
      // 10 people * 0.01 water = 0.1
      expect(consumption.food).toBe(0.05);
      expect(consumption.water).toBe(0.1);
      expect(consumption.wood).toBe(0);
      expect(consumption.stone).toBe(0);
      expect(consumption.ore).toBe(0);
    });

    it('should calculate consumption for structures only', () => {
      const consumption = calculateConsumption(0, 10);

      // 10 structures * 0.001 = 0.01 wood
      // 10 structures * 0.001 * 0.5 = 0.005 stone
      // 10 structures * 0.001 * 0.25 = 0.0025 ore
      expect(consumption.food).toBe(0);
      expect(consumption.water).toBe(0);
      expect(consumption.wood).toBe(0.01);
      expect(consumption.stone).toBe(0.005);
      expect(consumption.ore).toBe(0.0025);
    });

    it('should calculate consumption for both population and structures', () => {
      const consumption = calculateConsumption(10, 5);

      expect(consumption.food).toBe(0.05); // 10 * 0.005
      expect(consumption.water).toBe(0.1); // 10 * 0.01
      expect(consumption.wood).toBe(0.005); // 5 * 0.001
      expect(consumption.stone).toBe(0.0025); // 5 * 0.001 * 0.5
      expect(consumption.ore).toBe(0.00125); // 5 * 0.001 * 0.25
    });

    it('should return zero consumption for empty settlement', () => {
      const consumption = calculateConsumption(0, 0);

      expect(consumption).toEqual(emptyResources);
    });
  });

  describe('calculateNetProduction', () => {
    it('should calculate positive net production', () => {
      const net = calculateNetProduction(mockPlot, mockExtractors, 0, 0, 60); // 1 second, no consumption

      // Production: resourceValue * 0.01 * 60
      expect(net.food).toBeCloseTo(mockPlot.food * 0.01 * 60, 10);
      expect(net.water).toBeCloseTo(mockPlot.water * 0.01 * 60, 10);
    });

    it('should calculate net production with consumption', () => {
      const net = calculateNetProduction(mockPlot, mockExtractors, 10, 5, 60);

      const expectedFoodConsumption = 10 * 0.005 * 60; // 3
      const expectedFoodProduction = mockPlot.food * 0.01 * 60; // 6

      expect(net.food).toBeCloseTo(expectedFoodProduction - expectedFoodConsumption, 5);
    });

    it('should handle negative net production when consumption exceeds production', () => {
      const poorPlot = { ...mockPlot, food: 1, water: 1 }; // Very low production
      const net = calculateNetProduction(poorPlot, [], 100, 0, 60); // Large population

      expect(net.food).toBeLessThan(0);
      expect(net.water).toBeLessThan(0);
    });
  });

  describe('formatResources', () => {
    it('should format resources as a readable string', () => {
      const resources: Resources = { food: 100.7, water: 50.3, wood: 25.9, stone: 10.1, ore: 5.5 };

      const formatted = formatResources(resources);

      expect(formatted).toBe('Food: 100, Water: 50, Wood: 25, Stone: 10, Ore: 5');
    });

    it('should handle zero values', () => {
      const formatted = formatResources(emptyResources);

      expect(formatted).toBe('Food: 0, Water: 0, Wood: 0, Stone: 0, Ore: 0');
    });

    it('should floor decimal values', () => {
      const resources: Resources = { food: 99.9, water: 0.1, wood: 49.5, stone: 1.8, ore: 0.01 };

      const formatted = formatResources(resources);

      expect(formatted).toBe('Food: 99, Water: 0, Wood: 49, Stone: 1, Ore: 0');
    });
  });
});
