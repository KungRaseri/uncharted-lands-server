/**
 * Tests for Consumption Calculator
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePopulationCapacity,
  calculatePopulation,
  calculateConsumption,
  calculateMorale,
  getConsumptionSummary,
  hasResourcesForPopulation,
  CONSUMPTION_RATES,
  type Structure,
} from '../../../src/game/consumption-calculator.js';

describe('Consumption Calculator', () => {
  describe('calculatePopulationCapacity', () => {
    it('should return base capacity with no structures', () => {
      const capacity = calculatePopulationCapacity([]);
      expect(capacity).toBe(CONSUMPTION_RATES.BASE_POPULATION_CAPACITY);
    });

    it('should add population capacity modifiers', () => {
      const structures: Structure[] = [
        {
          name: 'House',
          modifiers: [{ name: 'Population Capacity', value: 5 }],
        },
        {
          name: 'House',
          modifiers: [{ name: 'Population Capacity', value: 5 }],
        },
      ];

      const capacity = calculatePopulationCapacity(structures);
      expect(capacity).toBe(CONSUMPTION_RATES.BASE_POPULATION_CAPACITY + 10);
    });

    it('should ignore non-population modifiers', () => {
      const structures: Structure[] = [
        {
          name: 'Farm',
          modifiers: [
            { name: 'Food Production', value: 10 },
            { name: 'Population Capacity', value: 3 },
          ],
        },
      ];

      const capacity = calculatePopulationCapacity(structures);
      expect(capacity).toBe(CONSUMPTION_RATES.BASE_POPULATION_CAPACITY + 3);
    });

    it('should handle negative modifiers (minimum 0)', () => {
      const structures: Structure[] = [
        {
          name: 'Disaster',
          modifiers: [{ name: 'Population Capacity', value: -1000 }],
        },
      ];

      const capacity = calculatePopulationCapacity(structures);
      expect(capacity).toBe(0);
    });
  });

  describe('calculatePopulation', () => {
    it('should match capacity when no current population provided', () => {
      const structures: Structure[] = [
        {
          name: 'House',
          modifiers: [{ name: 'Population Capacity', value: 5 }],
        },
      ];

      const population = calculatePopulation(structures);
      const capacity = calculatePopulationCapacity(structures);
      expect(population).toBe(capacity);
    });

    it('should work with empty structures', () => {
      const population = calculatePopulation([]);
      expect(population).toBe(CONSUMPTION_RATES.BASE_POPULATION_CAPACITY);
    });
  });

  describe('calculateConsumption', () => {
    it('should calculate zero consumption for zero population and zero structures', () => {
      const consumption = calculateConsumption(0, 0, 60);

      expect(consumption.food).toBe(0);
      expect(consumption.water).toBe(0);
      expect(consumption.wood).toBe(0);
      expect(consumption.stone).toBe(0);
      expect(consumption.ore).toBe(0);
    });

    it('should calculate consumption for 1 person for 1 tick', () => {
      const consumption = calculateConsumption(1, 0, 1);

      expect(consumption.food).toBeCloseTo(CONSUMPTION_RATES.FOOD_PER_CAPITA_PER_TICK);
      expect(consumption.water).toBeCloseTo(CONSUMPTION_RATES.WATER_PER_CAPITA_PER_TICK);
    });

    it('should calculate consumption for multiple people', () => {
      const population = 10;
      const consumption = calculateConsumption(population, 0, 1);

      expect(consumption.food).toBeCloseTo(CONSUMPTION_RATES.FOOD_PER_CAPITA_PER_TICK * population);
      expect(consumption.water).toBeCloseTo(
        CONSUMPTION_RATES.WATER_PER_CAPITA_PER_TICK * population
      );
    });

    it('should scale consumption by tick count', () => {
      const population = 5;
      const ticks = 60; // 1 second
      const consumption = calculateConsumption(population, 0, ticks);

      expect(consumption.food).toBeCloseTo(
        CONSUMPTION_RATES.FOOD_PER_CAPITA_PER_TICK * population * ticks
      );
      expect(consumption.water).toBeCloseTo(
        CONSUMPTION_RATES.WATER_PER_CAPITA_PER_TICK * population * ticks
      );
    });

    it('should calculate hourly consumption correctly', () => {
      const population = 10;
      const ticksPerHour = 60 * 60 * 60; // 60 ticks/sec * 60 sec/min * 60 min/hour
      const consumption = calculateConsumption(population, 0, ticksPerHour);

      // GDD spec: 0.005 food per tick = 1,080 food/hour per person
      // GDD spec: 0.01 water per tick = 2,160 water/hour per person
      expect(consumption.food).toBeCloseTo(10800, 0); // 10 people * 1,080 food/hour
      expect(consumption.water).toBeCloseTo(21600, 0); // 10 people * 2,160 water/hour
    });

    it('should calculate structure maintenance consumption', () => {
      const structureCount = 5;
      const ticksPerHour = 60 * 60 * 60;
      const consumption = calculateConsumption(0, structureCount, ticksPerHour);

      // GDD spec: Structure maintenance per tick
      // Wood: 0.001 per structure per tick = 216/hour per structure (0.001 * 216000)
      // Stone: 0.0005 per structure per tick = 108/hour per structure
      // Ore: 0.00025 per structure per tick = 54/hour per structure
      expect(consumption.wood).toBeCloseTo(1080, 1); // 5 structures * 216/hour
      expect(consumption.stone).toBeCloseTo(540, 1); // 5 structures * 108/hour
      expect(consumption.ore).toBeCloseTo(270, 1); // 5 structures * 54/hour
    });
  });

  describe('calculateMorale', () => {
    it('should return base morale (50) with no structures', () => {
      const morale = calculateMorale([]);
      expect(morale).toBe(50);
    });

    it('should add morale boost modifiers', () => {
      const structures: Structure[] = [
        {
          name: 'Tavern',
          modifiers: [{ name: 'Morale Boost', value: 10 }],
        },
        {
          name: 'Theater',
          modifiers: [{ name: 'Morale Boost', value: 15 }],
        },
      ];

      const morale = calculateMorale(structures);
      expect(morale).toBe(75);
    });

    it('should clamp morale to 100 maximum', () => {
      const structures: Structure[] = [
        {
          name: 'Paradise',
          modifiers: [{ name: 'Morale Boost', value: 200 }],
        },
      ];

      const morale = calculateMorale(structures);
      expect(morale).toBe(100);
    });

    it('should clamp morale to 0 minimum', () => {
      const structures: Structure[] = [
        {
          name: 'Disaster',
          modifiers: [{ name: 'Morale Boost', value: -200 }],
        },
      ];

      const morale = calculateMorale(structures);
      expect(morale).toBe(0);
    });
  });

  describe('getConsumptionSummary', () => {
    it('should return complete summary', () => {
      const structures: Structure[] = [
        {
          name: 'House',
          modifiers: [{ name: 'Population Capacity', value: 5 }],
        },
        {
          name: 'Tavern',
          modifiers: [{ name: 'Morale Boost', value: 10 }],
        },
      ];

      const summary = getConsumptionSummary(structures);

      expect(summary.population).toBe(15); // Base 10 + 5
      expect(summary.capacity).toBe(15);
      expect(summary.morale).toBe(60); // Base 50 + 10
      expect(summary.consumption).toBeDefined();
      expect(summary.perCapitaPerSecond).toBeDefined();
      expect(summary.perCapitaPerHour).toBeDefined();
    });

    it('should calculate per-capita rates correctly', () => {
      const summary = getConsumptionSummary([]);

      // Per second = per tick * 60
      expect(summary.perCapitaPerSecond.food).toBeCloseTo(
        CONSUMPTION_RATES.FOOD_PER_CAPITA_PER_TICK * 60
      );
      expect(summary.perCapitaPerSecond.water).toBeCloseTo(
        CONSUMPTION_RATES.WATER_PER_CAPITA_PER_TICK * 60
      );

      // Per hour = per tick * 60 * 60 * 60
      // GDD spec: 0.005 per tick = 1,080/hour per person
      // GDD spec: 0.01 per tick = 2,160/hour per person
      expect(summary.perCapitaPerHour.food).toBeCloseTo(1080, 0);
      expect(summary.perCapitaPerHour.water).toBeCloseTo(2160, 0);
    });
  });

  describe('hasResourcesForPopulation', () => {
    it('should return true when resources are sufficient for 1 hour', () => {
      const population = 10;
      const structureCount = 5;
      const resources = {
        food: 11000, // 10 people * 1,080 food/hour = 10,800 needed
        water: 22000, // 10 people * 2,160 water/hour = 21,600 needed
        wood: 1100, // 5 structures * 216 wood/hour = 1,080 needed
        stone: 550, // 5 structures * 108 stone/hour = 540 needed
        ore: 300, // 5 structures * 54 ore/hour = 270 needed
      };

      const sufficient = hasResourcesForPopulation(population, structureCount, resources);
      expect(sufficient).toBe(true);
    });

    it('should return false when food is insufficient', () => {
      const population = 10;
      const structureCount = 0;
      const resources = {
        food: 1000, // Not enough (need 10,800)
        water: 22000,
        wood: 0,
        stone: 0,
        ore: 0,
      };

      const sufficient = hasResourcesForPopulation(population, structureCount, resources);
      expect(sufficient).toBe(false);
    });

    it('should return false when water is insufficient', () => {
      const population = 10;
      const structureCount = 0;
      const resources = {
        food: 11000,
        water: 1000, // Not enough (need 21,600)
        wood: 0,
        stone: 0,
        ore: 0,
      };

      const sufficient = hasResourcesForPopulation(population, structureCount, resources);
      expect(sufficient).toBe(false);
    });

    it('should return true for zero population and zero structures', () => {
      const resources = {
        food: 0,
        water: 0,
        wood: 0,
        stone: 0,
        ore: 0,
      };

      const sufficient = hasResourcesForPopulation(0, 0, resources);
      expect(sufficient).toBe(true);
    });

    it('should return true when resources exactly meet hourly needs', () => {
      const population = 1;
      const structureCount = 1;
      const resources = {
        food: 1080, // Exactly 1 hour for 1 person (1,080/hour)
        water: 2160, // Exactly 1 hour for 1 person (2,160/hour)
        wood: 216, // Exactly 1 hour for 1 structure (216/hour)
        stone: 108, // Exactly 1 hour for 1 structure (108/hour)
        ore: 54, // Exactly 1 hour for 1 structure (54/hour)
      };

      const sufficient = hasResourcesForPopulation(population, structureCount, resources);
      expect(sufficient).toBe(true);
    });
  });
});
