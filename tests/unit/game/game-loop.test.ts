/**
 * Game Loop Tests
 *
 * Tests for the 60Hz tick system that handles automatic resource generation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  startGameLoop,
  stopGameLoop,
  registerSettlement,
  unregisterSettlement,
  getGameLoopStatus,
} from '../../../src/game/game-loop.js';

// Mock Socket.IO
const mockIo = {
  to: vi.fn().mockReturnThis(),
  emit: vi.fn(),
};

// Mock database queries
vi.mock('../../../src/db/queries.js', () => ({
  getPlayerSettlements: vi.fn(),
  updateSettlementStorage: vi.fn(),
  getSettlementWithDetails: vi.fn(),
  getSettlementStructures: vi.fn(),
}));

// Mock resource calculator
vi.mock('../../../src/game/resource-calculator.js', () => ({
  calculateProduction: vi.fn(() => ({
    food: 10,
    water: 10,
    wood: 5,
    stone: 3,
    ore: 1,
  })),
  addResources: vi.fn((a, b) => ({
    food: a.food + b.food,
    water: a.water + b.water,
    wood: a.wood + b.wood,
    stone: a.stone + b.stone,
    ore: a.ore + b.ore,
  })),
  subtractResources: vi.fn((a, b) => ({
    food: a.food - b.food,
    water: a.water - b.water,
    wood: a.wood - b.wood,
    stone: a.stone - b.stone,
    ore: a.ore - b.ore,
  })),
}));

// Mock consumption calculator
vi.mock('../../../src/game/consumption-calculator.js', () => ({
  calculatePopulation: vi.fn(() => 10),
  calculateConsumption: vi.fn(() => ({
    food: 5,
    water: 5,
    wood: 0,
    stone: 0,
    ore: 0,
  })),
  hasResourcesForPopulation: vi.fn(() => true),
}));

// Mock storage calculator
vi.mock('../../../src/game/storage-calculator.js', () => ({
  calculateStorageCapacity: vi.fn(() => ({
    food: 1000,
    water: 1000,
    wood: 500,
    stone: 500,
    ore: 200,
  })),
  clampToCapacity: vi.fn((resources) => resources),
  calculateWaste: vi.fn(() => ({
    food: 0,
    water: 0,
    wood: 0,
    stone: 0,
    ore: 0,
  })),
  isNearCapacity: vi.fn(() => ({
    food: false,
    water: false,
    wood: false,
    stone: false,
    ore: false,
  })),
}));

describe('Game Loop', () => {
  beforeEach(() => {
    // Stop any running game loop before each test
    // This also clears all settlements
    const status = getGameLoopStatus();
    if (status.isRunning) {
      stopGameLoop();
    }

    // If not running but still has settlements, clear them by stopping
    if (!status.isRunning && status.activeSettlements > 0) {
      startGameLoop(mockIo as any);
      stopGameLoop();
    }

    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up after each test
    const status = getGameLoopStatus();
    if (status.isRunning) {
      stopGameLoop();
    }
  });

  describe('Game Loop Control', () => {
    it('should start the game loop', () => {
      expect(getGameLoopStatus().isRunning).toBe(false);
      startGameLoop(mockIo as any);
      expect(getGameLoopStatus().isRunning).toBe(true);
    });

    it('should not start if already running', () => {
      startGameLoop(mockIo as any);
      expect(getGameLoopStatus().isRunning).toBe(true);

      // Try to start again
      startGameLoop(mockIo as any);
      expect(getGameLoopStatus().isRunning).toBe(true);
    });

    it('should stop the game loop', () => {
      startGameLoop(mockIo as any);
      expect(getGameLoopStatus().isRunning).toBe(true);

      stopGameLoop();
      expect(getGameLoopStatus().isRunning).toBe(false);
    });

    it('should not error when stopping if not running', () => {
      expect(getGameLoopStatus().isRunning).toBe(false);
      expect(() => stopGameLoop()).not.toThrow();
    });

    it('should reset state when stopped', () => {
      registerSettlement('settlement-1', 'player-1', 'world-1');
      expect(getGameLoopStatus().activeSettlements).toBe(1);

      startGameLoop(mockIo as any);
      stopGameLoop();

      expect(getGameLoopStatus().isRunning).toBe(false);
      expect(getGameLoopStatus().activeSettlements).toBe(0);
    });
  });

  describe('Settlement Registration', () => {
    it('should register a settlement', () => {
      registerSettlement('settlement-1', 'player-1', 'world-1');
      expect(getGameLoopStatus().activeSettlements).toBe(1);
    });

    it('should not register duplicate settlements', () => {
      registerSettlement('settlement-1', 'player-1', 'world-1');
      registerSettlement('settlement-1', 'player-1', 'world-1');
      expect(getGameLoopStatus().activeSettlements).toBe(1);
    });

    it('should register multiple settlements', () => {
      registerSettlement('settlement-1', 'player-1', 'world-1');
      registerSettlement('settlement-2', 'player-1', 'world-1');
      registerSettlement('settlement-3', 'player-2', 'world-1');
      expect(getGameLoopStatus().activeSettlements).toBe(3);
    });

    it('should unregister a settlement', () => {
      registerSettlement('settlement-1', 'player-1', 'world-1');
      expect(getGameLoopStatus().activeSettlements).toBe(1);

      unregisterSettlement('settlement-1');
      expect(getGameLoopStatus().activeSettlements).toBe(0);
    });

    it('should handle unregistering non-existent settlement', () => {
      expect(() => unregisterSettlement('non-existent')).not.toThrow();
      expect(getGameLoopStatus().activeSettlements).toBe(0);
    });

    it('should unregister specific settlement from many', () => {
      registerSettlement('settlement-1', 'player-1', 'world-1');
      registerSettlement('settlement-2', 'player-1', 'world-1');
      registerSettlement('settlement-3', 'player-2', 'world-1');

      unregisterSettlement('settlement-2');
      expect(getGameLoopStatus().activeSettlements).toBe(2);
    });
  });

  describe('Active Settlement Count', () => {
    it('should return 0 when no settlements registered', () => {
      expect(getGameLoopStatus().activeSettlements).toBe(0);
    });

    it('should return correct count with multiple settlements', () => {
      registerSettlement('settlement-1', 'player-1', 'world-1');
      registerSettlement('settlement-2', 'player-1', 'world-1');
      registerSettlement('settlement-3', 'player-2', 'world-1');

      expect(getGameLoopStatus().activeSettlements).toBe(3);
    });

    it('should update count after unregistering', () => {
      registerSettlement('settlement-1', 'player-1', 'world-1');
      registerSettlement('settlement-2', 'player-1', 'world-1');

      expect(getGameLoopStatus().activeSettlements).toBe(2);

      unregisterSettlement('settlement-1');
      expect(getGameLoopStatus().activeSettlements).toBe(1);
    });
  });

  describe('Game Loop State', () => {
    it('should track running state correctly', () => {
      expect(getGameLoopStatus().isRunning).toBe(false);

      startGameLoop(mockIo as any);
      expect(getGameLoopStatus().isRunning).toBe(true);

      stopGameLoop();
      expect(getGameLoopStatus().isRunning).toBe(false);
    });

    it('should maintain state across multiple start/stop cycles', () => {
      // First cycle
      startGameLoop(mockIo as any);
      expect(getGameLoopStatus().isRunning).toBe(true);
      stopGameLoop();
      expect(getGameLoopStatus().isRunning).toBe(false);

      // Second cycle
      startGameLoop(mockIo as any);
      expect(getGameLoopStatus().isRunning).toBe(true);
      stopGameLoop();
      expect(getGameLoopStatus().isRunning).toBe(false);
    });

    it('should track tick count', () => {
      const status = getGameLoopStatus();
      expect(status.currentTick).toBeDefined();
      expect(typeof status.currentTick).toBe('number');
    });

    it('should report tick rate', () => {
      const status = getGameLoopStatus();
      expect(status.tickRate).toBeDefined();
      expect(typeof status.tickRate).toBe('number');
      expect(status.tickRate).toBeGreaterThan(0);
    });
  });

  describe('Batch Processing', () => {
    it('should handle empty settlement list', () => {
      startGameLoop(mockIo as any);
      expect(getGameLoopStatus().activeSettlements).toBe(0);
      // Should not error even with no settlements
    });

    it('should handle single settlement', () => {
      registerSettlement('settlement-1', 'player-1', 'world-1');
      startGameLoop(mockIo as any);
      expect(getGameLoopStatus().activeSettlements).toBe(1);
    });

    it('should handle many settlements (batch size testing)', () => {
      // Register more than batch size (10)
      for (let i = 1; i <= 15; i++) {
        registerSettlement(`settlement-${i}`, 'player-1', 'world-1');
      }
      expect(getGameLoopStatus().activeSettlements).toBe(15);

      startGameLoop(mockIo as any);
    });
  });

  describe('Tick Rate Configuration', () => {
    it('should use default tick rate', () => {
      // Default is 60 ticks per second
      startGameLoop(mockIo as any);
      expect(getGameLoopStatus().isRunning).toBe(true);
      expect(getGameLoopStatus().tickRate).toBe(60);
    });

    it('should start and stop cleanly with settlements registered', () => {
      registerSettlement('settlement-1', 'player-1', 'world-1');
      registerSettlement('settlement-2', 'player-1', 'world-1');

      startGameLoop(mockIo as any);
      expect(getGameLoopStatus().isRunning).toBe(true);

      stopGameLoop();
      expect(getGameLoopStatus().isRunning).toBe(false);
      expect(getGameLoopStatus().activeSettlements).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle registering settlement while loop is running', () => {
      startGameLoop(mockIo as any);

      registerSettlement('settlement-1', 'player-1', 'world-1');
      expect(getGameLoopStatus().activeSettlements).toBe(1);

      stopGameLoop();
    });

    it('should handle unregistering settlement while loop is running', () => {
      registerSettlement('settlement-1', 'player-1', 'world-1');
      startGameLoop(mockIo as any);

      unregisterSettlement('settlement-1');
      expect(getGameLoopStatus().activeSettlements).toBe(0);

      stopGameLoop();
    });

    it('should handle rapid start/stop cycles', () => {
      for (let i = 0; i < 5; i++) {
        startGameLoop(mockIo as any);
        expect(getGameLoopStatus().isRunning).toBe(true);
        stopGameLoop();
        expect(getGameLoopStatus().isRunning).toBe(false);
      }
    });
  });

  describe('Player Settlement Management', () => {
    it('should register all player settlements', async () => {
      const { getPlayerSettlements } = await import('../../../src/db/queries.js');
      const { registerPlayerSettlements } = await import('../../../src/game/game-loop.js');
      
      // Mock getPlayerSettlements to return settlements
      vi.mocked(getPlayerSettlements).mockResolvedValue([
        { id: 'settlement-1', name: 'Test Settlement 1' },
        { id: 'settlement-2', name: 'Test Settlement 2' },
      ] as any);
      
      await registerPlayerSettlements('player-1', 'world-1');

      const status = getGameLoopStatus();
      expect(status.activeSettlements).toBe(2);
    });

    it('should handle registering player settlements with no settlements', async () => {
      const { getPlayerSettlements } = await import('../../../src/db/queries.js');
      const { registerPlayerSettlements } = await import('../../../src/game/game-loop.js');
      
      // Mock getPlayerSettlements to return empty array
      vi.mocked(getPlayerSettlements).mockResolvedValue([]);
      
      // Player with no settlements
      await registerPlayerSettlements('player-no-settlements', 'world-1');

      const status = getGameLoopStatus();
      expect(status.activeSettlements).toBe(0);
    });

    it('should unregister all player settlements', async () => {
      const { getPlayerSettlements } = await import('../../../src/db/queries.js');
      const { registerPlayerSettlements, unregisterPlayerSettlements } = await import('../../../src/game/game-loop.js');
      
      // Mock getPlayerSettlements to return settlements
      vi.mocked(getPlayerSettlements).mockResolvedValue([
        { id: 'settlement-1', name: 'Test Settlement 1' },
        { id: 'settlement-2', name: 'Test Settlement 2' },
      ] as any);
      
      // Register settlements for player
      await registerPlayerSettlements('player-1', 'world-1');
      const beforeStatus = getGameLoopStatus();
      const beforeCount = beforeStatus.activeSettlements;
      expect(beforeCount).toBe(2);

      // Unregister all player settlements
      await unregisterPlayerSettlements('player-1');

      const afterStatus = getGameLoopStatus();
      expect(afterStatus.activeSettlements).toBe(0);
    });

    it('should handle unregistering player with no settlements', async () => {
      const { unregisterPlayerSettlements } = await import('../../../src/game/game-loop.js');
      
      // Attempt to unregister player with no settlements
      await unregisterPlayerSettlements('player-no-settlements');

      const status = getGameLoopStatus();
      expect(status.activeSettlements).toBe(0);
    });

    it('should only unregister settlements for specific player', async () => {
      const { getPlayerSettlements } = await import('../../../src/db/queries.js');
      const { registerPlayerSettlements, unregisterPlayerSettlements } = await import('../../../src/game/game-loop.js');
      
      // Mock getPlayerSettlements to return settlements for player-1
      vi.mocked(getPlayerSettlements).mockResolvedValue([
        { id: 'settlement-1', name: 'Test Settlement 1' },
        { id: 'settlement-2', name: 'Test Settlement 2' },
      ] as any);
      
      // Register settlements for player-1
      await registerPlayerSettlements('player-1', 'world-1');
      // Manually register a settlement for player-2
      registerSettlement('manual-settlement', 'player-2', 'world-1');
      
      const beforeStatus = getGameLoopStatus();
      expect(beforeStatus.activeSettlements).toBe(3);

      // Unregister only player-1's settlements
      await unregisterPlayerSettlements('player-1');

      const afterStatus = getGameLoopStatus();
      expect(afterStatus.activeSettlements).toBe(1); // Only player-2's settlement remains
    });
  });
});
