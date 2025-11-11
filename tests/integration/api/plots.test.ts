/**
 * Tests for Plot Management API Routes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import plotsRouter from '../../../src/api/routes/plots.js';

// Mock the database and authentication
vi.mock('../../../src/db/index.js', () => ({
  db: {
    query: {
      plots: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      tiles: {
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
        where: vi.fn(),
      })),
    })),
    transaction: vi.fn(),
  },
  plots: {},
  tiles: {},
  settlementStructures: {},
  structureRequirements: {},
  settlementStorage: {},
}));

vi.mock('../../../src/db/queries.js', () => ({
  generateId: vi.fn(() => `test-id-${Math.random().toString(36).substring(7)}`),
}));

vi.mock('../../../src/utils/resource-production.js', () => ({
  calculateProductionRate: vi.fn(() => 10),
  calculateAccumulatedResources: vi.fn(() => 50),
}));

vi.mock('../../../src/api/middleware/auth.js', () => ({
  authenticate: vi.fn((req, res, next) => {
    req.user = {
      accountId: 'test-account-id',
      profileId: 'test-profile-id',
      username: 'testuser',
      role: 'USER',
    };
    next();
  }),
}));

describe('Plots API Routes', () => {
  let app: Express;
  let mockDb: any;

  beforeEach(async () => {
    const { db } = await import('../../../src/db/index.js');
    mockDb = db;

    app = express();
    app.use(express.json());
    app.use('/api/plots', plotsRouter);

    vi.clearAllMocks();
  });

  describe('GET /api/plots/:id', () => {
    it('should return plot details with accumulated resources', async () => {
      const mockPlot = {
        id: 'plot-1',
        tileId: 'tile-1',
        settlementId: 'settlement-1',
        position: 0,
        resourceType: 'FOOD',
        baseProductionRate: 10,
        accumulatedResources: 10,
        lastHarvested: new Date(Date.now() - 60 * 60 * 1000),
        tile: {
          id: 'tile-1',
          biome: { name: 'Grassland' },
          settlement: { id: 'settlement-1' },
        },
        structure: { id: 'structure-1', name: 'Farm' },
        settlement: { id: 'settlement-1' },
      };

      mockDb.query.plots.findFirst.mockResolvedValue(mockPlot);

      const response = await request(app).get('/api/plots/plot-1');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: 'plot-1',
        tileId: 'tile-1',
        settlementId: 'settlement-1',
      });
      expect(response.body.accumulatedResources).toBeGreaterThan(10);
    });

    it('should return 404 if plot not found', async () => {
      mockDb.query.plots.findFirst.mockResolvedValue(null);

      const response = await request(app).get('/api/plots/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('PLOT_NOT_FOUND');
    });

    it('should handle database errors gracefully', async () => {
      mockDb.query.plots.findFirst.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/plots/plot-1');

      expect(response.status).toBe(500);
      expect(response.body.code).toBe('FETCH_FAILED');
    });
  });

  describe('POST /api/plots/create', () => {
    it('should create a new plot successfully', async () => {
      const mockTile = {
        id: 'tile-1',
        settlementId: 'settlement-1',
        plotSlots: 6,
        plots: [],
      };

      const mockNewPlot = {
        id: 'new-plot-id',
        tileId: 'tile-1',
        settlementId: 'settlement-1',
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.query.tiles.findFirst.mockResolvedValue(mockTile);
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockNewPlot]),
        }),
      });

      const response = await request(app).post('/api/plots/create').send({
        tileId: 'tile-1',
        settlementId: 'settlement-1',
        position: 0,
      });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: 'new-plot-id',
        tileId: 'tile-1',
        settlementId: 'settlement-1',
        position: 0,
      });
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app).post('/api/plots/create').send({
        tileId: 'tile-1',
        // missing settlementId and position
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('MISSING_FIELDS');
    });

    it('should return 404 if tile not found', async () => {
      mockDb.query.tiles.findFirst.mockResolvedValue(null);

      const response = await request(app).post('/api/plots/create').send({
        tileId: 'nonexistent',
        settlementId: 'settlement-1',
        position: 0,
      });

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('TILE_NOT_FOUND');
    });

    it('should return 403 if settlement does not own tile', async () => {
      const mockTile = {
        id: 'tile-1',
        settlementId: 'other-settlement',
        plotSlots: 6,
        plots: [],
      };

      mockDb.query.tiles.findFirst.mockResolvedValue(mockTile);

      const response = await request(app).post('/api/plots/create').send({
        tileId: 'tile-1',
        settlementId: 'settlement-1',
        position: 0,
      });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('NOT_TILE_OWNER');
    });

    it('should return 400 if no plot slots available', async () => {
      const mockTile = {
        id: 'tile-1',
        settlementId: 'settlement-1',
        plotSlots: 2,
        plots: [{ position: 0 }, { position: 1 }],
      };

      mockDb.query.tiles.findFirst.mockResolvedValue(mockTile);

      const response = await request(app).post('/api/plots/create').send({
        tileId: 'tile-1',
        settlementId: 'settlement-1',
        position: 2,
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('NO_PLOT_SLOTS');
    });

    it('should return 400 if position is already taken', async () => {
      const mockTile = {
        id: 'tile-1',
        settlementId: 'settlement-1',
        plotSlots: 6,
        plots: [{ position: 0 }],
      };

      mockDb.query.tiles.findFirst.mockResolvedValue(mockTile);

      const response = await request(app).post('/api/plots/create').send({
        tileId: 'tile-1',
        settlementId: 'settlement-1',
        position: 0,
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('POSITION_TAKEN');
    });
  });

  describe('POST /api/plots/:id/build-extractor', () => {
    it('should build an extractor on a plot', async () => {
      const mockPlot = {
        id: 'plot-1',
        settlementId: 'settlement-1',
        structure: null,
        tile: {
          biome: { name: 'Grassland' },
          foodQuality: 60,
        },
        settlement: {
          playerProfileId: 'test-profile-id',
        },
      };

      mockDb.query.plots.findFirst.mockResolvedValueOnce(mockPlot).mockResolvedValueOnce({
        ...mockPlot,
        structureId: 'new-structure-id',
        resourceType: 'FOOD',
        baseProductionRate: 10,
      });

      mockDb.transaction.mockImplementation(async (callback: any) => {
        return callback(mockDb);
      });

      const response = await request(app).post('/api/plots/plot-1/build-extractor').send({
        extractorType: 'FARM',
        resourceType: 'FOOD',
        structureName: 'My Farm',
        structureDescription: 'A productive farm',
      });

      expect(response.status).toBe(201);
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should return 400 if required fields are missing', async () => {
      const response = await request(app).post('/api/plots/plot-1/build-extractor').send({
        extractorType: 'FARM',
        // missing resourceType
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('MISSING_FIELDS');
    });

    it('should return 404 if plot not found', async () => {
      mockDb.query.plots.findFirst.mockResolvedValue(null);

      const response = await request(app).post('/api/plots/nonexistent/build-extractor').send({
        extractorType: 'FARM',
        resourceType: 'FOOD',
      });

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('PLOT_NOT_FOUND');
    });

    it('should return 400 if plot already has a structure', async () => {
      const mockPlot = {
        id: 'plot-1',
        structure: { id: 'existing-structure' },
        settlement: { playerProfileId: 'test-profile-id' },
      };

      mockDb.query.plots.findFirst.mockResolvedValue(mockPlot);

      const response = await request(app).post('/api/plots/plot-1/build-extractor').send({
        extractorType: 'FARM',
        resourceType: 'FOOD',
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('PLOT_OCCUPIED');
    });

    it('should return 403 if user does not own settlement', async () => {
      const mockPlot = {
        id: 'plot-1',
        structure: null,
        settlement: { playerProfileId: 'other-profile' },
      };

      mockDb.query.plots.findFirst.mockResolvedValue(mockPlot);

      const response = await request(app).post('/api/plots/plot-1/build-extractor').send({
        extractorType: 'FARM',
        resourceType: 'FOOD',
      });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('NOT_SETTLEMENT_OWNER');
    });

    it('should return 400 if extractor cannot extract resource', async () => {
      const { calculateProductionRate } = await import('../../../src/utils/resource-production.js');
      vi.mocked(calculateProductionRate).mockReturnValue(0);

      const mockPlot = {
        id: 'plot-1',
        structure: null,
        tile: { biome: { name: 'Desert' } },
        settlement: { playerProfileId: 'test-profile-id' },
      };

      mockDb.query.plots.findFirst.mockResolvedValue(mockPlot);

      const response = await request(app).post('/api/plots/plot-1/build-extractor').send({
        extractorType: 'FARM',
        resourceType: 'INVALID',
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_EXTRACTOR');
    });
  });

  describe('POST /api/plots/:id/harvest', () => {
    it('should harvest accumulated resources', async () => {
      const mockPlot = {
        id: 'plot-1',
        resourceType: 'FOOD',
        baseProductionRate: 10,
        accumulatedResources: 20,
        lastHarvested: new Date(Date.now() - 60 * 60 * 1000),
        settlement: {
          playerProfileId: 'test-profile-id',
          storage: {
            id: 'storage-1',
            food: 100,
            water: 100,
            wood: 100,
            stone: 100,
            ore: 100,
          },
        },
        settlementId: 'settlement-1',
      };

      mockDb.query.plots.findFirst.mockResolvedValue(mockPlot);
      mockDb.transaction.mockImplementation(async (callback: any) => {
        return callback(mockDb);
      });

      const response = await request(app).post('/api/plots/plot-1/harvest');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.resourceType).toBe('FOOD');
      expect(response.body.amount).toBeGreaterThan(0);
    });

    it('should return 404 if plot not found', async () => {
      mockDb.query.plots.findFirst.mockResolvedValue(null);

      const response = await request(app).post('/api/plots/nonexistent/harvest');

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('PLOT_NOT_FOUND');
    });

    it('should return 403 if user does not own settlement', async () => {
      const mockPlot = {
        id: 'plot-1',
        settlement: { playerProfileId: 'other-profile' },
      };

      mockDb.query.plots.findFirst.mockResolvedValue(mockPlot);

      const response = await request(app).post('/api/plots/plot-1/harvest');

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('NOT_SETTLEMENT_OWNER');
    });

    it('should return 400 if plot has no production', async () => {
      const mockPlot = {
        id: 'plot-1',
        resourceType: null,
        baseProductionRate: 0,
        settlement: { playerProfileId: 'test-profile-id' },
      };

      mockDb.query.plots.findFirst.mockResolvedValue(mockPlot);

      const response = await request(app).post('/api/plots/plot-1/harvest');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('NO_PRODUCTION');
    });

    it('should return 400 if no resources available', async () => {
      const { calculateAccumulatedResources } = await import(
        '../../../src/utils/resource-production.js'
      );
      vi.mocked(calculateAccumulatedResources).mockReturnValue(0);

      const mockPlot = {
        id: 'plot-1',
        resourceType: 'FOOD',
        baseProductionRate: 10,
        accumulatedResources: 0,
        lastHarvested: new Date(),
        settlement: { playerProfileId: 'test-profile-id' },
      };

      mockDb.query.plots.findFirst.mockResolvedValue(mockPlot);

      const response = await request(app).post('/api/plots/plot-1/harvest');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('NO_RESOURCES');
    });

    it('should return 500 if settlement has no storage', async () => {
      const mockPlot = {
        id: 'plot-1',
        resourceType: 'FOOD',
        baseProductionRate: 10,
        accumulatedResources: 50,
        lastHarvested: new Date(),
        settlement: {
          playerProfileId: 'test-profile-id',
          storage: null,
        },
      };

      mockDb.query.plots.findFirst.mockResolvedValue(mockPlot);

      const response = await request(app).post('/api/plots/plot-1/harvest');

      expect(response.status).toBe(500);
      expect(response.body.code).toBe('NO_STORAGE');
    });
  });

  describe('GET /api/plots/by-tile/:tileId', () => {
    it('should return all plots on a tile', async () => {
      const mockPlots = [
        {
          id: 'plot-1',
          tileId: 'tile-1',
          position: 0,
          structure: { id: 'structure-1' },
        },
        {
          id: 'plot-2',
          tileId: 'tile-1',
          position: 1,
          structure: null,
        },
      ];

      mockDb.query.plots.findMany.mockResolvedValue(mockPlots);

      const response = await request(app).get('/api/plots/by-tile/tile-1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].tileId).toBe('tile-1');
    });

    it('should return empty array if no plots found', async () => {
      mockDb.query.plots.findMany.mockResolvedValue([]);

      const response = await request(app).get('/api/plots/by-tile/tile-1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockDb.query.plots.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/plots/by-tile/tile-1');

      expect(response.status).toBe(500);
      expect(response.body.code).toBe('FETCH_FAILED');
    });
  });

  describe('GET /api/plots/by-settlement/:settlementId', () => {
    it('should return all plots for a settlement with accumulated resources', async () => {
      const mockPlots = [
        {
          id: 'plot-1',
          settlementId: 'settlement-1',
          baseProductionRate: 10,
          accumulatedResources: 10,
          lastHarvested: new Date(Date.now() - 60 * 60 * 1000),
          tile: { biome: { name: 'Grassland' } },
          structure: { id: 'structure-1' },
        },
        {
          id: 'plot-2',
          settlementId: 'settlement-1',
          baseProductionRate: 0,
          accumulatedResources: 0,
          lastHarvested: null,
          tile: { biome: { name: 'Desert' } },
          structure: null,
        },
      ];

      mockDb.query.plots.findMany.mockResolvedValue(mockPlots);

      const response = await request(app).get('/api/plots/by-settlement/settlement-1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('currentAccumulated');
      expect(response.body[1].currentAccumulated).toBe(0);
    });

    it('should return empty array if no plots found', async () => {
      mockDb.query.plots.findMany.mockResolvedValue([]);

      const response = await request(app).get('/api/plots/by-settlement/settlement-1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockDb.query.plots.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/plots/by-settlement/settlement-1');

      expect(response.status).toBe(500);
      expect(response.body.code).toBe('FETCH_FAILED');
    });
  });
});
