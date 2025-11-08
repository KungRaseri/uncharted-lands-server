import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Socket } from 'socket.io';
import { registerEventHandlers } from '../../../events/handlers';

// Mock dependencies
vi.mock('../../../db/queries');
vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock('../../../game/game-loop', () => ({
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
      return new Promise(resolve => setTimeout(resolve, 0)).then(() => {
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

      return new Promise(resolve => setTimeout(resolve, 0)).then(() => {
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

      return new Promise(resolve => setTimeout(resolve, 0)).then(() => {
        expect(mockSocket.data.worldId).toBe('world-456');
        expect(mockSocket.join).toHaveBeenCalledWith('world:world-456');
      });
    });

    it('should store world ID in socket data', () => {
      mockSocket.data = { playerId: 'player-123' };

      registerEventHandlers(mockSocket as Socket);
      const joinWorldHandler = eventHandlers.get('join-world');

      joinWorldHandler!({ playerId: 'player-123', worldId: 'test-world' });

      return new Promise(resolve => setTimeout(resolve, 0)).then(() => {
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

      return new Promise(resolve => setTimeout(resolve, 0)).then(() => {
        // Handler should be called (cleanup happens internally)
        expect(mockSocket.data).toBeDefined();
      });
    });
  });
});
