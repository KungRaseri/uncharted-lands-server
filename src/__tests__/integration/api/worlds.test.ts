import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import worldsRouter from '../../../api/routes/worlds';
import * as db from '../../../db/index';
import { generateTestId } from '../../helpers/test-utils';

// Mock dependencies
vi.mock('../../../db/index', () => ({
  db: {
    query: {
      worlds: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(),
    })),
  },
  worlds: {},
  regions: {},
  tiles: {},
  plots: {},
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@paralleldrive/cuid2', () => ({
  createId: () => generateTestId('world'),
}));

vi.mock('../../../api/middleware/auth', () => ({
  authenticateAdmin: (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer admin-token') {
      req.user = { id: 'admin-123', role: 'ADMINISTRATOR' };
      next();
    } else {
      res.status(403).json({ error: 'Forbidden', code: 'NOT_ADMIN' });
    }
  },
}));

describe('Worlds API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/worlds', worldsRouter);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/worlds', () => {
    it('should return 403 if not admin', async () => {
      const response = await request(app)
        .get('/api/worlds')
        .set('Authorization', 'Bearer user-token')
        .expect(403);

      expect(response.body.code).toBe('NOT_ADMIN');
    });

    it('should return all worlds with server information', async () => {
      const mockWorlds = [
        {
          id: generateTestId('world'),
          name: 'World 1',
          server: { id: 'server-1', name: 'Server 1', status: 'ACTIVE' },
        },
      ];

      vi.mocked(db.db.query.worlds.findMany).mockResolvedValue(mockWorlds as any);

      const response = await request(app)
        .get('/api/worlds')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toEqual(mockWorlds);
    });

    it('should return 500 on database error', async () => {
      vi.mocked(db.db.query.worlds.findMany).mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .get('/api/worlds')
        .set('Authorization', 'Bearer admin-token')
        .expect(500);

      expect(response.body.code).toBe('FETCH_FAILED');
    });
  });

  describe('GET /api/worlds/:id', () => {
    it('should return 403 if not admin', async () => {
      const response = await request(app)
        .get('/api/worlds/world-123')
        .set('Authorization', 'Bearer user-token')
        .expect(403);

      expect(response.body.code).toBe('NOT_ADMIN');
    });

    it('should return world details with statistics', async () => {
      const mockWorld = {
        id: 'world-123',
        name: 'World 1',
        server: { id: 'server-1', name: 'Server 1' },
        regions: [
          {
            tiles: [
              {
                type: 'LAND',
                biome: {},
                plots: [
                  { settlement: { id: 'settlement-1', name: 'Settlement 1' } },
                ],
              },
              {
                type: 'OCEAN',
                biome: {},
                plots: [],
              },
            ],
          },
        ],
      };

      vi.mocked(db.db.query.worlds.findFirst).mockResolvedValue(mockWorld as any);

      const response = await request(app)
        .get('/api/worlds/world-123')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body._count).toBeDefined();
      expect(response.body._count.regions).toBe(1);
      expect(response.body._count.settlements).toBe(1);
      expect(response.body._count.landTiles).toBe(1);
      expect(response.body._count.oceanTiles).toBe(1);
    });

    it('should handle world with no regions', async () => {
      const mockWorld = {
        id: 'world-123',
        name: 'Empty World',
        server: { id: 'server-1', name: 'Server 1' },
        regions: [],
      };

      vi.mocked(db.db.query.worlds.findFirst).mockResolvedValue(mockWorld as any);

      const response = await request(app)
        .get('/api/worlds/world-123')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body._count.regions).toBe(0);
      expect(response.body._count.settlements).toBe(0);
      expect(response.body._count.landTiles).toBe(0);
      expect(response.body._count.oceanTiles).toBe(0);
    });

    it('should deduplicate settlements when counting', async () => {
      const mockWorld = {
        id: 'world-123',
        name: 'World 1',
        server: {},
        regions: [
          {
            tiles: [
              {
                type: 'LAND',
                plots: [
                  { settlement: { id: 'settlement-1', name: 'Settlement 1' } },
                  { settlement: { id: 'settlement-1', name: 'Settlement 1' } }, // Same settlement
                ],
              },
            ],
          },
        ],
      };

      vi.mocked(db.db.query.worlds.findFirst).mockResolvedValue(mockWorld as any);

      const response = await request(app)
        .get('/api/worlds/world-123')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body._count.settlements).toBe(1); // Should deduplicate
    });

    it('should return 404 if world not found', async () => {
      vi.mocked(db.db.query.worlds.findFirst).mockResolvedValue(undefined);

      const response = await request(app)
        .get('/api/worlds/nonexistent')
        .set('Authorization', 'Bearer admin-token')
        .expect(404);

      expect(response.body.code).toBe('NOT_FOUND');
    });

    it('should return 500 on database error', async () => {
      vi.mocked(db.db.query.worlds.findFirst).mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .get('/api/worlds/world-123')
        .set('Authorization', 'Bearer admin-token')
        .expect(500);

      expect(response.body.code).toBe('FETCH_FAILED');
    });
  });

  describe('POST /api/worlds', () => {
    const validRequest = {
      name: 'New World',
      serverId: 'server-123',
      elevationSettings: { min: 0, max: 100 },
      precipitationSettings: { min: 0, max: 500 },
      temperatureSettings: { min: -20, max: 40 },
    };

    it('should return 403 if not admin', async () => {
      const response = await request(app)
        .post('/api/worlds')
        .set('Authorization', 'Bearer user-token')
        .send(validRequest)
        .expect(403);

      expect(response.body.code).toBe('NOT_ADMIN');
    });

    it('should return 400 if missing required fields', async () => {
      const response = await request(app)
        .post('/api/worlds')
        .set('Authorization', 'Bearer admin-token')
        .send({ name: 'World' })
        .expect(400);

      expect(response.body.code).toBe('INVALID_INPUT');
    });

    it('should create world successfully with all settings', async () => {
      const mockWorld = { id: generateTestId('world'), name: 'New World' };
      
      const mockReturning = vi.fn().mockResolvedValue([mockWorld]);
      const mockValues = vi.fn(() => ({ returning: mockReturning }));
      const mockInsert = vi.fn(() => ({ values: mockValues }));
      vi.mocked(db.db.insert).mockImplementation(mockInsert as any);

      const response = await request(app)
        .post('/api/worlds')
        .set('Authorization', 'Bearer admin-token')
        .send(validRequest)
        .expect(201);

      expect(response.body).toEqual(mockWorld);
    });

    it('should create world with default settings when not provided', async () => {
      const mockWorld = { id: generateTestId('world'), name: 'Simple World' };
      
      const mockReturning = vi.fn().mockResolvedValue([mockWorld]);
      const mockValues = vi.fn(() => ({ returning: mockReturning }));
      const mockInsert = vi.fn(() => ({ values: mockValues }));
      vi.mocked(db.db.insert).mockImplementation(mockInsert as any);

      const response = await request(app)
        .post('/api/worlds')
        .set('Authorization', 'Bearer admin-token')
        .send({ name: 'Simple World', serverId: 'server-123' })
        .expect(201);

      expect(response.body.id).toBeDefined();
    });

    it('should create world with bulk regions', async () => {
      const mockWorld = { id: generateTestId('world'), name: 'World with Regions' };
      const worldWithRegions = {
        ...validRequest,
        regions: [
          { id: 'region-1', x: 0, y: 0 },
          { id: 'region-2', x: 1, y: 0 },
        ],
      };
      
      // First call returns world with .returning(), second call resolves for regions
      const mockReturning = vi.fn().mockResolvedValue([mockWorld]);
      const mockValues = vi.fn()
        .mockReturnValueOnce({ returning: mockReturning }) // world insert
        .mockResolvedValueOnce(undefined); // regions insert
      const mockInsert = vi.fn(() => ({ values: mockValues }));
      vi.mocked(db.db.insert).mockImplementation(mockInsert as any);

      const response = await request(app)
        .post('/api/worlds')
        .set('Authorization', 'Bearer admin-token')
        .send(worldWithRegions)
        .expect(201);

      expect(response.body).toEqual(mockWorld);
      expect(mockInsert).toHaveBeenCalledTimes(2); // world + regions
    });

    it('should create world with bulk tiles', async () => {
      const mockWorld = { id: generateTestId('world'), name: 'World with Tiles' };
      const worldWithTiles = {
        ...validRequest,
        tiles: [
          { id: 'tile-1', x: 0, y: 0, elevation: 10 },
        ],
      };
      
      const mockReturning = vi.fn().mockResolvedValue([mockWorld]);
      const mockValues = vi.fn()
        .mockReturnValueOnce({ returning: mockReturning }) // world insert
        .mockResolvedValueOnce(undefined); // tiles insert
      const mockInsert = vi.fn(() => ({ values: mockValues }));
      vi.mocked(db.db.insert).mockImplementation(mockInsert as any);

      const response = await request(app)
        .post('/api/worlds')
        .set('Authorization', 'Bearer admin-token')
        .send(worldWithTiles)
        .expect(201);

      expect(response.body.id).toBeDefined();
    });

    it('should create world with bulk plots', async () => {
      const mockWorld = { id: generateTestId('world'), name: 'World with Plots' };
      const worldWithPlots = {
        ...validRequest,
        plots: [
          { id: 'plot-1', food: 5, water: 5, wood: 5 },
        ],
      };
      
      const mockReturning = vi.fn().mockResolvedValue([mockWorld]);
      const mockValues = vi.fn()
        .mockReturnValueOnce({ returning: mockReturning }) // world insert
        .mockResolvedValueOnce(undefined); // plots insert
      const mockInsert = vi.fn(() => ({ values: mockValues }));
      vi.mocked(db.db.insert).mockImplementation(mockInsert as any);

      const response = await request(app)
        .post('/api/worlds')
        .set('Authorization', 'Bearer admin-token')
        .send(worldWithPlots)
        .expect(201);

      expect(response.body.id).toBeDefined();
    });

    it('should return 500 on database error', async () => {
      const mockValues = vi.fn(() => ({ returning: vi.fn().mockRejectedValue(new Error('DB error')) }));
      const mockInsert = vi.fn(() => ({ values: mockValues }));
      vi.mocked(db.db.insert).mockImplementation(mockInsert as any);

      const response = await request(app)
        .post('/api/worlds')
        .set('Authorization', 'Bearer admin-token')
        .send(validRequest)
        .expect(500);

      expect(response.body.code).toBe('CREATE_FAILED');
    });
  });

  describe('PUT /api/worlds/:id', () => {
    it('should return 403 if not admin', async () => {
      const response = await request(app)
        .put('/api/worlds/world-123')
        .set('Authorization', 'Bearer user-token')
        .send({ name: 'Updated' })
        .expect(403);

      expect(response.body.code).toBe('NOT_ADMIN');
    });

    it('should update world successfully', async () => {
      const existingWorld = {
        id: 'world-123',
        name: 'Old Name',
        elevationSettings: {},
        precipitationSettings: {},
        temperatureSettings: {},
      };
      const updatedWorld = { ...existingWorld, name: 'New Name' };

      vi.mocked(db.db.query.worlds.findFirst).mockResolvedValue(existingWorld as any);
      
      const mockReturning = vi.fn().mockResolvedValue([updatedWorld]);
      const mockWhere = vi.fn(() => ({ returning: mockReturning }));
      const mockSet = vi.fn(() => ({ where: mockWhere }));
      const mockUpdate = vi.fn(() => ({ set: mockSet }));
      vi.mocked(db.db.update).mockImplementation(mockUpdate as any);

      const response = await request(app)
        .put('/api/worlds/world-123')
        .set('Authorization', 'Bearer admin-token')
        .send({ name: 'New Name' })
        .expect(200);

      expect(response.body.name).toBe('New Name');
    });

    it('should return 404 if world not found', async () => {
      vi.mocked(db.db.query.worlds.findFirst).mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/worlds/nonexistent')
        .set('Authorization', 'Bearer admin-token')
        .send({ name: 'Updated' })
        .expect(404);

      expect(response.body.code).toBe('NOT_FOUND');
    });

    it('should return 500 on database error', async () => {
      vi.mocked(db.db.query.worlds.findFirst).mockResolvedValue({ id: 'world-123' } as any);
      
      const mockWhere = vi.fn(() => ({ returning: vi.fn().mockRejectedValue(new Error('DB error')) }));
      const mockSet = vi.fn(() => ({ where: mockWhere }));
      const mockUpdate = vi.fn(() => ({ set: mockSet }));
      vi.mocked(db.db.update).mockImplementation(mockUpdate as any);

      const response = await request(app)
        .put('/api/worlds/world-123')
        .set('Authorization', 'Bearer admin-token')
        .send({ name: 'Updated' })
        .expect(500);

      expect(response.body.code).toBe('UPDATE_FAILED');
    });
  });

  describe('DELETE /api/worlds/:id', () => {
    it('should return 403 if not admin', async () => {
      const response = await request(app)
        .delete('/api/worlds/world-123')
        .set('Authorization', 'Bearer user-token')
        .expect(403);

      expect(response.body.code).toBe('NOT_ADMIN');
    });

    it('should delete world successfully', async () => {
      const existingWorld = { id: 'world-123', name: 'World to Delete' };

      vi.mocked(db.db.query.worlds.findFirst).mockResolvedValue(existingWorld as any);
      
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockDelete = vi.fn(() => ({ where: mockWhere }));
      vi.mocked(db.db.delete).mockImplementation(mockDelete as any);

      const response = await request(app)
        .delete('/api/worlds/world-123')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('World to Delete');
    });

    it('should return 404 if world not found', async () => {
      vi.mocked(db.db.query.worlds.findFirst).mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/worlds/nonexistent')
        .set('Authorization', 'Bearer admin-token')
        .expect(404);

      expect(response.body.code).toBe('NOT_FOUND');
    });

    it('should return 500 on database error', async () => {
      vi.mocked(db.db.query.worlds.findFirst).mockResolvedValue({ id: 'world-123', name: 'World' } as any);
      
      const mockWhere = vi.fn().mockRejectedValue(new Error('DB error'));
      const mockDelete = vi.fn(() => ({ where: mockWhere }));
      vi.mocked(db.db.delete).mockImplementation(mockDelete as any);

      const response = await request(app)
        .delete('/api/worlds/world-123')
        .set('Authorization', 'Bearer admin-token')
        .expect(500);

      expect(response.body.code).toBe('DELETE_FAILED');
    });

    it('should require admin authentication for delete', async () => {
      const response = await request(app)
        .delete('/api/worlds/world-123')
        .set('Authorization', 'Bearer user-token')
        .expect(403);

      expect(response.body.code).toBe('NOT_ADMIN');
    });
  });
});
