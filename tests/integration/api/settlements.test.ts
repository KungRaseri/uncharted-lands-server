import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import settlementsRouter from '../../../src/api/routes/settlements.js';
import * as db from '../../../src/db/index.js';
import { generateTestId } from '../../helpers/test-utils';

// Mock dependencies
vi.mock('../../../src/db/index.js', () => ({
  db: {
    query: {
      settlements: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      tiles: {
        findMany: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(),
    })),
  },
  settlements: {},
  settlementStorage: {},
  profiles: {},
  profileServerData: {},
  plots: {},
  tiles: {},
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@paralleldrive/cuid2', () => ({
  createId: () => generateTestId('cuid'),
}));

vi.mock('../../../src/api/middleware/auth.js', () => ({
  authenticate: (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer valid-token') {
      req.user = { id: 'user-123', email: 'test@example.com' };
      next();
    } else {
      res.status(403).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
  },
}));

describe('Settlements API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/settlements', settlementsRouter);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/settlements', () => {
    it('should return all settlements', async () => {
      const mockSettlements = [
        {
          id: generateTestId('settlement'),
          name: 'Settlement 1',
          plot: { tile: { biome: {} } },
          structures: [],
          storage: {},
        },
      ];

      vi.mocked(db.db.query.settlements.findMany).mockResolvedValue(mockSettlements as any);

      const response = await request(app).get('/api/settlements').expect(200);

      expect(response.body).toEqual(mockSettlements);
      expect(db.db.query.settlements.findMany).toHaveBeenCalledWith({
        where: undefined,
        with: expect.any(Object),
      });
    });

    it('should filter settlements by playerProfileId', async () => {
      const mockSettlements = [
        {
          id: generateTestId('settlement'),
          name: 'Settlement 1',
          playerProfileId: 'profile-123',
        },
      ];

      vi.mocked(db.db.query.settlements.findMany).mockResolvedValue(mockSettlements as any);

      const response = await request(app)
        .get('/api/settlements?playerProfileId=profile-123')
        .expect(200);

      expect(response.body).toEqual(mockSettlements);
    });

    it('should return 500 on database error', async () => {
      vi.mocked(db.db.query.settlements.findMany).mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/settlements').expect(500);

      expect(response.body.error).toBe('Failed to fetch settlements');
    });
  });

  describe('GET /api/settlements/:id', () => {
    it('should return a specific settlement', async () => {
      const mockSettlement = {
        id: 'settlement-123',
        name: 'Settlement 1',
        plot: { tile: { biome: {}, region: {} } },
        structures: [],
        storage: {},
      };

      vi.mocked(db.db.query.settlements.findFirst).mockResolvedValue(mockSettlement as any);

      const response = await request(app).get('/api/settlements/settlement-123').expect(200);

      expect(response.body).toEqual(mockSettlement);
    });

    it('should return 404 if settlement not found', async () => {
      vi.mocked(db.db.query.settlements.findFirst).mockResolvedValue(undefined);

      const response = await request(app).get('/api/settlements/nonexistent').expect(404);

      expect(response.body.error).toBe('Settlement not found');
    });

    it('should return 500 on database error', async () => {
      vi.mocked(db.db.query.settlements.findFirst).mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/settlements/settlement-123').expect(500);

      expect(response.body.error).toBe('Failed to fetch settlement');
    });
  });

  describe('POST /api/settlements', () => {
    const validRequest = {
      username: 'testuser',
      serverId: 'server-123',
      worldId: 'world-123',
      accountId: 'account-123',
      picture: 'https://example.com/pic.jpg',
    };

    it('should return 403 if not authenticated', async () => {
      const response = await request(app).post('/api/settlements').send(validRequest).expect(403);

      expect(response.body.code).toBe('UNAUTHORIZED');
    });

    it('should return 400 if missing required fields', async () => {
      const response = await request(app)
        .post('/api/settlements')
        .set('Authorization', 'Bearer valid-token')
        .send({ username: 'test' })
        .expect(400);

      expect(response.body.error).toBe('Missing required fields');
      expect(response.body.required).toContain('serverId');
    });

    it('should create a settlement successfully with all data', async () => {
      const mockTiles = [
        {
          id: 'tile-1',
          elevation: 10,
          precipitation: 200,
          temperature: 20,
          region: { worldId: 'world-123' },
          plots: [{ id: 'plot-1', food: 5, water: 5, wood: 5 }],
        },
      ];

      const mockSettlement = {
        id: generateTestId('settlement'),
        name: 'Home Settlement',
        plot: { tile: { biome: {}, region: { world: {} } } },
        storage: {},
        playerProfile: {},
      };

      vi.mocked(db.db.query.tiles.findMany).mockResolvedValue(mockTiles as any);
      vi.mocked(db.db.query.settlements.findFirst).mockResolvedValue(mockSettlement as any);

      const mockInsert = vi.fn(() => ({
        values: vi.fn().mockResolvedValue(undefined),
      }));
      vi.mocked(db.db.insert).mockImplementation(mockInsert as any);

      const response = await request(app)
        .post('/api/settlements')
        .set('Authorization', 'Bearer valid-token')
        .send(validRequest)
        .expect(201);

      expect(response.body).toEqual(mockSettlement);
      expect(db.db.insert).toHaveBeenCalledTimes(4); // profile, profileServerData, storage, settlement
    });

    it('should create settlement without picture (default placeholder)', async () => {
      const requestWithoutPicture = {
        username: 'testuser',
        serverId: 'server-123',
        worldId: 'world-123',
        accountId: 'account-123',
      };

      const mockTiles = [
        {
          region: { worldId: 'world-123' },
          plots: [{ id: 'plot-1', food: 5, water: 5, wood: 5 }],
        },
      ];

      const mockSettlement = { id: generateTestId('settlement'), name: 'Home Settlement' };

      vi.mocked(db.db.query.tiles.findMany).mockResolvedValue(mockTiles as any);
      vi.mocked(db.db.query.settlements.findFirst).mockResolvedValue(mockSettlement as any);

      const mockInsert = vi.fn(() => ({
        values: vi.fn().mockResolvedValue(undefined),
      }));
      vi.mocked(db.db.insert).mockImplementation(mockInsert as any);

      const response = await request(app)
        .post('/api/settlements')
        .set('Authorization', 'Bearer valid-token')
        .send(requestWithoutPicture)
        .expect(201);

      expect(response.body.id).toBeDefined();
    });

    it('should return 404 if no suitable plots found', async () => {
      vi.mocked(db.db.query.tiles.findMany).mockResolvedValue([]);

      const response = await request(app)
        .post('/api/settlements')
        .set('Authorization', 'Bearer valid-token')
        .send(validRequest)
        .expect(404);

      expect(response.body.code).toBe('NO_VIABLE_PLOTS');
    });

    it('should return 404 if no viable plots with sufficient resources', async () => {
      const mockTiles = [
        {
          region: { worldId: 'world-123' },
          plots: [
            { id: 'plot-1', food: 1, water: 1, wood: 1 }, // Insufficient resources
          ],
        },
      ];

      vi.mocked(db.db.query.tiles.findMany).mockResolvedValue(mockTiles as any);

      const response = await request(app)
        .post('/api/settlements')
        .set('Authorization', 'Bearer valid-token')
        .send(validRequest)
        .expect(404);

      expect(response.body.code).toBe('INSUFFICIENT_RESOURCES');
    });

    it('should use relaxed criteria if no ideal plots', async () => {
      const mockTiles = [
        {
          region: { worldId: 'world-123' },
          plots: [
            { id: 'plot-1', food: 2, water: 2, wood: 2 }, // Meets relaxed criteria
          ],
        },
      ];

      const mockSettlement = { id: generateTestId('settlement'), name: 'Home Settlement' };

      vi.mocked(db.db.query.tiles.findMany).mockResolvedValue(mockTiles as any);
      vi.mocked(db.db.query.settlements.findFirst).mockResolvedValue(mockSettlement as any);

      const mockInsert = vi.fn(() => ({
        values: vi.fn().mockResolvedValue(undefined),
      }));
      vi.mocked(db.db.insert).mockImplementation(mockInsert as any);

      const response = await request(app)
        .post('/api/settlements')
        .set('Authorization', 'Bearer valid-token')
        .send(validRequest)
        .expect(201);

      expect(response.body.id).toBeDefined();
    });

    it('should return 409 on duplicate entry (unique constraint)', async () => {
      const mockTiles = [
        {
          region: { worldId: 'world-123' },
          plots: [{ id: 'plot-1', food: 5, water: 5, wood: 5 }],
        },
      ];

      vi.mocked(db.db.query.tiles.findMany).mockResolvedValue(mockTiles as any);

      const mockInsert = vi.fn(() => ({
        values: vi.fn().mockRejectedValue(new Error('unique constraint violation')),
      }));
      vi.mocked(db.db.insert).mockImplementation(mockInsert as any);

      const response = await request(app)
        .post('/api/settlements')
        .set('Authorization', 'Bearer valid-token')
        .send(validRequest)
        .expect(409);

      expect(response.body.code).toBe('DUPLICATE_ENTRY');
    });

    it('should return 500 on general database error', async () => {
      vi.mocked(db.db.query.tiles.findMany).mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/api/settlements')
        .set('Authorization', 'Bearer valid-token')
        .send(validRequest)
        .expect(500);

      expect(response.body.error).toBe('Failed to create settlement');
    });
  });
});
