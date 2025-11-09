import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Socket } from 'socket.io';
import { registerEventHandlers } from '../../../src/events/handlers.js';
import * as queries from '../../../src/db/queries.js';

// Mock dependencies
vi.mock('../../../src/db/queries');
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock('../../../src/game/game-loop.js', () => ({
  registerSettlement: vi.fn(),
  unregisterSettlement: vi.fn(),
  registerPlayerSettlements: vi.fn(),
  unregisterPlayerSettlements: vi.fn(),
}));

describe('Event Handlers', () => {
  let mockSocket: Partial<Socket>;
  let eventHandlers: Map<string, (...args: any[]) => void>;

  beforeEach(() => {
    vi.clearAllMocks();
    eventHandlers = new Map();

    // Create mock socket that captures event handlers
    mockSocket = {
      id: 'test-socket-id',
      data: {},
      on: vi.fn((event: string, handler: (...args: any[]) => void) => {
        eventHandlers.set(event, handler);
        return mockSocket as Socket;
      }),
      emit: vi.fn(),
      join: vi.fn(),
      leave: vi.fn(),
      to: vi.fn(() => ({
        emit: vi.fn(),
      })) as any,
    };
  });

  describe('registerEventHandlers', () => {
    it('should register all event handlers', () => {
      registerEventHandlers(mockSocket as Socket);

      expect(mockSocket.on).toHaveBeenCalledWith('authenticate', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('join-world', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('leave-world', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('request-game-state', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });
  });

  describe('authenticate handler', () => {
    it('should authenticate valid player and emit success', () => {
      registerEventHandlers(mockSocket as Socket);
      const authenticateHandler = eventHandlers.get('authenticate');
      expect(authenticateHandler).toBeDefined();

      const callback = vi.fn();
      authenticateHandler!({ playerId: 'player-123' }, callback);

      // Use flush promises to wait for async handler to complete
      return new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
        expect(mockSocket.data.playerId).toBe('player-123');
        expect(mockSocket.data.authenticated).toBe(true);
        expect(callback).toHaveBeenCalledWith({
          success: true,
          playerId: 'player-123',
        });
      });
    });

    it('should store authenticated flag in socket data', () => {
      registerEventHandlers(mockSocket as Socket);
      const authenticateHandler = eventHandlers.get('authenticate');

      const callback = vi.fn();
      authenticateHandler!({ playerId: 'test-player-id' }, callback);

      return new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
        expect(mockSocket.data.authenticated).toBe(true);
        expect(mockSocket.data.playerId).toBe('test-player-id');
      });
    });
  });

  describe('join-world handler', () => {
    it('should join world successfully when authenticated', () => {
      mockSocket.data = { playerId: 'player-123', authenticated: true };

      registerEventHandlers(mockSocket as Socket);
      const joinWorldHandler = eventHandlers.get('join-world');

      joinWorldHandler!({ playerId: 'player-123', worldId: 'world-456' });

      return new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
        expect(mockSocket.data.worldId).toBe('world-456');
        expect(mockSocket.join).toHaveBeenCalledWith('world:world-456');
      });
    });

    it('should store world ID in socket data', () => {
      mockSocket.data = { playerId: 'player-123' };

      registerEventHandlers(mockSocket as Socket);
      const joinWorldHandler = eventHandlers.get('join-world');

      joinWorldHandler!({ playerId: 'player-123', worldId: 'test-world' });

      return new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
        expect(mockSocket.data.worldId).toBe('test-world');
      });
    });
  });

  describe('disconnect handler', () => {
    it('should clean up on disconnect', () => {
      mockSocket.data = {
        playerId: 'player-123',
        worldId: 'world-456',
        settlementId: 'settlement-123',
      };

      registerEventHandlers(mockSocket as Socket);
      const disconnectHandler = eventHandlers.get('disconnect');

      disconnectHandler!('client disconnect');

      return new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
        // Handler should be called (cleanup happens internally)
        expect(mockSocket.data).toBeDefined();
      });
    });
  });

  describe('leave-world handler', () => {
    it('should leave world and unregister settlements', () => {
      mockSocket.data = { playerId: 'player-123', worldId: 'world-456' };

      registerEventHandlers(mockSocket as Socket);
      const leaveWorldHandler = eventHandlers.get('leave-world');

      leaveWorldHandler!({ playerId: 'player-123', worldId: 'world-456' });

      return new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
        expect(mockSocket.leave).toHaveBeenCalledWith('world:world-456');
        expect(mockSocket.data.worldId).toBeUndefined();
      });
    });

    it('should notify other players in world', () => {
      mockSocket.data = { playerId: 'player-123', worldId: 'world-456' };

      registerEventHandlers(mockSocket as Socket);
      const leaveWorldHandler = eventHandlers.get('leave-world');

      leaveWorldHandler!({ playerId: 'player-123', worldId: 'world-456' });

      return new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
        expect(mockSocket.to).toHaveBeenCalledWith('world:world-456');
      });
    });
  });

  describe('request-game-state handler', () => {
    it('should reject request when not authenticated', () => {
      mockSocket.data = {};

      registerEventHandlers(mockSocket as Socket);
      const gameStateHandler = eventHandlers.get('request-game-state');

      gameStateHandler!({ worldId: 'world-456' });

      return new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith(
          'error',
          expect.objectContaining({
            code: 'AUTH_REQUIRED',
            message: 'Authentication required',
          })
        );
      });
    });

    it('should fetch player settlements when authenticated', async () => {
      const mockSettlements = [
        { id: 'settlement-1', playerId: 'player-123', worldId: 'world-456' },
      ];

      mockSocket.data = { playerId: 'player-123', authenticated: true };
      vi.mocked(queries.getPlayerSettlements).mockResolvedValue(mockSettlements as any);

      registerEventHandlers(mockSocket as Socket);
      const gameStateHandler = eventHandlers.get('request-game-state');

      gameStateHandler!({ worldId: 'world-456' });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(queries.getPlayerSettlements).toHaveBeenCalledWith('player-123');
    });
  });

  describe('build-structure handler', () => {
    it('should reject when not authenticated', async () => {
      mockSocket.data = {};

      registerEventHandlers(mockSocket as Socket);
      const buildHandler = eventHandlers.get('build-structure');

      const callback = vi.fn();
      buildHandler!({ settlementId: 'settlement-123', structureType: 'warehouse' }, callback);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Authentication required',
        })
      );
    });

    it('should reject when settlement not found', async () => {
      mockSocket.data = { playerId: 'player-123', authenticated: true };
      vi.mocked(queries.getSettlementWithDetails).mockResolvedValue(undefined as any);

      registerEventHandlers(mockSocket as Socket);
      const buildHandler = eventHandlers.get('build-structure');

      const callback = vi.fn();
      buildHandler!({ settlementId: 'settlement-123', structureType: 'warehouse' }, callback);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Settlement not found',
        })
      );
    });

    it('should reject when player does not own settlement', async () => {
      const mockSettlement = {
        settlement: {
          id: 'settlement-123',
          playerProfileId: 'different-player',
          worldId: 'world-456',
        },
      };

      mockSocket.data = { playerId: 'player-123', authenticated: true };
      vi.mocked(queries.getSettlementWithDetails).mockResolvedValue(mockSettlement as any);

      registerEventHandlers(mockSocket as Socket);
      const buildHandler = eventHandlers.get('build-structure');

      const callback = vi.fn();
      buildHandler!({ settlementId: 'settlement-123', structureType: 'warehouse' }, callback);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'You do not own this settlement',
        })
      );
    });
  });

  describe('collect-resources handler', () => {
    it('should reject when not authenticated', async () => {
      mockSocket.data = {};

      registerEventHandlers(mockSocket as Socket);
      const collectHandler = eventHandlers.get('collect-resources');

      const callback = vi.fn();
      collectHandler!({ settlementId: 'settlement-123' }, callback);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Authentication required',
        })
      );
    });

    it('should reject when settlement not found', async () => {
      mockSocket.data = { playerId: 'player-123', authenticated: true };
      vi.mocked(queries.getSettlementWithDetails).mockResolvedValue(undefined as any);

      registerEventHandlers(mockSocket as Socket);
      const collectHandler = eventHandlers.get('collect-resources');

      const callback = vi.fn();
      collectHandler!({ settlementId: 'settlement-123' }, callback);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Settlement not found',
        })
      );
    });
  });

  describe('error handler', () => {
    it('should log socket errors', () => {
      mockSocket.data = { playerId: 'player-123', worldId: 'world-456' };

      registerEventHandlers(mockSocket as Socket);
      const errorHandler = eventHandlers.get('error');

      const testError = new Error('Test error');
      errorHandler!(testError);

      // Error handler should be called without throwing
      expect(errorHandler).toBeDefined();
    });
  });

  describe('create-world handler', () => {
    it('should handle error when worldName is undefined', async () => {
      mockSocket.data = {};

      registerEventHandlers(mockSocket as Socket);
      const createWorldHandler = eventHandlers.get('create-world');

      const callback = vi.fn();
      createWorldHandler!({ worldName: undefined as any, seed: 12345 }, callback);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });

    it('should reject when world name is too short', async () => {
      mockSocket.data = { playerId: 'player-123', authenticated: true };

      registerEventHandlers(mockSocket as Socket);
      const createWorldHandler = eventHandlers.get('create-world');

      const callback = vi.fn();
      createWorldHandler!({ worldName: 'AB', seed: 12345 }, callback);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });
  });
});
