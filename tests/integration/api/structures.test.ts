import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import structuresRouter from '../../../src/api/routes/structures.js';
import { db } from '../../../src/db/index.js';
import { settlementStructures, structures } from '../../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import {
  createTestSettlement,
  createTestSettlementWithStructure,
  cleanupTestChain,
  type TestEntityChain,
} from '../../helpers/integration-test-factory.js';
import type { Server } from 'http';

// Mock only logger (non-database dependency)
import { vi } from 'vitest';
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/data/structure-costs.js', () => ({
  getAllStructureCosts: vi.fn(() => [
    {
      id: 'tent',
      name: 'TENT',
      displayName: 'Tent',
      description: 'A simple tent for starting out',
      category: 'HOUSING',
      tier: 1,
      costs: { food: 0, water: 0, wood: 10, stone: 0, ore: 0 },
      constructionTimeSeconds: 0,
      populationRequired: 0,
    },
    {
      id: 'farm',
      name: 'FARM',
      displayName: 'Farm',
      description: 'Produces food',
      category: 'PRODUCTION',
      tier: 1,
      costs: { food: 0, water: 0, wood: 20, stone: 10, ore: 0 },
      constructionTimeSeconds: 180,
      populationRequired: 2,
    },
  ]),
}));

vi.mock('../../../src/data/structure-requirements.js', () => ({
  getStructureRequirements: vi.fn((name: string) => {
    if (name === 'TENT') {
      return { area: 1, solar: 0, wind: 0 };
    }
    if (name === 'FARM') {
      return { area: 2, solar: 1, wind: 0 };
    }
    return { area: 1, solar: 0, wind: 0 };
  }),
}));

vi.mock('../../../src/data/structure-modifiers.js', () => ({
  getStructureModifiers: vi.fn((name: string) => {
    if (name === 'FARM') {
      return [
        { name: 'Food Production', description: 'Increases food production', value: 10 },
      ];
    }
    return [];
  }),
}));

// Mock authentication middleware to use real profile IDs
vi.mock('../../../src/api/middleware/auth.js', () => ({
  authenticate: (req: any, res: any, next: any) => {
    // Extract profile ID from Authorization header (format: "Bearer <profileId>")
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ code: 'NO_SESSION' });
    }

    const profileId = authHeader.split(' ')[1];
    req.user = {
      id: `account-${profileId}`,
      profileId: profileId,
      role: 'player',
    };
    next();
  },
}));

describe('Structures API Routes', () => {
  let app: express.Application;
  let testChain: TestEntityChain | undefined;

  beforeEach(async () => {
    testChain = await createTestSettlement();
    
    app = express();
    app.use(express.json());
    app.use('/api/structures', structuresRouter);
  });

  afterEach(async () => {
    await cleanupTestChain(testChain);
  });

  describe('GET /api/structures/:id', () => {
    it('should return structure details', async () => {
      const structureChain = await createTestSettlementWithStructure({ structureType: 'TENT' });

      const response = await request(app)
        .get(`/api/structures/${structureChain.structure!.id}`)
        .set('Authorization', `Bearer ${structureChain.profile.id}`)
        .expect(200);

      expect(response.body.id).toBe(structureChain.structure!.id);
      expect(response.body.category).toBe('BUILDING');
      expect(response.body.buildingType).toBe('HOUSE'); // Tent's buildingType is HOUSE in the database

      // Verify in database
      const dbStructure = await db.query.settlementStructures.findFirst({
        where: eq(settlementStructures.id, structureChain.structure!.id),
      });
      expect(dbStructure).toBeDefined();
      expect(dbStructure!.id).toBe(structureChain.structure!.id);

      await cleanupTestChain(structureChain);
    });

    it('should return 404 if structure not found', async () => {
      const response = await request(app)
        .get('/api/structures/nonexistent-id')
        .set('Authorization', `Bearer ${testChain!.profile.id}`)
        .expect(404);

      expect(response.body.code).toBe('STRUCTURE_NOT_FOUND');
    });

    it('should return 401 without authentication', async () => {
      const structureChain = await createTestSettlementWithStructure({ structureType: 'TENT' });

      const response = await request(app)
        .get(`/api/structures/${structureChain.structure!.id}`)
        .expect(401);

      expect(response.body.code).toBe('NO_SESSION');

      await cleanupTestChain(structureChain);
    });
  });

  describe('GET /api/structures/by-settlement/:settlementId', () => {
    it('should return all structures for a settlement', async () => {
      // Add structures to the base settlement
      // Need to look up master structure definitions first
      const tentStructure = await db.query.structures.findFirst({
        where: (structures, { eq }) => eq(structures.name, 'Tent'),
      });
      const houseStructure = await db.query.structures.findFirst({
        where: (structures, { eq }) => eq(structures.name, 'House'),
      });

      if (!tentStructure || !houseStructure) {
        throw new Error('Master structure definitions not found');
      }

      const structure1Id = createId();
      await db.insert(settlementStructures).values({
        id: structure1Id,
        structureId: tentStructure.id, // FK to master structure
        settlementId: testChain!.settlement.id,
        level: 1,
        health: 100,
      });

      const structure2Id = createId();
      await db.insert(settlementStructures).values({
        id: structure2Id,
        structureId: houseStructure.id, // FK to master structure
        settlementId: testChain!.settlement.id,
        level: 1,
        health: 100,
      });

      const response = await request(app)
        .get(`/api/structures/by-settlement/${testChain!.settlement.id}`)
        .set('Authorization', `Bearer ${testChain!.profile.id}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
      
      const ids = response.body.map((s: any) => s.id);
      expect(ids).toContain(structure1Id);
      expect(ids).toContain(structure2Id);
    });

    it('should return empty array if no structures', async () => {
      const emptySettlement = await createTestSettlement();

      const response = await request(app)
        .get(`/api/structures/by-settlement/${emptySettlement.settlement.id}`)
        .set('Authorization', `Bearer ${emptySettlement.profile.id}`)
        .expect(200);

      expect(response.body).toEqual([]);

      await cleanupTestChain(emptySettlement);
    });
  });

  describe('POST /api/structures/:id/upgrade', () => {
    it('should upgrade structure level', async () => {
      const structureChain = await createTestSettlementWithStructure({ structureType: 'TENT' });
      const originalLevel = structureChain.structure!.level;

      const response = await request(app)
        .post(`/api/structures/${structureChain.structure!.id}/upgrade`)
        .set('Authorization', `Bearer ${structureChain.profile.id}`)
        .expect(200);

      expect(response.body.level).toBe(originalLevel + 1);

      // Verify in database
      const dbStructure = await db.query.settlementStructures.findFirst({
        where: eq(settlementStructures.id, structureChain.structure!.id),
      });
      expect(dbStructure!.level).toBe(originalLevel + 1);

      await cleanupTestChain(structureChain);
    });

    it('should return 404 if structure not found', async () => {
      const response = await request(app)
        .post('/api/structures/nonexistent-id/upgrade')
        .set('Authorization', `Bearer ${testChain!.profile.id}`)
        .expect(404);

      expect(response.body.code).toBe('STRUCTURE_NOT_FOUND');
    });

    it('should return 403 if user does not own settlement', async () => {
      const structureChain = await createTestSettlementWithStructure({ structureType: 'TENT' });
      const otherChain = await createTestSettlement();

      const response = await request(app)
        .post(`/api/structures/${structureChain.structure!.id}/upgrade`)
        .set('Authorization', `Bearer ${otherChain.profile.id}`)
        .expect(403);

      expect(response.body.code).toBe('NOT_SETTLEMENT_OWNER');

      await cleanupTestChain(structureChain);
      await cleanupTestChain(otherChain);
    });
  });

  describe('DELETE /api/structures/:id', () => {
    it('should demolish structure', async () => {
      const structureChain = await createTestSettlementWithStructure({ structureType: 'TENT' });
      const structureId = structureChain.structure!.id;

      const response = await request(app)
        .delete(`/api/structures/${structureId}`)
        .set('Authorization', `Bearer ${structureChain.profile.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify deletion in database
      const dbStructure = await db.query.settlementStructures.findFirst({
        where: eq(settlementStructures.id, structureId),
      });
      expect(dbStructure).toBeUndefined();

      await cleanupTestChain(structureChain);
    });

    it('should return 404 if structure not found', async () => {
      const response = await request(app)
        .delete('/api/structures/nonexistent-id')
        .set('Authorization', `Bearer ${testChain!.profile.id}`)
        .expect(404);

      expect(response.body.code).toBe('STRUCTURE_NOT_FOUND');
    });

    it('should return 403 if user does not own settlement', async () => {
      const structureChain = await createTestSettlementWithStructure({ structureType: 'TENT' });
      const otherChain = await createTestSettlement();

      const response = await request(app)
        .delete(`/api/structures/${structureChain.structure!.id}`)
        .set('Authorization', `Bearer ${otherChain.profile.id}`)
        .expect(403);

      expect(response.body.code).toBe('NOT_SETTLEMENT_OWNER');

      await cleanupTestChain(structureChain);
      await cleanupTestChain(otherChain);
    });
  });

  describe('GET /api/structures/metadata', () => {
    it('should return all structure metadata', async () => {
      const response = await request(app)
        .get('/api/structures/metadata')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(2); // TENT and FARM from mocks

      // Verify first structure (TENT)
      const tent = response.body.data[0];
      expect(tent).toEqual({
        id: 'tent',
        name: 'TENT',
        displayName: 'Tent',
        description: 'A simple tent for starting out',
        category: 'HOUSING',
        tier: 1,
        costs: { food: 0, water: 0, wood: 10, stone: 0, ore: 0 },
        constructionTimeSeconds: 0,
        populationRequired: 0,
        requirements: { area: 1, solar: 0, wind: 0 },
        modifiers: [],
      });

      // Verify second structure (FARM)
      const farm = response.body.data[1];
      expect(farm).toEqual({
        id: 'farm',
        name: 'FARM',
        displayName: 'Farm',
        description: 'Produces food',
        category: 'PRODUCTION',
        tier: 1,
        costs: { food: 0, water: 0, wood: 20, stone: 10, ore: 0 },
        constructionTimeSeconds: 180,
        populationRequired: 2,
        requirements: { area: 2, solar: 1, wind: 0 },
        modifiers: [
          { name: 'Food Production', description: 'Increases food production', value: 10 },
        ],
      });
    });

    it('should handle errors when fetching metadata', async () => {
      // Import mocked functions to override behavior
      const { getAllStructureCosts } = await import('../../../src/data/structure-costs.js');

      // Make getAllStructureCosts throw an error
      vi.mocked(getAllStructureCosts).mockImplementationOnce(() => {
        throw new Error('Database connection failed');
      });

      const response = await request(app)
        .get('/api/structures/metadata')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Internal Server Error',
        code: 'METADATA_FETCH_FAILED',
        message: 'Failed to fetch structure metadata',
      });
    });

    it('should include all required fields in metadata response', async () => {
      const response = await request(app)
        .get('/api/structures/metadata')
        .expect(200);

      const structure = response.body.data[0];

      // Verify all required fields are present
      expect(structure).toHaveProperty('id');
      expect(structure).toHaveProperty('name');
      expect(structure).toHaveProperty('displayName');
      expect(structure).toHaveProperty('description');
      expect(structure).toHaveProperty('category');
      expect(structure).toHaveProperty('tier');
      expect(structure).toHaveProperty('costs');
      expect(structure).toHaveProperty('constructionTimeSeconds');
      expect(structure).toHaveProperty('populationRequired');
      expect(structure).toHaveProperty('requirements');
      expect(structure).toHaveProperty('modifiers');

      // Verify cost structure
      expect(structure.costs).toHaveProperty('food');
      expect(structure.costs).toHaveProperty('water');
      expect(structure.costs).toHaveProperty('wood');
      expect(structure.costs).toHaveProperty('stone');
      expect(structure.costs).toHaveProperty('ore');

      // Verify requirements structure
      expect(structure.requirements).toHaveProperty('area');
      expect(structure.requirements).toHaveProperty('solar');
      expect(structure.requirements).toHaveProperty('wind');
    });
  });
});
