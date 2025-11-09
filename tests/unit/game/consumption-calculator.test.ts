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
    it('should calculate zero consumption for zero population', () => {
      const consumption = calculateConsumption(0, 60);

      expect(consumption.food).toBe(0);
      expect(consumption.water).toBe(0);
      expect(consumption.wood).toBe(0);
      expect(consumption.stone).toBe(0);
      expect(consumption.ore).toBe(0);
    });

    it('should calculate consumption for 1 person for 1 tick', () => {
      const consumption = calculateConsumption(1, 1);

      expect(consumption.food).toBeCloseTo(CONSUMPTION_RATES.FOOD_PER_CAPITA_PER_TICK);
      expect(consumption.water).toBeCloseTo(CONSUMPTION_RATES.WATER_PER_CAPITA_PER_TICK);
    });

    it('should calculate consumption for multiple people', () => {
      const population = 10;
      const consumption = calculateConsumption(population, 1);

      expect(consumption.food).toBeCloseTo(CONSUMPTION_RATES.FOOD_PER_CAPITA_PER_TICK * population);
      expect(consumption.water).toBeCloseTo(
        CONSUMPTION_RATES.WATER_PER_CAPITA_PER_TICK * population
      );
    });

    it('should scale consumption by tick count', () => {
      const population = 5;
      const ticks = 60; // 1 second
      const consumption = calculateConsumption(population, ticks);

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
      const consumption = calculateConsumption(population, ticksPerHour);

      // Should be approximately 18 food and 27 water per person per hour
      expect(consumption.food).toBeCloseTo(180, 0); // 10 people * 18 food/hour
      expect(consumption.water).toBeCloseTo(270, 0); // 10 people * 27 water/hour
    });

    it('should return zero for wood, stone, ore (not yet implemented)', () => {
      const consumption = calculateConsumption(100, 1000);

      expect(consumption.wood).toBe(0);
      expect(consumption.stone).toBe(0);
      expect(consumption.ore).toBe(0);
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
      expect(summary.perCapitaPerHour.food).toBeCloseTo(18, 0);
      expect(summary.perCapitaPerHour.water).toBeCloseTo(27, 0);
    });
  });

  describe('hasResourcesForPopulation', () => {
    it('should return true when resources are sufficient for 1 hour', () => {
      const population = 10;
      const resources = {
        food: 200, // 10 people * 18 food/hour = 180 needed
        water: 300, // 10 people * 27 water/hour = 270 needed
        wood: 0,
        stone: 0,
        ore: 0,
      };

      const sufficient = hasResourcesForPopulation(population, resources);
      expect(sufficient).toBe(true);
    });

    it('should return false when food is insufficient', () => {
      const population = 10;
      const resources = {
        food: 100, // Not enough (need 180)
        water: 300,
        wood: 0,
        stone: 0,
        ore: 0,
      };

      const sufficient = hasResourcesForPopulation(population, resources);
      expect(sufficient).toBe(false);
    });

    it('should return false when water is insufficient', () => {
      const population = 10;
      const resources = {
        food: 200,
        water: 100, // Not enough (need 270)
        wood: 0,
        stone: 0,
        ore: 0,
      };

      const sufficient = hasResourcesForPopulation(population, resources);
      expect(sufficient).toBe(false);
    });

    it('should return true for zero population', () => {
      const resources = {
        food: 0,
        water: 0,
        wood: 0,
        stone: 0,
        ore: 0,
      };

      const sufficient = hasResourcesForPopulation(0, resources);
      expect(sufficient).toBe(true);
    });

    it('should return true when resources exactly meet hourly needs', () => {
      const population = 1;
      const resources = {
        food: 18, // Exactly 1 hour
        water: 27, // Exactly 1 hour
        wood: 0,
        stone: 0,
        ore: 0,
      };

      const sufficient = hasResourcesForPopulation(population, resources);
      expect(sufficient).toBe(true);
    });
  });
});
