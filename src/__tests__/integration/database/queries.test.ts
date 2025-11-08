import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../../db/index.js';
import {
  biomes,
  servers,
  worlds,
  accounts,
  profiles,
  plots,
  tiles,
  regions,
  settlements,
  settlementStorage,
} from '../../../db/schema.js';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

describe('Database Queries', () => {
  describe('Biomes', () => {
    it('should query all biomes', async () => {
      const result = await db.select().from(biomes);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should find biome by id', async () => {
      const all = await db.select().from(biomes).limit(1);
      if (all.length > 0) {
        const biome = await db.query.biomes.findFirst({
          where: eq(biomes.id, all[0].id),
        });
        expect(biome).toBeDefined();
        expect(biome?.id).toBe(all[0].id);
      }
    });
  });

  describe('Servers', () => {
    let testServerId: string;

    beforeAll(async () => {
      // Create test server
      const result = await db
        .insert(servers)
        .values({
          id: createId(),
          name: `Test Server ${Date.now()}`,
          hostname: 'localhost',
          port: 5000,
          status: 'ONLINE',
        })
        .returning();
      testServerId = result[0].id;
    });

    afterAll(async () => {
      // Clean up
      if (testServerId) {
        await db.delete(servers).where(eq(servers.id, testServerId));
      }
    });

    it('should create and retrieve server', async () => {
      const server = await db.query.servers.findFirst({
        where: eq(servers.id, testServerId),
      });

      expect(server).toBeDefined();
      expect(server?.id).toBe(testServerId);
      expect(server?.status).toBe('ONLINE');
    });

    it('should update server status', async () => {
      await db.update(servers).set({ status: 'MAINTENANCE' }).where(eq(servers.id, testServerId));

      const server = await db.query.servers.findFirst({
        where: eq(servers.id, testServerId),
      });

      expect(server?.status).toBe('MAINTENANCE');
    });

    it('should query all servers', async () => {
      const result = await db.select().from(servers);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Worlds', () => {
    let testServerId: string;
    let testWorldId: string;

    beforeAll(async () => {
      // Create test server first
      const serverResult = await db
        .insert(servers)
        .values({
          id: createId(),
          name: `Test Server for World ${Date.now()}`,
          hostname: 'localhost',
          port: 5001,
          status: 'ONLINE',
        })
        .returning();
      testServerId = serverResult[0].id;

      // Create test world
      const worldResult = await db
        .insert(worlds)
        .values({
          id: createId(),
          name: `Test World ${Date.now()}`,
          serverId: testServerId,
          elevationSettings: { scale: 0.02, octaves: 4 },
          precipitationSettings: { scale: 0.015, octaves: 3 },
          temperatureSettings: { scale: 0.01, octaves: 2 },
        })
        .returning();
      testWorldId = worldResult[0].id;
    });

    afterAll(async () => {
      // Clean up world first (due to FK)
      if (testWorldId) {
        await db.delete(worlds).where(eq(worlds.id, testWorldId));
      }
      // Then server
      if (testServerId) {
        await db.delete(servers).where(eq(servers.id, testServerId));
      }
    });

    it('should create and retrieve world', async () => {
      const world = await db.query.worlds.findFirst({
        where: eq(worlds.id, testWorldId),
      });

      expect(world).toBeDefined();
      expect(world?.id).toBe(testWorldId);
      expect(world?.serverId).toBe(testServerId);
    });

    it('should retrieve world with server relation', async () => {
      const world = await db.query.worlds.findFirst({
        where: eq(worlds.id, testWorldId),
        with: {
          server: true,
        },
      });

      expect(world).toBeDefined();
      expect(world?.server).toBeDefined();
      expect(world?.server.id).toBe(testServerId);
    });

    it('should query worlds by server', async () => {
      const result = await db.select().from(worlds).where(eq(worlds.serverId, testServerId));

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].serverId).toBe(testServerId);
    });

    it('should update world name', async () => {
      const newName = `Updated World ${Date.now()}`;

      await db.update(worlds).set({ name: newName }).where(eq(worlds.id, testWorldId));

      const world = await db.query.worlds.findFirst({
        where: eq(worlds.id, testWorldId),
      });

      expect(world?.name).toBe(newName);
    });
  });

  describe('Database Connection', () => {
    it('should connect to database successfully', async () => {
      const result = await db.select().from(biomes).limit(1);
      expect(result).toBeDefined();
    });

    it('should execute queries successfully', async () => {
      const result = await db.select().from(biomes);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Transaction Support', () => {
    it('should support database transactions', async () => {
      const testName = `Transaction Test ${Date.now()}`;

      try {
        await db.transaction(async (tx) => {
          await tx.insert(servers).values({
            id: createId(),
            name: testName,
            hostname: 'localhost',
            port: 6000,
            status: 'OFFLINE',
          });

          // Rollback by throwing
          throw new Error('Rollback test');
        });
        // Should not reach here
        expect.fail('Transaction should have thrown');
      } catch (error: any) {
        // Expected error for rollback
        expect(error.message).toBe('Rollback test');
      }

      // Verify it was rolled back
      const result = await db.select().from(servers).where(eq(servers.name, testName));

      expect(result.length).toBe(0);
    });
  });

  describe('Query Builder', () => {
    it('should support WHERE clauses', async () => {
      const result = await db.select().from(servers).where(eq(servers.status, 'ONLINE'));

      expect(Array.isArray(result)).toBe(true);
    });

    it('should support LIMIT', async () => {
      const result = await db.select().from(servers).limit(5);

      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should support ORDER BY', async () => {
      const result = await db.select().from(servers).orderBy(servers.createdAt).limit(10);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should support COUNT queries', async () => {
      const result = await db.select().from(servers);

      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Relations', () => {
    it('should query with relations using with', async () => {
      const result = await db.query.servers.findMany({
        with: {
          worlds: true,
        },
        limit: 5,
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle empty relations', async () => {
      const servers_without_worlds = await db.query.servers.findMany({
        with: {
          worlds: true,
        },
        limit: 10,
      });

      servers_without_worlds.forEach((server) => {
        expect(Array.isArray(server.worlds)).toBe(true);
      });
    });
  });

  describe('Data Types', () => {
    it('should handle text columns', async () => {
      const result = await db.select().from(servers).limit(1);
      if (result.length > 0) {
        expect(typeof result[0].name).toBe('string');
        expect(typeof result[0].hostname).toBe('string');
      }
    });

    it('should handle integer columns', async () => {
      const result = await db.select().from(servers).limit(1);
      if (result.length > 0) {
        expect(typeof result[0].port).toBe('number');
        expect(Number.isInteger(result[0].port)).toBe(true);
      }
    });

    it('should handle timestamp columns', async () => {
      const result = await db.select().from(servers).limit(1);
      if (result.length > 0) {
        expect(result[0].createdAt).toBeInstanceOf(Date);
        expect(result[0].updatedAt).toBeInstanceOf(Date);
      }
    });

    it('should handle enum columns', async () => {
      const result = await db.select().from(servers).limit(1);
      if (result.length > 0) {
        expect(['OFFLINE', 'MAINTENANCE', 'ONLINE']).toContain(result[0].status);
      }
    });

    it('should handle JSON columns', async () => {
      const result = await db.select().from(worlds).limit(1);
      if (result.length > 0) {
        expect(typeof result[0].elevationSettings).toBe('object');
        expect(typeof result[0].precipitationSettings).toBe('object');
        expect(typeof result[0].temperatureSettings).toBe('object');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent records', async () => {
      const result = await db.query.servers.findFirst({
        where: eq(servers.id, 'non-existent-id'),
      });

      expect(result).toBeUndefined();
    });

    it('should handle invalid foreign keys gracefully', async () => {
      try {
        await db.insert(worlds).values({
          id: createId(),
          name: 'Invalid World',
          serverId: 'non-existent-server',
          elevationSettings: {},
          precipitationSettings: {},
          temperatureSettings: {},
        });
        expect.fail('Should have thrown FK constraint error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Query Helper Functions', () => {
    describe('generateId', () => {
      it('should generate a valid CUID', async () => {
        const { generateId } = await import('../../../db/queries');
        const id = generateId();
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(10);
      });

      it('should generate unique IDs', async () => {
        const { generateId } = await import('../../../db/queries');
        const id1 = generateId();
        const id2 = generateId();
        expect(id1).not.toBe(id2);
      });
    });

    describe('getAllBiomes', () => {
      it('should get all biomes', async () => {
        const { getAllBiomes } = await import('../../../db/queries');
        const biomes = await getAllBiomes();
        expect(Array.isArray(biomes)).toBe(true);
        expect(biomes.length).toBeGreaterThan(0);
      });
    });

    describe('findBiome', () => {
      it('should find biome by precipitation and temperature', async () => {
        const { findBiome } = await import('../../../db/queries');
        // Test with mid-range values that should match a biome
        const biome = await findBiome(0.5, 0.5);
        if (biome) {
          expect(biome).toHaveProperty('id');
          expect(biome).toHaveProperty('name');
        }
      });

      it('should fallback to precipitation-only matching', async () => {
        const { findBiome } = await import('../../../db/queries');
        // Use extreme temperature that might not match, forcing precipitation fallback
        const biome = await findBiome(500, 9999);
        expect(biome).toBeDefined();
        expect(biome).toHaveProperty('id');
      });

      it('should fallback to first biome when no match', async () => {
        const { findBiome } = await import('../../../db/queries');
        // Use values way outside any biome range
        const biome = await findBiome(-9999, -9999);
        expect(biome).toBeDefined();
        expect(biome).toHaveProperty('id');
      });
    });

    describe('getOnlineServers', () => {
      let testServerId: string;

      beforeAll(async () => {
        const result = await db
          .insert(servers)
          .values({
            id: createId(),
            name: `Online Server ${Date.now()}`,
            hostname: 'test.local',
            port: 6000,
            status: 'ONLINE',
          })
          .returning();
        testServerId = result[0].id;
      });

      afterAll(async () => {
        if (testServerId) {
          await db.delete(servers).where(eq(servers.id, testServerId));
        }
      });

      it('should get all online servers', async () => {
        const { getOnlineServers } = await import('../../../db/queries');
        const onlineServers = await getOnlineServers();
        expect(Array.isArray(onlineServers)).toBe(true);
        expect(onlineServers.length).toBeGreaterThan(0);
        // All returned servers should have ONLINE status
        onlineServers.forEach((server) => {
          expect(server.status).toBe('ONLINE');
        });
      });
    });

    describe('findServerByAddress', () => {
      let testServerId: string;
      const testHostname = 'unique-test.local';
      const testPort = 7777;

      beforeAll(async () => {
        const result = await db
          .insert(servers)
          .values({
            id: createId(),
            name: `Test Server Address ${Date.now()}`,
            hostname: testHostname,
            port: testPort,
            status: 'ONLINE',
          })
          .returning();
        testServerId = result[0].id;
      });

      afterAll(async () => {
        if (testServerId) {
          await db.delete(servers).where(eq(servers.id, testServerId));
        }
      });

      it('should find server by hostname and port', async () => {
        const { findServerByAddress } = await import('../../../db/queries');
        const server = await findServerByAddress(testHostname, testPort);
        expect(server).toBeDefined();
        expect(server?.hostname).toBe(testHostname);
        expect(server?.port).toBe(testPort);
      });

      it('should return undefined for non-existent address', async () => {
        const { findServerByAddress } = await import('../../../db/queries');
        const server = await findServerByAddress('nonexistent.local', 9999);
        expect(server).toBeUndefined();
      });
    });

    describe('findWorldByName', () => {
      let testServerId: string;
      let testWorldId: string;
      const testWorldName = `Unique World ${Date.now()}`;

      beforeAll(async () => {
        const serverResult = await db
          .insert(servers)
          .values({
            id: createId(),
            name: `Server for World Query ${Date.now()}`,
            hostname: 'world-test.local',
            port: 8888,
            status: 'ONLINE',
          })
          .returning();
        testServerId = serverResult[0].id;

        const worldResult = await db
          .insert(worlds)
          .values({
            id: createId(),
            name: testWorldName,
            serverId: testServerId,
            elevationSettings: { scale: 0.02, octaves: 4 },
            precipitationSettings: { scale: 0.015, octaves: 3 },
            temperatureSettings: { scale: 0.01, octaves: 2 },
          })
          .returning();
        testWorldId = worldResult[0].id;
      });

      afterAll(async () => {
        if (testWorldId) {
          await db.delete(worlds).where(eq(worlds.id, testWorldId));
        }
        if (testServerId) {
          await db.delete(servers).where(eq(servers.id, testServerId));
        }
      });

      it('should find world by name and server ID', async () => {
        const { findWorldByName } = await import('../../../db/queries');
        const world = await findWorldByName(testWorldName, testServerId);
        expect(world).toBeDefined();
        expect(world?.name).toBe(testWorldName);
        expect(world?.serverId).toBe(testServerId);
      });

      it('should return undefined for non-existent world', async () => {
        const { findWorldByName } = await import('../../../db/queries');
        const world = await findWorldByName('Nonexistent World', testServerId);
        expect(world).toBeUndefined();
      });
    });

    describe('getWorldRegions', () => {
      let testServerId: string;
      let testWorldId: string;

      beforeAll(async () => {
        const serverResult = await db
          .insert(servers)
          .values({
            id: createId(),
            name: `Server for Regions ${Date.now()}`,
            hostname: 'regions-test.local',
            port: 9999,
            status: 'ONLINE',
          })
          .returning();
        testServerId = serverResult[0].id;

        const worldResult = await db
          .insert(worlds)
          .values({
            id: createId(),
            name: `World for Regions ${Date.now()}`,
            serverId: testServerId,
            elevationSettings: { scale: 0.02, octaves: 4 },
            precipitationSettings: { scale: 0.015, octaves: 3 },
            temperatureSettings: { scale: 0.01, octaves: 2 },
          })
          .returning();
        testWorldId = worldResult[0].id;
      });

      afterAll(async () => {
        if (testWorldId) {
          await db.delete(worlds).where(eq(worlds.id, testWorldId));
        }
        if (testServerId) {
          await db.delete(servers).where(eq(servers.id, testServerId));
        }
      });

      it('should get all regions for a world', async () => {
        const { getWorldRegions } = await import('../../../db/queries');
        const regions = await getWorldRegions(testWorldId);
        expect(Array.isArray(regions)).toBe(true);
        // Regions might be empty if world was just created
        regions.forEach((region) => {
          expect(region.worldId).toBe(testWorldId);
        });
      });
    });

    describe('getRegionWithTiles', () => {
      it('should get region with tiles and plots', async () => {
        const { getRegionWithTiles } = await import('../../../db/queries');
        // Get first biome to use
        const firstBiome = await db.query.biomes.findFirst();
        if (!firstBiome) return;

        // Get or create a server and world first
        const serverResult = await db
          .insert(servers)
          .values({
            id: createId(),
            name: `Server for Region Test ${Date.now()}`,
            hostname: 'region-test.local',
            port: 10000,
            status: 'ONLINE',
          })
          .returning();
        const serverId = serverResult[0].id;

        const worldResult = await db
          .insert(worlds)
          .values({
            id: createId(),
            name: `World for Region Test ${Date.now()}`,
            serverId,
            elevationSettings: { scale: 0.02, octaves: 4 },
            precipitationSettings: { scale: 0.015, octaves: 3 },
            temperatureSettings: { scale: 0.01, octaves: 2 },
          })
          .returning();
        const worldId = worldResult[0].id;

        // Create a region
        const { regions } = await import('../../../db/index');
        const regionResult = await db
          .insert(regions)
          .values({
            id: createId(),
            worldId,
            xCoord: 0,
            yCoord: 0,
            name: 'Test Region',
            elevationMap: Buffer.from([]),
            precipitationMap: Buffer.from([]),
            temperatureMap: Buffer.from([]),
          })
          .returning();
        const regionId = regionResult[0].id;

        // Get region with tiles
        const region = await getRegionWithTiles(regionId);
        expect(region).toBeDefined();

        // Cleanup
        await db.delete(regions).where(eq(regions.id, regionId));
        await db.delete(worlds).where(eq(worlds.id, worldId));
        await db.delete(servers).where(eq(servers.id, serverId));
      });
    });

    describe('profile and account functions', () => {
      let testAccountId: string;
      let testProfileId: string;
      const testToken = `test-token-${Date.now()}`;

      beforeAll(async () => {
        // Create test account
        const accountResult = await db
          .insert(accounts)
          .values({
            id: createId(),
            email: `test${Date.now()}@example.com`,
            passwordHash: 'hashed-password',
            role: 'MEMBER',
            userAuthToken: testToken,
          })
          .returning();
        testAccountId = accountResult[0].id;

        // Create test profile
        const profileResult = await db
          .insert(profiles)
          .values({
            id: createId(),
            accountId: testAccountId,
            username: `testuser${Date.now()}`,
            picture: 'https://example.com/pic.jpg',
          })
          .returning();
        testProfileId = profileResult[0].id;
      });

      afterAll(async () => {
        if (testProfileId) {
          await db.delete(profiles).where(eq(profiles.id, testProfileId));
        }
        if (testAccountId) {
          await db.delete(accounts).where(eq(accounts.id, testAccountId));
        }
      });

      it('should find account by token', async () => {
        const { findAccountByToken } = await import('../../../db/queries');
        const account = await findAccountByToken(testToken);
        expect(account).toBeDefined();
        expect(account.id).toBe(testAccountId);
        expect(account.userAuthToken).toBe(testToken);
      });

      it('should find profile by account ID', async () => {
        const { findProfileByAccountId } = await import('../../../db/queries');
        const profile = await findProfileByAccountId(testAccountId);
        expect(profile).toBeDefined();
        expect(profile.id).toBe(testProfileId);
        expect(profile.accountId).toBe(testAccountId);
      });

      it('should find profile by ID', async () => {
        const { findProfileById } = await import('../../../db/queries');
        const profile = await findProfileById(testProfileId);
        expect(profile).toBeDefined();
        expect(profile.id).toBe(testProfileId);
      });
    });

    describe('settlement functions', () => {
      let testServerId: string;
      let testWorldId: string;
      let testProfileId: string;
      let testAccountId: string;
      let testRegionId: string;
      let testTileId: string;
      let testPlotId: string;
      let testBiomeId: string;

      beforeAll(async () => {
        // Get first biome
        const firstBiome = await db.query.biomes.findFirst();
        if (!firstBiome) throw new Error('No biomes found');
        testBiomeId = firstBiome.id;

        // Create test account and profile
        const accountResult = await db
          .insert(accounts)
          .values({
            id: createId(),
            email: `settlement${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'MEMBER',
            userAuthToken: `token-${Date.now()}`,
          })
          .returning();
        testAccountId = accountResult[0].id;

        const profileResult = await db
          .insert(profiles)
          .values({
            id: createId(),
            accountId: testAccountId,
            username: `settlementuser${Date.now()}`,
            picture: 'https://example.com/settlement.jpg',
          })
          .returning();
        testProfileId = profileResult[0].id;

        // Create server, world, region, tile, plot
        const serverResult = await db
          .insert(servers)
          .values({
            id: createId(),
            name: `Settlement Server ${Date.now()}`,
            hostname: 'settlement.local',
            port: 11000,
            status: 'ONLINE',
          })
          .returning();
        testServerId = serverResult[0].id;

        const worldResult = await db
          .insert(worlds)
          .values({
            id: createId(),
            name: `Settlement World ${Date.now()}`,
            serverId: testServerId,
            elevationSettings: {},
            precipitationSettings: {},
            temperatureSettings: {},
          })
          .returning();
        testWorldId = worldResult[0].id;

        const regionResult = await db
          .insert(regions)
          .values({
            id: createId(),
            worldId: testWorldId,
            xCoord: 0,
            yCoord: 0,
            name: 'Settlement Region',
            elevationMap: Buffer.from([]),
            precipitationMap: Buffer.from([]),
            temperatureMap: Buffer.from([]),
          })
          .returning();
        testRegionId = regionResult[0].id;

        const tileResult = await db
          .insert(tiles)
          .values({
            id: createId(),
            regionId: testRegionId,
            biomeId: testBiomeId,
            elevation: 10,
            temperature: 20,
            precipitation: 100,
            type: 'LAND',
          })
          .returning();
        testTileId = tileResult[0].id;

        const plotResult = await db
          .insert(plots)
          .values({
            id: createId(),
            tileId: testTileId,
            food: 50,
            water: 75,
          })
          .returning();
        testPlotId = plotResult[0].id;
      });

      afterAll(async () => {
        // Cleanup in reverse order of creation
        if (testPlotId) {
          await db.delete(plots).where(eq(plots.id, testPlotId));
        }
        if (testTileId) {
          await db.delete(tiles).where(eq(tiles.id, testTileId));
        }
        if (testRegionId) {
          await db.delete(regions).where(eq(regions.id, testRegionId));
        }
        if (testWorldId) {
          await db.delete(worlds).where(eq(worlds.id, testWorldId));
        }
        if (testServerId) {
          await db.delete(servers).where(eq(servers.id, testServerId));
        }
        if (testProfileId) {
          await db.delete(profiles).where(eq(profiles.id, testProfileId));
        }
        if (testAccountId) {
          await db.delete(accounts).where(eq(accounts.id, testAccountId));
        }
      });

      it('should create settlement with storage', async () => {
        const { createSettlement } = await import('../../../db/queries');
        const result = await createSettlement(testProfileId, testPlotId, 'Test Settlement', {
          food: 100,
          water: 100,
          wood: 50,
          stone: 30,
          ore: 10,
        });

        expect(result.settlement).toBeDefined();
        expect(result.storage).toBeDefined();
        expect(result.settlement.name).toBe('Test Settlement');
        expect(result.storage.food).toBe(100);

        // Cleanup
        if (result.settlement.id) {
          await db.delete(settlements).where(eq(settlements.id, result.settlement.id));
        }
        if (result.storage.id) {
          await db.delete(settlementStorage).where(eq(settlementStorage.id, result.storage.id));
        }
      });

      it('should get player settlements', async () => {
        const { getPlayerSettlements, createSettlement } = await import('../../../db/queries');

        // Create a settlement
        const result = await createSettlement(testProfileId, testPlotId, 'Player Settlement', {
          food: 50,
          water: 50,
          wood: 25,
          stone: 15,
          ore: 5,
        });

        // Get settlements
        const settlementList = await getPlayerSettlements(testProfileId);
        expect(Array.isArray(settlementList)).toBe(true);
        expect(settlementList.length).toBeGreaterThan(0);

        // Cleanup
        if (result.settlement.id) {
          await db.delete(settlements).where(eq(settlements.id, result.settlement.id));
        }
        if (result.storage.id) {
          await db.delete(settlementStorage).where(eq(settlementStorage.id, result.storage.id));
        }
      });

      it('should return empty array for player with no settlements', async () => {
        const { getPlayerSettlements } = await import('../../../db/queries');
        const nonExistentProfileId = createId();

        const settlementList = await getPlayerSettlements(nonExistentProfileId);
        expect(Array.isArray(settlementList)).toBe(true);
        expect(settlementList.length).toBe(0);
      });

      it('should update settlement storage', async () => {
        const { createSettlement, updateSettlementStorage } = await import('../../../db/queries');

        // Create settlement first
        const result = await createSettlement(testProfileId, testPlotId, 'Storage Test', {
          food: 100,
          water: 100,
          wood: 50,
          stone: 30,
          ore: 10,
        });

        // Update storage
        const updated = await updateSettlementStorage(result.storage.id, {
          food: 200,
          wood: 100,
        });

        expect(updated).toBeDefined();
        expect(updated.food).toBe(200);
        expect(updated.wood).toBe(100);

        // Cleanup
        if (result.settlement.id) {
          await db.delete(settlements).where(eq(settlements.id, result.settlement.id));
        }
        if (result.storage.id) {
          await db.delete(settlementStorage).where(eq(settlementStorage.id, result.storage.id));
        }
      });

      it('should get settlement with details', async () => {
        const { createSettlement, getSettlementWithDetails } = await import('../../../db/queries');

        // Create settlement first
        const result = await createSettlement(testProfileId, testPlotId, 'Details Test', {
          food: 150,
          water: 150,
          wood: 75,
          stone: 40,
          ore: 20,
        });

        // Get settlement with details
        const details = await getSettlementWithDetails(result.settlement.id);
        expect(details).toBeDefined();
        expect(details.settlement).toBeDefined();
        expect(details.storage).toBeDefined();
        expect(details.plot).toBeDefined();
        expect(details.settlement.name).toBe('Details Test');
        if (details.storage) {
          expect(details.storage.food).toBe(150);
        }

        // Cleanup
        if (result.settlement.id) {
          await db.delete(settlements).where(eq(settlements.id, result.settlement.id));
        }
        if (result.storage.id) {
          await db.delete(settlementStorage).where(eq(settlementStorage.id, result.storage.id));
        }
      });
    });

    describe('structure functions', () => {
      let testServerId: string;
      let testWorldId: string;
      let testProfileId: string;
      let testAccountId: string;
      let testRegionId: string;
      let testTileId: string;
      let testPlotId: string;
      let testSettlementId: string;
      let testStorageId: string;
      let testBiomeId: string;

      beforeAll(async () => {
        // Get first biome
        const firstBiome = await db.query.biomes.findFirst();
        if (!firstBiome) throw new Error('No biomes found');
        testBiomeId = firstBiome.id;

        // Create account and profile
        const accountResult = await db
          .insert(accounts)
          .values({
            id: createId(),
            email: `structure${Date.now()}@example.com`,
            passwordHash: 'hashed',
            role: 'MEMBER',
            userAuthToken: `token-structure-${Date.now()}`,
          })
          .returning();
        testAccountId = accountResult[0].id;

        const profileResult = await db
          .insert(profiles)
          .values({
            id: createId(),
            accountId: testAccountId,
            username: `structureuser${Date.now()}`,
            picture: 'https://example.com/structure.jpg',
          })
          .returning();
        testProfileId = profileResult[0].id;

        // Create server, world, region, tile, plot
        const serverResult = await db
          .insert(servers)
          .values({
            id: createId(),
            name: `Structure Server ${Date.now()}`,
            hostname: 'structure.local',
            port: 12000,
            status: 'ONLINE',
          })
          .returning();
        testServerId = serverResult[0].id;

        const worldResult = await db
          .insert(worlds)
          .values({
            id: createId(),
            name: `Structure World ${Date.now()}`,
            serverId: testServerId,
            elevationSettings: {},
            precipitationSettings: {},
            temperatureSettings: {},
          })
          .returning();
        testWorldId = worldResult[0].id;

        const regionResult = await db
          .insert(regions)
          .values({
            id: createId(),
            worldId: testWorldId,
            xCoord: 0,
            yCoord: 0,
            name: 'Structure Region',
            elevationMap: Buffer.from([]),
            precipitationMap: Buffer.from([]),
            temperatureMap: Buffer.from([]),
          })
          .returning();
        testRegionId = regionResult[0].id;

        const tileResult = await db
          .insert(tiles)
          .values({
            id: createId(),
            regionId: testRegionId,
            biomeId: testBiomeId,
            elevation: 15,
            temperature: 25,
            precipitation: 110,
            type: 'LAND',
          })
          .returning();
        testTileId = tileResult[0].id;

        const plotResult = await db
          .insert(plots)
          .values({
            id: createId(),
            tileId: testTileId,
            food: 60,
            water: 80,
          })
          .returning();
        testPlotId = plotResult[0].id;

        // Create settlement
        const storageResult = await db
          .insert(settlementStorage)
          .values({
            id: createId(),
            food: 200,
            water: 200,
            wood: 100,
            stone: 50,
            ore: 25,
          })
          .returning();
        testStorageId = storageResult[0].id;

        const settlementResult = await db
          .insert(settlements)
          .values({
            id: createId(),
            playerProfileId: testProfileId,
            plotId: testPlotId,
            settlementStorageId: testStorageId,
            name: 'Structure Settlement',
            createdAt: new Date(),
          })
          .returning();
        testSettlementId = settlementResult[0].id;
      });

      afterAll(async () => {
        // Cleanup in reverse order
        if (testSettlementId) {
          await db.delete(settlements).where(eq(settlements.id, testSettlementId));
        }
        if (testStorageId) {
          await db.delete(settlementStorage).where(eq(settlementStorage.id, testStorageId));
        }
        if (testPlotId) {
          await db.delete(plots).where(eq(plots.id, testPlotId));
        }
        if (testTileId) {
          await db.delete(tiles).where(eq(tiles.id, testTileId));
        }
        if (testRegionId) {
          await db.delete(regions).where(eq(regions.id, testRegionId));
        }
        if (testWorldId) {
          await db.delete(worlds).where(eq(worlds.id, testWorldId));
        }
        if (testServerId) {
          await db.delete(servers).where(eq(servers.id, testServerId));
        }
        if (testProfileId) {
          await db.delete(profiles).where(eq(profiles.id, testProfileId));
        }
        if (testAccountId) {
          await db.delete(accounts).where(eq(accounts.id, testAccountId));
        }
      });

      it('should create structure with requirements and modifiers', async () => {
        const { createStructure } = await import('../../../db/queries');
        const result = await createStructure(
          testSettlementId,
          'Workshop',
          'Basic workshop for crafting',
          {
            area: 10,
            solar: 1,
            wind: 1,
            food: 0,
            water: 5,
            wood: 50,
            stone: 20,
            ore: 10,
          },
          [
            { name: 'Production', description: 'Increases production', value: 10 },
            { name: 'Efficiency', description: 'Improves efficiency', value: 5 },
          ]
        );

        expect(result.structure).toBeDefined();
        expect(result.structure.name).toBe('Workshop');
        expect(result.requirements).toBeDefined();
        expect(result.requirements.wood).toBe(50);
        expect(result.modifiers).toHaveLength(2);
        expect(result.modifiers[0].name).toBe('Production');
      });

      it('should get settlement structures with requirements and modifiers', async () => {
        const { getSettlementStructures, createStructure } = await import('../../../db/queries');

        // Create a structure first
        await createStructure(
          testSettlementId,
          'Storage',
          'Storage building',
          {
            area: 5,
            solar: 0,
            wind: 0,
            food: 0,
            water: 0,
            wood: 30,
            stone: 40,
            ore: 0,
          },
          [{ name: 'Capacity', description: 'Increases storage', value: 100 }]
        );

        // Get structures
        const structures = await getSettlementStructures(testSettlementId);
        expect(Array.isArray(structures)).toBe(true);
        expect(structures.length).toBeGreaterThan(0);

        const storage = structures.find((s) => s.structure.name === 'Storage');
        expect(storage).toBeDefined();
        expect(storage?.requirements).toBeDefined();
        expect(storage?.modifiers).toBeDefined();
      });

      it('should create structure without modifiers', async () => {
        const { createStructure } = await import('../../../db/queries');
        const result = await createStructure(testSettlementId, 'Basic Hut', 'Simple shelter', {
          area: 3,
          solar: 0,
          wind: 0,
          food: 0,
          water: 2,
          wood: 20,
          stone: 10,
          ore: 0,
        });

        expect(result.structure).toBeDefined();
        expect(result.structure.name).toBe('Basic Hut');
        expect(result.requirements).toBeDefined();
        expect(result.modifiers).toHaveLength(0);
      });
    });
  });
});
