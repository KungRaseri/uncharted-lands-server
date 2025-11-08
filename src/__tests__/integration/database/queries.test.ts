import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../../db/index.js';
import { biomes, servers, worlds } from '../../../db/schema.js';
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
      const result = await db.insert(servers).values({
        id: createId(),
        name: `Test Server ${Date.now()}`,
        hostname: 'localhost',
        port: 5000,
        status: 'ONLINE',
      }).returning();
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
      await db.update(servers)
        .set({ status: 'MAINTENANCE' })
        .where(eq(servers.id, testServerId));

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
      const serverResult = await db.insert(servers).values({
        id: createId(),
        name: `Test Server for World ${Date.now()}`,
        hostname: 'localhost',
        port: 5001,
        status: 'ONLINE',
      }).returning();
      testServerId = serverResult[0].id;

      // Create test world
      const worldResult = await db.insert(worlds).values({
        id: createId(),
        name: `Test World ${Date.now()}`,
        serverId: testServerId,
        elevationSettings: { scale: 0.02, octaves: 4 },
        precipitationSettings: { scale: 0.015, octaves: 3 },
        temperatureSettings: { scale: 0.01, octaves: 2 },
      }).returning();
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
      const result = await db.select()
        .from(worlds)
        .where(eq(worlds.serverId, testServerId));

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].serverId).toBe(testServerId);
    });

    it('should update world name', async () => {
      const newName = `Updated World ${Date.now()}`;
      
      await db.update(worlds)
        .set({ name: newName })
        .where(eq(worlds.id, testWorldId));

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
      const result = await db.select()
        .from(servers)
        .where(eq(servers.name, testName));

      expect(result.length).toBe(0);
    });
  });

  describe('Query Builder', () => {
    it('should support WHERE clauses', async () => {
      const result = await db.select()
        .from(servers)
        .where(eq(servers.status, 'ONLINE'));

      expect(Array.isArray(result)).toBe(true);
    });

    it('should support LIMIT', async () => {
      const result = await db.select()
        .from(servers)
        .limit(5);

      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should support ORDER BY', async () => {
      const result = await db.select()
        .from(servers)
        .orderBy(servers.createdAt)
        .limit(10);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should support COUNT queries', async () => {
      const result = await db.select()
        .from(servers);

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

      servers_without_worlds.forEach(server => {
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
});
