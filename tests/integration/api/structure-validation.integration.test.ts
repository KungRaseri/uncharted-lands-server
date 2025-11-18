/**
 * Integration Tests for Structure Validation System
 * 
 * Tests the complete flow from API endpoints through validation to database operations.
 * Verifies:
 * - POST /api/plots/cla    describe('POST /api/structures/create', () => {
      it('should successfully build FARM extractor with sufficient resources', async () => {-and-build-extractor (extractor building with validation)
 * - POST /api/structures/create (building creation with validation)
 * - Resource deduction occurs correctly in database
 * - Error handling for insufficient resources
 * - Transaction rollback on failures
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { db } from '../../../src/db';
import { 
  accounts, 
  profiles, 
  worlds, 
  settlements, 
  settlementStorage, 
  tiles,
  plots,
  settlementStructures,
  servers,
  regions,
  biomes
} from '../../../src/db/schema';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import apiRouter from '../../../src/api/index';

// Create test Express app
const app = express();
app.use(express.json());
app.use('/api', apiRouter);

describe('Structure Validation Integration Tests', () => {
  let testAccountId: string;
  let testProfileId: string;
  let testWorldId: string;
  let testSettlementId: string;
  let testStorageId: string;
  let testTileId: string;
  let testPlotId: string;
  let sessionCookie: string;

  beforeAll(async () => {
    // Create test account with session token
    testAccountId = createId();
    const sessionToken = createId();
    await db.insert(accounts).values({
      id: testAccountId,
      email: `test-validation-${Date.now()}@example.com`,
      passwordHash: 'test-hash',
      userAuthToken: sessionToken,
      role: 'MEMBER',
    });
    
    // Set session cookie for authenticated requests
    sessionCookie = `session=${sessionToken}`;

    // Create test profile
    testProfileId = createId();
    await db.insert(profiles).values({
      id: testProfileId,
      accountId: testAccountId,
      username: `test-user-${Date.now()}`,
      picture: 'https://example.com/test-avatar.png',
    });

  // Create test server with unique hostname/port
  const testServerId = createId();
  await db.insert(servers).values({
    id: testServerId,
    name: `Test Server ${Date.now()}`,
    hostname: `test-${Date.now()}.local`,
    port: 50000 + Math.floor(Math.random() * 10000),
  });

    // Create test world
    testWorldId = createId();
    await db.insert(worlds).values({
      id: testWorldId,
      name: `Test World ${Date.now()}`,
      serverId: testServerId,
      status: 'ready',
      worldTemplateType: 'STANDARD',
      elevationSettings: {},
      precipitationSettings: {},
      temperatureSettings: {},
    });

    // Create test region
    const testRegionId = createId();
    await db.insert(regions).values({
      id: testRegionId,
      worldId: testWorldId,
      name: 'Test Region',
      xCoord: 0,
      yCoord: 0,
      elevationMap: {},
      precipitationMap: {},
      temperatureMap: {},
    });

    // Create test biome
    const testBiomeId = createId();
    await db.insert(biomes).values({
      id: testBiomeId,
      name: `Test Biome ${Date.now()}`, // Unique name to avoid conflicts
      precipitationMin: 0,
      precipitationMax: 100,
      temperatureMin: -50,
      temperatureMax: 50,
    });

    // Create test tile
    testTileId = createId();
    await db.insert(tiles).values({
      id: testTileId,
      type: 'LAND', // Required: must be 'OCEAN' or 'LAND'
      biomeId: testBiomeId,
      regionId: testRegionId,
      xCoord: 0,
      yCoord: 0,
      elevation: 50,
      temperature: 20,
      precipitation: 50,
    });

    // Create settlement storage first (required for settlement.settlementStorageId)
    testStorageId = createId();
    await db.insert(settlementStorage).values({
      id: testStorageId,
      food: 100,
      water: 100,
      wood: 100,
      stone: 100,
      ore: 100,
    });

    // Create plot (required for settlement.plotId)
    const testPlotId = createId();
    await db.insert(plots).values({
      id: testPlotId,
      tileId: testTileId,
      position: 0,
    });

    // Create test settlement with storage ID and plot ID
    testSettlementId = createId();
    await db.insert(settlements).values({
      id: testSettlementId,
      playerProfileId: testProfileId,
      plotId: testPlotId, // Use plot ID, not tile ID
      settlementStorageId: testStorageId, // Required NOT NULL field
      name: 'Test Settlement',
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await db.delete(settlementStructures).where(eq(settlementStructures.settlementId, testSettlementId));
    await db.delete(plots).where(eq(plots.settlementId, testSettlementId));
    await db.delete(settlementStorage).where(eq(settlementStorage.id, testStorageId));
    await db.delete(settlements).where(eq(settlements.id, testSettlementId));
    await db.delete(tiles).where(eq(tiles.id, testTileId));
    await db.delete(worlds).where(eq(worlds.id, testWorldId));
    await db.delete(profiles).where(eq(profiles.id, testProfileId));
    await db.delete(accounts).where(eq(accounts.id, testAccountId));
  });

  beforeEach(async () => {
    // Reset storage to known state before each test
    await db
      .update(settlementStorage)
      .set({
        food: 100,
        water: 100,
        wood: 100,
        stone: 100,
        ore: 100,
      })
      .where(eq(settlementStorage.id, testStorageId));

    // Clear any structures created in previous tests
    await db.delete(settlementStructures).where(eq(settlementStructures.settlementId, testSettlementId));
    await db.delete(plots).where(eq(plots.settlementId, testSettlementId));
  });

  describe('POST /api/structures/create', () => {
    test('should successfully build FARM extractor with sufficient resources', async () => {
      // Arrange: Ensure sufficient resources (FARM costs: wood:20, stone:10, ore:0)
      await db
        .update(settlementStorage)
        .set({ wood: 50, stone: 30, ore: 10 })
        .where(eq(settlementStorage.id, testStorageId));

      // Act: Build FARM extractor
      const response = await request(app)
        .post('/api/structures/create')
        .set('Cookie', sessionCookie)
        .send({
          settlementId: testSettlementId,
          structureType: 'farm',
        });

      // Assert: Request succeeds
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        plot: expect.objectContaining({
          settlementId: testSettlementId,
          tileId: testTileId,
        }),
        structure: expect.objectContaining({
          type: 'FARM',
          category: 'EXTRACTOR',
        }),
      });

      // Assert: Resources deducted correctly
      const storage = await db.query.settlementStorage.findFirst({
        where: eq(settlementStorage.id, testStorageId),
      });

      expect(storage).toMatchObject({
        wood: 30, // 50 - 20
        stone: 20, // 30 - 10
        ore: 10, // unchanged
      });

      // Assert: Plot created
      const plot = await db.query.plots.findFirst({
        where: eq(plots.tileId, testTileId),
      });
      expect(plot).toBeDefined();
      expect(plot?.settlementId).toBe(testSettlementId);

      // Assert: Structure created
      const structure = await db.query.settlementStructures.findFirst({
        where: eq(settlementStructures.plotId, plot!.id),
      });
      expect(structure).toBeDefined();
      expect(structure?.type).toBe('FARM');
    });

    test('should fail to build LUMBER_MILL with insufficient wood', async () => {
      // Arrange: Insufficient wood (LUMBER_MILL costs: wood:20, stone:10, ore:0)
      await db
        .update(settlementStorage)
        .set({ wood: 10, stone: 30, ore: 10 })
        .where(eq(settlementStorage.id, testStorageId));

      // Act: Attempt to build LUMBER_MILL
      const response = await request(app)
        .post('/api/structures/create')
        .set('Cookie', sessionCookie)
        .send({
          settlementId: testSettlementId,
          structureType: 'lumbermill',
        });

      // Assert: Request fails with shortage details
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Insufficient resources to build structure',
        shortages: [
          {
            type: 'wood',
            required: 20,
            available: 10,
            missing: 10,
          },
        ],
      });

      // Assert: Resources NOT deducted (transaction rolled back)
      const storage = await db.query.settlementStorage.findFirst({
        where: eq(settlementStorage.id, testStorageId),
      });

      expect(storage).toMatchObject({
        wood: 10, // unchanged
        stone: 30, // unchanged
        ore: 10, // unchanged
      });

      // Assert: No plot created
      const plot = await db.query.plots.findFirst({
        where: eq(plots.tileId, testTileId),
      });
      expect(plot).toBeUndefined();

      // Assert: No structure created
      const structures = await db.query.settlementStructures.findMany({
        where: eq(settlementStructures.settlementId, testSettlementId),
      });
      expect(structures).toHaveLength(0);
    });

    test('should fail to build MINE with multiple resource shortages', async () => {
      // Arrange: Insufficient wood and stone (MINE costs: wood:30, stone:20, ore:0)
      await db
        .update(settlementStorage)
        .set({ wood: 10, stone: 5, ore: 10 })
        .where(eq(settlementStorage.id, testStorageId));

      // Act: Attempt to build MINE
      const response = await request(app)
        .post('/api/structures/create')
        .set('Cookie', sessionCookie)
        .send({
          settlementId: testSettlementId,
          structureType: 'mine',
        });

      // Assert: Request fails with multiple shortages
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Insufficient resources to build structure',
        shortages: expect.arrayContaining([
          {
            type: 'wood',
            required: 30,
            available: 10,
            missing: 20,
          },
          {
            type: 'stone',
            required: 20,
            available: 5,
            missing: 15,
          },
        ]),
      });

      // Assert: Resources NOT deducted
      const storage = await db.query.settlementStorage.findFirst({
        where: eq(settlementStorage.id, testStorageId),
      });

      expect(storage).toMatchObject({
        wood: 10,
        stone: 5,
        ore: 10,
      });
    });

    test('should fail with unknown extractor type', async () => {
      // Act: Attempt to build invalid extractor
      const response = await request(app)
        .post('/api/structures/create')
        .set('Cookie', sessionCookie)
        .send({
          settlementId: testSettlementId,
          structureType: 'invalid_type',
        });

      // Assert: Request fails with error
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Unknown structure type'),
      });

      // Assert: No changes to storage
      const storage = await db.query.settlementStorage.findFirst({
        where: eq(settlementStorage.id, testStorageId),
      });

      expect(storage).toMatchObject({
        wood: 100,
        stone: 100,
        ore: 100,
      });
    });
  });

  describe('POST /api/structures/create', () => {
    beforeEach(async () => {
      // Create a plot for building structures
      testPlotId = createId();
      await db.insert(plots).values({
        id: testPlotId,
        tileId: testTileId,
        settlementId: testSettlementId,
      });
    });

    test('should successfully build HOUSE with sufficient resources', async () => {
      // Arrange: Ensure sufficient resources (HOUSE costs: wood:50, stone:20, ore:0)
      await db
        .update(settlementStorage)
        .set({ wood: 80, stone: 40, ore: 10 })
        .where(eq(settlementStorage.id, testStorageId));

      // Act: Build HOUSE
      const response = await request(app)
        .post('/api/structures/create')
        .set('Cookie', sessionCookie)
        .send({
          settlementId: testSettlementId,
          structureType: 'house',
          name: 'Test House',
        });

      // Assert: Request succeeds
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: 'Test House',
        type: 'HOUSE',
        category: 'BUILDING',
        level: 1,
      });

      // Assert: Resources deducted correctly
      const storage = await db.query.settlementStorage.findFirst({
        where: eq(settlementStorage.id, testStorageId),
      });

      expect(storage).toMatchObject({
        wood: 30, // 80 - 50
        stone: 20, // 40 - 20
        ore: 10, // unchanged
      });

      // Assert: Structure created in database
      const structure = await db.query.settlementStructures.findFirst({
        where: eq(settlementStructures.settlementId, testSettlementId),
      });
      expect(structure).toBeDefined();
      expect(structure?.type).toBe('HOUSE');
      expect(structure?.name).toBe('Test House');
    });

    test('should successfully build WORKSHOP with all three resource types', async () => {
      // Arrange: Ensure sufficient resources (WORKSHOP costs: wood:60, stone:60, ore:30)
      await db
        .update(settlementStorage)
        .set({ wood: 100, stone: 100, ore: 50 })
        .where(eq(settlementStorage.id, testStorageId));

      // Act: Build WORKSHOP
      const response = await request(app)
        .post('/api/structures/create')
        .set('Cookie', sessionCookie)
        .send({
          settlementId: testSettlementId,
          structureType: 'workshop',
          name: 'Test Workshop',
        });

      // Assert: Request succeeds
      expect(response.status).toBe(201);

      // Assert: All three resources deducted correctly
      const storage = await db.query.settlementStorage.findFirst({
        where: eq(settlementStorage.id, testStorageId),
      });

      expect(storage).toMatchObject({
        wood: 40, // 100 - 60
        stone: 40, // 100 - 60
        ore: 20, // 50 - 30
      });
    });

    test('should fail to build WAREHOUSE with insufficient stone', async () => {
      // Arrange: Insufficient stone (WAREHOUSE costs: wood:40, stone:20, ore:0)
      await db
        .update(settlementStorage)
        .set({ wood: 50, stone: 10, ore: 10 })
        .where(eq(settlementStorage.id, testStorageId));

      // Act: Attempt to build WAREHOUSE
      const response = await request(app)
        .post('/api/structures/create')
        .set('Cookie', sessionCookie)
        .send({
          settlementId: testSettlementId,
          structureType: 'warehouse',
          name: 'Test Warehouse',
        });

      // Assert: Request fails with shortage details
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Insufficient resources to build structure',
        shortages: [
          {
            type: 'stone',
            required: 20,
            available: 10,
            missing: 10,
          },
        ],
      });

      // Assert: Resources NOT deducted
      const storage = await db.query.settlementStorage.findFirst({
        where: eq(settlementStorage.id, testStorageId),
      });

      expect(storage).toMatchObject({
        wood: 50,
        stone: 10,
        ore: 10,
      });

      // Assert: No structure created
      const structures = await db.query.settlementStructures.findMany({
        where: eq(settlementStructures.settlementId, testSettlementId),
      });
      expect(structures).toHaveLength(0);
    });

    test('should fail to build with zero resources available', async () => {
      // Arrange: Zero resources (TENT costs: wood:10, stone:0, ore:0)
      await db
        .update(settlementStorage)
        .set({ wood: 0, stone: 0, ore: 0 })
        .where(eq(settlementStorage.id, testStorageId));

      // Act: Attempt to build TENT
      const response = await request(app)
        .post('/api/structures/create')
        .set('Cookie', sessionCookie)
        .send({
          settlementId: testSettlementId,
          structureType: 'tent',
          name: 'Test Tent',
        });

      // Assert: Request fails
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Insufficient resources to build structure',
        shortages: [
          {
            type: 'wood',
            required: 10,
            available: 0,
            missing: 10,
          },
        ],
      });
    });

    test('should handle concurrent build requests atomically', async () => {
      // Arrange: Resources for exactly one TENT (wood:10, stone:0, ore:0)
      await db
        .update(settlementStorage)
        .set({ wood: 10, stone: 10, ore: 10 })
        .where(eq(settlementStorage.id, testStorageId));

      // Act: Send two concurrent requests to build TENT
      const [response1, response2] = await Promise.all([
        request(app)
          .post('/api/structures/create')
          .set('Cookie', sessionCookie)
          .send({
            settlementId: testSettlementId,
            structureType: 'tent',
            name: 'Tent 1',
          }),
        request(app)
          .post('/api/structures/create')
          .set('Cookie', sessionCookie)
          .send({
            settlementId: testSettlementId,
            structureType: 'tent',
            name: 'Tent 2',
          }),
      ]);

      // Assert: One succeeds, one fails
      const responses = [response1, response2];
      const successCount = responses.filter((r) => r.status === 201).length;
      const failureCount = responses.filter((r) => r.status === 400).length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);

      // Assert: Resources deducted exactly once
      const storage = await db.query.settlementStorage.findFirst({
        where: eq(settlementStorage.id, testStorageId),
      });

      expect(storage?.wood).toBe(0); // 10 - 10 = 0 (deducted once)

      // Assert: Only one structure created
      const structures = await db.query.settlementStructures.findMany({
        where: eq(settlementStructures.settlementId, testSettlementId),
      });
      expect(structures).toHaveLength(1);
    });
  });

  describe('Transaction Rollback', () => {
    test('should rollback plot creation when structure creation fails', async () => {
      // Arrange: Insufficient resources
      await db
        .update(settlementStorage)
        .set({ wood: 5, stone: 5, ore: 5 })
        .where(eq(settlementStorage.id, testStorageId));

      // Act: Attempt to build extractor with insufficient resources
      const response = await request(app)
        .post('/api/structures/create')
        .set('Cookie', sessionCookie)
        .send({
          settlementId: testSettlementId,
          structureType: 'farm',
        });

      // Assert: Request fails
      expect(response.status).toBe(400);

      // Assert: Plot NOT created (transaction rolled back)
      const plot = await db.query.plots.findFirst({
        where: eq(plots.tileId, testTileId),
      });
      expect(plot).toBeUndefined();

      // Assert: Resources unchanged
      const storage = await db.query.settlementStorage.findFirst({
        where: eq(settlementStorage.id, testStorageId),
      });
      expect(storage).toMatchObject({
        wood: 5,
        stone: 5,
        ore: 5,
      });
    });
  });

  describe('Edge Cases', () => {
    test('should build structure with exact resource match', async () => {
      // Arrange: Exactly enough resources (TENT costs: wood:10, stone:0, ore:0)
      await db
        .update(settlementStorage)
        .set({ wood: 10, stone: 0, ore: 0 })
        .where(eq(settlementStorage.id, testStorageId));

      // Act: Build TENT
      const response = await request(app)
        .post('/api/structures/create')
        .set('Cookie', sessionCookie)
        .send({
          settlementId: testSettlementId,
          structureType: 'tent',
          name: 'Exact Tent',
        });

      // Assert: Request succeeds
      expect(response.status).toBe(201);

      // Assert: Resources reduced to zero
      const storage = await db.query.settlementStorage.findFirst({
        where: eq(settlementStorage.id, testStorageId),
      });

      expect(storage?.wood).toBe(0);
    });

    test('should fail with non-existent settlement', async () => {
      // Act: Attempt to build with invalid settlement ID
      const response = await request(app)
        .post('/api/structures/create')
        .set('Cookie', sessionCookie)
        .send({
          settlementId: 'non-existent-id',
          structureType: 'house',
          name: 'Test House',
        });

      // Assert: Request fails
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: "Not Found",
        message: expect.stringContaining('Settlement not found'),
      });
    });
  });
});
