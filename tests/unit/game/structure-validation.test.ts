/**
 * Tests for Structure Validation System
 *
 * Tests the validation and resource deduction logic for structure building.
 * Ensures proper validation, atomic transactions, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateAndDeductResources,
  checkResourceAvailability,
} from '../../../src/game/structure-validation.js';
import type { ValidationResult, ResourceShortage } from '../../../src/game/structure-validation.js';
import { getStructureCost, getUpgradeCost } from '../../../src/game/structure-costs.js';

// Mock database and transaction
const mockTransaction = {
  query: {
    settlements: {
      findFirst: vi.fn(),
    },
  },
  update: vi.fn(),
};

describe('Structure Validation System', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  describe('checkResourceAvailability', () => {
    describe('Success Cases', () => {
      it('should validate TENT (10 wood) with sufficient resources', async () => {
        const mockSettlement = {
          id: 'settlement-1',
          storage: {
            id: 'storage-1',
            food: 50,
            water: 100,
            wood: 50, // Sufficient for TENT (needs 10)
            stone: 30,
            ore: 0,
            capacity: 5000,
          },
        };

        mockTransaction.query.settlements.findFirst.mockResolvedValue(mockSettlement);

        const result = await checkResourceAvailability(
          mockTransaction as any,
          'settlement-1',
          'TENT'
        );

        expect(result.success).toBe(true);
        expect(result.shortages).toBeUndefined();
      });

      it('should validate FARM (20 wood, 10 stone) with sufficient resources', async () => {
        const mockSettlement = {
          id: 'settlement-1',
          storage: {
            id: 'storage-1',
            food: 50,
            water: 100,
            wood: 50, // Sufficient for FARM (needs 20)
            stone: 30, // Sufficient for FARM (needs 10)
            ore: 0,
            capacity: 5000,
          },
        };

        mockTransaction.query.settlements.findFirst.mockResolvedValue(mockSettlement);

        const result = await checkResourceAvailability(
          mockTransaction as any,
          'settlement-1',
          'FARM'
        );

        expect(result.success).toBe(true);
        expect(result.shortages).toBeUndefined();
      });

      it('should validate WORKSHOP (60 wood, 60 stone, 30 ore) with exact resources', async () => {
        const mockSettlement = {
          id: 'settlement-1',
          storage: {
            id: 'storage-1',
            food: 50,
            water: 100,
            wood: 60, // Exactly enough
            stone: 60, // Exactly enough
            ore: 30, // Exactly enough
            capacity: 5000,
          },
        };

        mockTransaction.query.settlements.findFirst.mockResolvedValue(mockSettlement);

        const result = await checkResourceAvailability(
          mockTransaction as any,
          'settlement-1',
          'WORKSHOP'
        );

        expect(result.success).toBe(true);
        expect(result.shortages).toEqual([]);
      });
    });

    describe('Failure Cases - Single Resource Shortage', () => {
      it('should fail with insufficient wood for TENT', async () => {
        const mockSettlement = {
          id: 'settlement-1',
          storage: {
            id: 'storage-1',
            food: 50,
            water: 100,
            wood: 5, // Insufficient for TENT (needs 10)
            stone: 30,
            ore: 0,
            capacity: 5000,
          },
        };

        mockTransaction.query.settlements.findFirst.mockResolvedValue(mockSettlement);

        const result = await checkResourceAvailability(
          mockTransaction as any,
          'settlement-1',
          'TENT'
        );

        expect(result.success).toBe(false);
        expect(result.shortages).toHaveLength(1);
        expect(result.shortages!).toBeDefined();
        expect(result.shortages![0]).toEqual({
          type: 'wood',
          required: 10,
          available: 5,
          missing: 5,
        });
      });

      it('should fail with insufficient stone for FARM', async () => {
        const mockSettlement = {
          id: 'settlement-1',
          storage: {
            id: 'storage-1',
            food: 50,
            water: 100,
            wood: 50, // Sufficient
            stone: 5, // Insufficient (needs 10)
            ore: 0,
            capacity: 5000,
          },
        };

        mockTransaction.query.settlements.findFirst.mockResolvedValue(mockSettlement);

        const result = await checkResourceAvailability(
          mockTransaction as any,
          'settlement-1',
          'FARM'
        );

        expect(result.success).toBe(false);
        expect(result.shortages).toHaveLength(1);
        expect(result.shortages!).toBeDefined();
        expect(result.shortages![0]).toEqual({
          type: 'stone',
          required: 10,
          available: 5,
          missing: 5,
        });
      });

      it('should fail with zero resources for FARM', async () => {
        const mockSettlement = {
          id: 'settlement-1',
          storage: {
            id: 'storage-1',
            food: 50,
            water: 100,
            wood: 0, // None available
            stone: 0,
            ore: 0,
            capacity: 5000,
          },
        };

        mockTransaction.query.settlements.findFirst.mockResolvedValue(mockSettlement);

        const result = await checkResourceAvailability(
          mockTransaction as any,
          'settlement-1',
          'FARM'
        );

        expect(result.success).toBe(false);
        expect(result.shortages).toHaveLength(2);
        expect(result.shortages).toEqual(
          expect.arrayContaining([
            { resource: 'wood', required: 20, available: 0, shortage: 20 },
            { resource: 'stone', required: 10, available: 0, shortage: 10 },
          ])
        );
      });
    });

    describe('Failure Cases - Multiple Resource Shortages', () => {
      it('should report all shortages for WORKSHOP when multiple resources insufficient', async () => {
        const mockSettlement = {
          id: 'settlement-1',
          storage: {
            id: 'storage-1',
            food: 50,
            water: 100,
            wood: 20, // Insufficient (needs 60)
            stone: 30, // Insufficient (needs 60)
            ore: 10, // Insufficient (needs 30)
            capacity: 5000,
          },
        };

        mockTransaction.query.settlements.findFirst.mockResolvedValue(mockSettlement);

        const result = await checkResourceAvailability(
          mockTransaction as any,
          'settlement-1',
          'WORKSHOP'
        );

        expect(result.success).toBe(false);
        expect(result.shortages).toHaveLength(3);
        expect(result.shortages).toEqual(
          expect.arrayContaining([
            { resource: 'wood', required: 60, available: 20, shortage: 40 },
            { resource: 'stone', required: 60, available: 30, shortage: 30 },
            { resource: 'ore', required: 30, available: 10, shortage: 20 },
          ])
        );
      });

      it('should report wood and stone shortages for HOUSE', async () => {
        const mockSettlement = {
          id: 'settlement-1',
          storage: {
            id: 'storage-1',
            food: 50,
            water: 100,
            wood: 10, // Insufficient (needs 50)
            stone: 5, // Insufficient (needs 20)
            ore: 0,
            capacity: 5000,
          },
        };

        mockTransaction.query.settlements.findFirst.mockResolvedValue(mockSettlement);

        const result = await checkResourceAvailability(
          mockTransaction as any,
          'settlement-1',
          'HOUSE'
        );

        expect(result.success).toBe(false);
        expect(result.shortages).toHaveLength(2);
        expect(result.shortages).toEqual(
          expect.arrayContaining([
            { resource: 'wood', required: 50, available: 10, shortage: 40 },
            { resource: 'stone', required: 20, available: 5, shortage: 15 },
          ])
        );
      });
    });

    describe('Error Cases', () => {
      it('should throw error when settlement not found', async () => {
        mockTransaction.query.settlements.findFirst.mockResolvedValue(null);

        await expect(
          checkResourceAvailability(mockTransaction as any, 'nonexistent-settlement', 'TENT')
        ).rejects.toThrow('Settlement not found');
      });

      it('should throw error when settlement has no storage', async () => {
        const mockSettlement = {
          id: 'settlement-1',
          storage: null,
        };

        mockTransaction.query.settlements.findFirst.mockResolvedValue(mockSettlement);

        await expect(
          checkResourceAvailability(mockTransaction as any, 'settlement-1', 'TENT')
        ).rejects.toThrow('Settlement storage not found');
      });

      it('should throw error for unknown structure type', async () => {
        const mockSettlement = {
          id: 'settlement-1',
          storage: {
            id: 'storage-1',
            food: 50,
            water: 100,
            wood: 50,
            stone: 30,
            ore: 0,
            capacity: 5000,
          },
        };

        mockTransaction.query.settlements.findFirst.mockResolvedValue(mockSettlement);

        await expect(
          checkResourceAvailability(mockTransaction as any, 'settlement-1', 'UNKNOWN_STRUCTURE')
        ).rejects.toThrow('Unknown structure type: UNKNOWN_STRUCTURE');
      });
    });
  });

  describe('validateAndDeductResources', () => {
    describe('Success Cases with Resource Deduction', () => {
      it('should validate and deduct resources for TENT', async () => {
        const mockSettlement = {
          id: 'settlement-1',
          storage: {
            id: 'storage-1',
            food: 50,
            water: 100,
            wood: 50,
            stone: 30,
            ore: 0,
            capacity: 5000,
          },
        };

        mockTransaction.query.settlements.findFirst.mockResolvedValue(mockSettlement);
        mockTransaction.update.mockResolvedValue([
          {
            id: 'storage-1',
            food: 50,
            water: 100,
            wood: 40, // Deducted 10
            stone: 30,
            ore: 0,
          },
        ]);

        const result = await validateAndDeductResources(
          mockTransaction as any,
          'settlement-1',
          'TENT'
        );

        expect(result.success).toBe(true);
        expect(result.shortages).toEqual([]);
        expect(result.deductedResources).toEqual({
          wood: 10,
          stone: 0,
          ore: 0,
        });

        // Verify update was called with correct values
        expect(mockTransaction.update).toHaveBeenCalledTimes(1);
        const updateCall = mockTransaction.update.mock.calls[0];
        expect(updateCall[1]).toEqual({
          food: 50,
          water: 100,
          wood: 40, // 50 - 10
          stone: 30,
          ore: 0,
          capacity: 5000,
        });
      });

      it('should validate and deduct resources for FARM', async () => {
        const mockSettlement = {
          id: 'settlement-1',
          storage: {
            id: 'storage-1',
            food: 50,
            water: 100,
            wood: 50,
            stone: 30,
            ore: 0,
            capacity: 5000,
          },
        };

        mockTransaction.query.settlements.findFirst.mockResolvedValue(mockSettlement);
        mockTransaction.update.mockResolvedValue([
          {
            id: 'storage-1',
            food: 50,
            water: 100,
            wood: 30, // Deducted 20
            stone: 20, // Deducted 10
            ore: 0,
          },
        ]);

        const result = await validateAndDeductResources(
          mockTransaction as any,
          'settlement-1',
          'FARM'
        );

        expect(result.success).toBe(true);
        expect(result.deductedResources).toEqual({
          wood: 20,
          stone: 10,
          ore: 0,
        });

        // Verify update called with correct deductions
        const updateCall = mockTransaction.update.mock.calls[0];
        expect(updateCall[1]).toEqual({
          food: 50,
          water: 100,
          wood: 30, // 50 - 20
          stone: 20, // 30 - 10
          ore: 0,
          capacity: 5000,
        });
      });

      it('should validate and deduct all three resources for WORKSHOP', async () => {
        const mockSettlement = {
          id: 'settlement-1',
          storage: {
            id: 'storage-1',
            food: 100,
            water: 200,
            wood: 100,
            stone: 100,
            ore: 50,
            capacity: 5000,
          },
        };

        mockTransaction.query.settlements.findFirst.mockResolvedValue(mockSettlement);
        mockTransaction.update.mockResolvedValue([
          {
            id: 'storage-1',
            food: 100,
            water: 200,
            wood: 40, // Deducted 60
            stone: 40, // Deducted 60
            ore: 20, // Deducted 30
          },
        ]);

        const result = await validateAndDeductResources(
          mockTransaction as any,
          'settlement-1',
          'WORKSHOP'
        );

        expect(result.success).toBe(true);
        expect(result.deductedResources).toEqual({
          wood: 60,
          stone: 60,
          ore: 30,
        });

        const updateCall = mockTransaction.update.mock.calls[0];
        expect(updateCall[1]).toEqual({
          food: 100,
          water: 200,
          wood: 40, // 100 - 60
          stone: 40, // 100 - 60
          ore: 20, // 50 - 30
          capacity: 5000,
        });
      });
    });

    describe('Failure Cases - No Deduction on Failure', () => {
      it('should NOT deduct resources when validation fails', async () => {
        const mockSettlement = {
          id: 'settlement-1',
          storage: {
            id: 'storage-1',
            food: 50,
            water: 100,
            wood: 5, // Insufficient
            stone: 30,
            ore: 0,
            capacity: 5000,
          },
        };

        mockTransaction.query.settlements.findFirst.mockResolvedValue(mockSettlement);

        const result = await validateAndDeductResources(
          mockTransaction as any,
          'settlement-1',
          'TENT'
        );

        expect(result.success).toBe(false);
        expect(result.shortages).toHaveLength(1);
        expect(result.deductedResources).toEqual({
          wood: 0,
          stone: 0,
          ore: 0,
        });

        // Verify update was NEVER called
        expect(mockTransaction.update).not.toHaveBeenCalled();
      });

      it('should NOT deduct resources when multiple resources insufficient', async () => {
        const mockSettlement = {
          id: 'settlement-1',
          storage: {
            id: 'storage-1',
            food: 50,
            water: 100,
            wood: 10, // Insufficient
            stone: 5, // Insufficient
            ore: 0,
            capacity: 5000,
          },
        };

        mockTransaction.query.settlements.findFirst.mockResolvedValue(mockSettlement);

        const result = await validateAndDeductResources(
          mockTransaction as any,
          'settlement-1',
          'HOUSE'
        );

        expect(result.success).toBe(false);
        expect(result.shortages).toHaveLength(2);

        // Verify update was NEVER called (atomic operation)
        expect(mockTransaction.update).not.toHaveBeenCalled();
      });
    });

    describe('Atomicity Tests', () => {
      it('should be atomic - either all resources deducted or none', async () => {
        const mockSettlement = {
          id: 'settlement-1',
          storage: {
            id: 'storage-1',
            food: 50,
            water: 100,
            wood: 60, // Sufficient
            stone: 60, // Sufficient
            ore: 10, // Insufficient for WORKSHOP (needs 30)
            capacity: 5000,
          },
        };

        mockTransaction.query.settlements.findFirst.mockResolvedValue(mockSettlement);

        const result = await validateAndDeductResources(
          mockTransaction as any,
          'settlement-1',
          'WORKSHOP'
        );

        expect(result.success).toBe(false);
        expect(result.shortages).toHaveLength(1);
        expect(result.shortages!).toBeDefined();
        expect(result.shortages![0].type).toBe('ore');

        // CRITICAL: No resources should be deducted even though wood and stone were sufficient
        expect(mockTransaction.update).not.toHaveBeenCalled();
        expect(result.deductedResources).toEqual({
          wood: 0,
          stone: 0,
          ore: 0,
        });
      });
    });
  });

  describe('Integration with structure-costs.ts', () => {
    it('should use correct costs from getStructureCost', () => {
      const tentCost = getStructureCost('TENT');
      expect(tentCost).toEqual({ wood: 10, stone: 0, ore: 0, time: 0, population: 0 });

      const farmCost = getStructureCost('FARM');
      expect(farmCost).toEqual({ wood: 20, stone: 10, ore: 0, time: 180, population: 2 });

      const workshopCost = getStructureCost('WORKSHOP');
      expect(workshopCost).toEqual({ wood: 60, stone: 60, ore: 30, time: 900, population: 2 });
    });

    it('should calculate upgrade costs correctly', () => {
      const level2Cost = getUpgradeCost('HOUSE', 2);
      const baseCost = getStructureCost('HOUSE');

      // Both should be defined
      expect(level2Cost).toBeDefined();
      expect(baseCost).toBeDefined();

      // Level 2 should cost 1.5x base cost
      expect(level2Cost!.wood).toBe(Math.floor(baseCost!.wood * 1.5));
      expect(level2Cost!.stone).toBe(Math.floor(baseCost!.stone * 1.5));
    });
  });

  describe('Edge Cases', () => {
    it('should handle structures with only one resource type', () => {
      const tentCost = getStructureCost('TENT');
      expect(tentCost).toBeDefined();
      expect(tentCost!.wood).toBeGreaterThan(0);
      expect(tentCost!.stone).toBe(0);
      expect(tentCost!.ore).toBe(0);
    });

    it('should handle structures with all three resource types', () => {
      const workshopCost = getStructureCost('WORKSHOP');
      expect(workshopCost).toBeDefined();
      expect(workshopCost!.wood).toBeGreaterThan(0);
      expect(workshopCost!.stone).toBeGreaterThan(0);
      expect(workshopCost!.ore).toBeGreaterThan(0);
    });

    it('should handle exact resource match (no surplus)', async () => {
      const mockSettlement = {
        id: 'settlement-1',
        storage: {
          id: 'storage-1',
          food: 50,
          water: 100,
          wood: 20, // Exactly enough for FARM
          stone: 10, // Exactly enough for FARM
          ore: 0,
          capacity: 5000,
        },
      };

      mockTransaction.query.settlements.findFirst.mockResolvedValue(mockSettlement);
      mockTransaction.update.mockResolvedValue([
        {
          id: 'storage-1',
          food: 50,
          water: 100,
          wood: 0, // All deducted
          stone: 0, // All deducted
          ore: 0,
        },
      ]);

      const result = await validateAndDeductResources(
        mockTransaction as any,
        'settlement-1',
        'FARM'
      );

      expect(result.success).toBe(true);
      expect(result.deductedResources).toEqual({
        wood: 20,
        stone: 10,
        ore: 0,
      });

      const updateCall = mockTransaction.update.mock.calls[0];
      expect(updateCall[1].wood).toBe(0);
      expect(updateCall[1].stone).toBe(0);
    });
  });
});
