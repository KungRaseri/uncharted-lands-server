import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import structuresRouter from '../../../src/api/routes/structures.js';
import * as db from '../../../src/db/index.js';
import { generateTestId } from '../../helpers/test-utils';

// Mock dependencies
vi.mock('../../../src/db/index.js', () => ({
  db: {
    query: {
      settlementStructures: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      settlements: {
        findFirst: vi.fn(),
      },
      plots: {
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
    transaction: vi.fn(),
  },
  settlementStructures: {},
  structureRequirements: {},
  settlements: {},
  plots: {},
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/api/middleware/auth.js', () => ({
  authenticate: (req: any, res: any, next: any) => {
    if (req.headers.authorization === 'Bearer valid-token') {
      req.user = {
        id: 'account-123',
        profileId: 'profile-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'MEMBER',
      };
      next();
    } else {
      res.status(401).json({ error: 'Unauthorized', code: 'NO_SESSION' });
    }
  },
}));

describe('Structures API Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/structures', structuresRouter);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/structures/:id', () => {
    it('should return structure details', async () => {
      const mockStructure = {
        id: 'structure-123',
        name: 'Test Structure',
        description: 'A test structure',
        category: 'BUILDING',
        buildingType: 'HOUSE',
        level: 1,
        buildRequirements: {},
        settlement: {},
        plot: null,
      };

      vi.mocked(db.db.query.settlementStructures.findFirst).mockResolvedValue(mockStructure as any);

      const response = await request(app)
        .get('/api/structures/structure-123')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body).toEqual(mockStructure);
    });

    it('should return 404 if structure not found', async () => {
      vi.mocked(db.db.query.settlementStructures.findFirst).mockResolvedValue(undefined);

      const response = await request(app)
        .get('/api/structures/nonexistent')
        .set('Authorization', 'Bearer valid-token')
        .expect(404);

      expect(response.body.code).toBe('STRUCTURE_NOT_FOUND');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/structures/structure-123').expect(401);

      expect(response.body.code).toBe('NO_SESSION');
    });
  });

  describe('POST /api/structures/create', () => {
    const validRequest = {
      settlementId: 'settlement-123',
      buildingType: 'tent',
      name: 'My Tent',
      description: 'A cozy tent',
    };

    it('should create a structure with valid building type mapping', async () => {
      const mockSettlement = {
        id: 'settlement-123',
        playerProfileId: 'profile-123',
      };

      const mockCreatedStructure = {
        id: generateTestId('structure'),
        settlementId: 'settlement-123',
        category: 'BUILDING',
        buildingType: 'HOUSE', // tent maps to HOUSE
        level: 1,
        name: 'tent Level 1',
        description: 'A tent for your settlement',
      };

      vi.mocked(db.db.query.settlements.findFirst).mockResolvedValue(mockSettlement as any);

      // Mock transaction
      vi.mocked(db.db.transaction).mockImplementation(async (callback: any) => {
        return callback({
          insert: vi.fn(() => ({
            values: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([mockCreatedStructure]),
            })),
          })),
        });
      });

      const response = await request(app)
        .post('/api/structures/create')
        .set('Authorization', 'Bearer valid-token')
        .send(validRequest)
        .expect(201);

      expect(response.body.buildingType).toBe('HOUSE');
      expect(response.body.id).toBeDefined();
    });

    it('should map cottage to HOUSE', async () => {
      const mockSettlement = {
        id: 'settlement-123',
        playerProfileId: 'profile-123',
      };

      const mockCreatedStructure = {
        id: generateTestId('structure'),
        buildingType: 'HOUSE',
      };

      vi.mocked(db.db.query.settlements.findFirst).mockResolvedValue(mockSettlement as any);
      vi.mocked(db.db.transaction).mockImplementation(async (callback: any) => {
        return callback({
          insert: vi.fn(() => ({
            values: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([mockCreatedStructure]),
            })),
          })),
        });
      });

      const response = await request(app)
        .post('/api/structures/create')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validRequest, buildingType: 'cottage' })
        .expect(201);

      expect(response.body.buildingType).toBe('HOUSE');
    });

    it('should map farm to WORKSHOP', async () => {
      const mockSettlement = {
        id: 'settlement-123',
        playerProfileId: 'profile-123',
      };

      const mockCreatedStructure = {
        id: generateTestId('structure'),
        buildingType: 'WORKSHOP',
      };

      vi.mocked(db.db.query.settlements.findFirst).mockResolvedValue(mockSettlement as any);
      vi.mocked(db.db.transaction).mockImplementation(async (callback: any) => {
        return callback({
          insert: vi.fn(() => ({
            values: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([mockCreatedStructure]),
            })),
          })),
        });
      });

      const response = await request(app)
        .post('/api/structures/create')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validRequest, buildingType: 'farm' })
        .expect(201);

      expect(response.body.buildingType).toBe('WORKSHOP');
    });

    it('should return 400 for invalid building type', async () => {
      const response = await request(app)
        .post('/api/structures/create')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validRequest, buildingType: 'invalid_type' })
        .expect(400);

      expect(response.body.code).toBe('INVALID_BUILDING_TYPE');
    });

    it('should return 400 if missing required fields', async () => {
      const response = await request(app)
        .post('/api/structures/create')
        .set('Authorization', 'Bearer valid-token')
        .send({ buildingType: 'tent' })
        .expect(400);

      expect(response.body.code).toBe('MISSING_FIELDS');
    });

    it('should return 404 if settlement not found', async () => {
      vi.mocked(db.db.query.settlements.findFirst).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/structures/create')
        .set('Authorization', 'Bearer valid-token')
        .send(validRequest)
        .expect(404);

      expect(response.body.code).toBe('SETTLEMENT_NOT_FOUND');
    });

    it('should return 403 if user does not own settlement', async () => {
      const mockSettlement = {
        id: 'settlement-123',
        playerProfileId: 'different-profile-id',
      };

      vi.mocked(db.db.query.settlements.findFirst).mockResolvedValue(mockSettlement as any);

      const response = await request(app)
        .post('/api/structures/create')
        .set('Authorization', 'Bearer valid-token')
        .send(validRequest)
        .expect(403);

      expect(response.body.code).toBe('NOT_SETTLEMENT_OWNER');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/structures/create')
        .send(validRequest)
        .expect(401);

      expect(response.body.code).toBe('NO_SESSION');
    });
  });

  describe('GET /api/structures/by-settlement/:settlementId', () => {
    it('should return all structures for a settlement', async () => {
      const mockStructures = [
        {
          id: 'structure-1',
          name: 'House',
          category: 'BUILDING',
          buildingType: 'HOUSE',
        },
        {
          id: 'structure-2',
          name: 'Workshop',
          category: 'BUILDING',
          buildingType: 'WORKSHOP',
        },
      ];

      vi.mocked(db.db.query.settlementStructures.findMany).mockResolvedValue(mockStructures as any);

      const response = await request(app)
        .get('/api/structures/by-settlement/settlement-123')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body).toEqual(mockStructures);
      expect(response.body).toHaveLength(2);
    });

    it('should return empty array if no structures', async () => {
      vi.mocked(db.db.query.settlementStructures.findMany).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/structures/by-settlement/settlement-123')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('POST /api/structures/:id/upgrade', () => {
    it('should upgrade structure level', async () => {
      const mockStructure = {
        id: 'structure-123',
        name: 'House Level 1',
        level: 1,
        category: 'BUILDING',
        settlement: {
          playerProfileId: 'profile-123',
        },
      };

      const mockUpgraded = {
        ...mockStructure,
        level: 2,
        name: 'House Level 2',
      };

      vi.mocked(db.db.query.settlementStructures.findFirst).mockResolvedValue(mockStructure as any);
      vi.mocked(db.db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockUpgraded]),
          }),
        }),
      } as any);

      const response = await request(app)
        .post('/api/structures/structure-123/upgrade')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.level).toBe(2);
      expect(response.body.name).toBe('House Level 2');
    });

    it('should return 404 if structure not found', async () => {
      vi.mocked(db.db.query.settlementStructures.findFirst).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/structures/nonexistent/upgrade')
        .set('Authorization', 'Bearer valid-token')
        .expect(404);

      expect(response.body.code).toBe('STRUCTURE_NOT_FOUND');
    });

    it('should return 403 if user does not own settlement', async () => {
      const mockStructure = {
        id: 'structure-123',
        settlement: {
          playerProfileId: 'different-profile-id',
        },
      };

      vi.mocked(db.db.query.settlementStructures.findFirst).mockResolvedValue(mockStructure as any);

      const response = await request(app)
        .post('/api/structures/structure-123/upgrade')
        .set('Authorization', 'Bearer valid-token')
        .expect(403);

      expect(response.body.code).toBe('NOT_SETTLEMENT_OWNER');
    });
  });

  describe('DELETE /api/structures/:id', () => {
    it('should demolish structure', async () => {
      const mockStructure = {
        id: 'structure-123',
        name: 'Old House',
        settlementId: 'settlement-123',
        category: 'BUILDING',
        settlement: {
          playerProfileId: 'profile-123',
        },
      };

      vi.mocked(db.db.query.settlementStructures.findFirst).mockResolvedValue(mockStructure as any);
      vi.mocked(db.db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as any);

      const response = await request(app)
        .delete('/api/structures/structure-123')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('demolished');
    });

    it('should return 404 if structure not found', async () => {
      vi.mocked(db.db.query.settlementStructures.findFirst).mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/structures/nonexistent')
        .set('Authorization', 'Bearer valid-token')
        .expect(404);

      expect(response.body.code).toBe('STRUCTURE_NOT_FOUND');
    });

    it('should return 403 if user does not own settlement', async () => {
      const mockStructure = {
        id: 'structure-123',
        settlement: {
          playerProfileId: 'different-profile-id',
        },
      };

      vi.mocked(db.db.query.settlementStructures.findFirst).mockResolvedValue(mockStructure as any);

      const response = await request(app)
        .delete('/api/structures/structure-123')
        .set('Authorization', 'Bearer valid-token')
        .expect(403);

      expect(response.body.code).toBe('NOT_SETTLEMENT_OWNER');
    });
  });
});
