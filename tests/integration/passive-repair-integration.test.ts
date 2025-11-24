/**
 * Passive Repair System - Integration Tests
 *
 * Tests the passive repair system integration with:
 * - Game loop hourly processing
 * - Database persistence
 * - Workshop prerequisite checking
 * - Multi-world processing
 *
 * GDD Reference: Section 3.4.6 (Passive Repair System)
 *
 * @module tests/integration/passive-repair-integration
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { db } from '../../src/db/index.js';
import { settlements, settlementStructures, worlds, servers, settlementStorage, accounts, profiles, regions, tiles, plots, biomes, structures } from '../../src/db/schema.js';
import { processPassiveRepairs } from '../../src/game/passive-repair.js';
import { eq } from 'drizzle-orm';

describe('Passive Repair System - Integration Tests', () => {
    let testServerId: string;
    let testWorldId: string;
    let testSettlementId: string;
    let testStorageId: string;
    let testAccountId: string;
    let testProfileId: string;
    let testBiomeId: string;
    let testRegionId: string;
    let testTileId: string;
    let testPlotId: string;
    let testWorkshopStructureId: string;
    let testFarmStructureId: string;
    let testMineStructureId: string;
    let testQuarryStructureId: string;

    beforeEach(async () => {
        // Get first biome (needed for tile creation)
        const firstBiome = await db.query.biomes.findFirst();
        if (!firstBiome) throw new Error('No biomes found in database');
        testBiomeId = firstBiome.id;

        // Get structure types (needed for settlementStructure creation)
        const workshopStructure = await db.query.structures.findFirst({
            where: eq(structures.name, 'Workshop'),
        });
        if (!workshopStructure) throw new Error('Workshop structure not found in database');
        testWorkshopStructureId = workshopStructure.id;

        const farmStructure = await db.query.structures.findFirst({
            where: eq(structures.name, 'Farm'),
        });
        if (!farmStructure) throw new Error('Farm structure not found in database');
        testFarmStructureId = farmStructure.id;

        const mineStructure = await db.query.structures.findFirst({
            where: eq(structures.name, 'Mine'),
        });
        if (!mineStructure) throw new Error('Mine structure not found in database');
        testMineStructureId = mineStructure.id;

        const quarryStructure = await db.query.structures.findFirst({
            where: eq(structures.name, 'Quarry'),
        });
        if (!quarryStructure) throw new Error('Quarry structure not found in database');
        testQuarryStructureId = quarryStructure.id;

        // Create test account
        const accountId = createId();
        const [account] = await db
            .insert(accounts)
            .values({
                id: accountId,
                email: `passive-repair-test-${accountId}@example.com`,
                passwordHash: 'hashed-password',
                userAuthToken: `token-passive-repair-${accountId}`,
                role: 'MEMBER',
            })
            .returning();
        testAccountId = account.id;

        // Create test profile
        const profileId = createId();
        const [profile] = await db
            .insert(profiles)
            .values({
                id: profileId,
                accountId: testAccountId,
                username: `PassiveRepairUser-${profileId}`,
                picture: 'https://example.com/avatar.jpg',
            })
            .returning();
        testProfileId = profile.id;

        // Create test server first (required FK for world)
        const serverId = createId();
        const [server] = await db
            .insert(servers)
            .values({
                id: serverId,
                name: `Test Server - Passive Repair - ${serverId}`,
                hostname: 'localhost',
                port: Math.floor(Math.random() * (6000 - 5000 + 1)) + 5000,
                status: 'ONLINE',
            })
            .returning();
        testServerId = server.id;

        // Create test world with unique name
        const worldId = createId();
        const [world] = await db
            .insert(worlds)
            .values({
                id: worldId,
                name: `Test World - Passive Repair Integration - ${worldId}`,
                serverId: testServerId,
                status: 'READY',
                worldTemplateType: 'STANDARD',
                elevationSettings: {},
                precipitationSettings: {},
                temperatureSettings: {},
            })
            .returning();
        testWorldId = world.id;

        // Create test region
        const regionId = createId();
        const [region] = await db
            .insert(regions)
            .values({
                id: regionId,
                worldId: testWorldId,
                xCoord: 0,
                yCoord: 0,
                name: `Passive Repair Region - ${regionId}`,
                elevationMap: {},
                precipitationMap: {},
                temperatureMap: {},
            })
            .returning();
        testRegionId = region.id;

        // Create test tile
        const tileId = createId();
        const [tile] = await db
            .insert(tiles)
            .values({
                id: tileId,
                regionId: testRegionId,
                biomeId: testBiomeId,
                xCoord: 0,
                yCoord: 0,
                elevation: 15,
                temperature: 20,
                precipitation: 200,
                type: 'LAND',
            })
            .returning();
        testTileId = tile.id;

        // Create test plot
        const plotId = createId();
        const [plot] = await db
            .insert(plots)
            .values({
                id: plotId,
                tileId: testTileId,
                position: 0,
                food: 50,
                water: 50,
                wood: 50,
                stone: 50,
                ore: 50,
            })
            .returning();
        testPlotId = plot.id;

        // Create settlement storage first (required FK for settlement)
        const storageId = createId();
        await db
            .insert(settlementStorage)
            .values({
                id: storageId,
                food: 1000,
                water: 1000,
                wood: 1000,
                stone: 1000,
                ore: 1000,
            });
        testStorageId = storageId;

        // Create test settlement
        const [settlement] = await db
            .insert(settlements)
            .values({
                id: createId(),
                playerProfileId: testProfileId,
                worldId: testWorldId,
                plotId: testPlotId,
                name: `Test Settlement - ${createId()}`,
                settlementStorageId: testStorageId,
                resilience: 0,
            })
            .returning();
        testSettlementId = settlement.id;
    });

    afterEach(async () => {
        // Clean up test data in reverse order (due to FK constraints)
        if (testSettlementId) {
            await db.delete(settlementStructures).where(eq(settlementStructures.settlementId, testSettlementId));
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

    describe('Workshop Prerequisite', () => {
        test('should NOT repair structures if settlement has no Workshop', async () => {
            // Create damaged structure (no Workshop)
            await db.insert(settlementStructures).values({
                id: createId(),
                settlementId: testSettlementId,
                structureId: testFarmStructureId,
                category: 'EXTRACTOR',
                type: 'FARM',
                level: 1,
                health: 50, // Damaged, eligible for repair
            });

            const result = await processPassiveRepairs(testWorldId);

            expect(result.settlementsProcessed).toBe(1);
            expect(result.settlementsWithWorkshop).toBe(0);
            expect(result.totalStructuresRepaired).toBe(0);

            // Verify health unchanged
            const structure = await db.query.settlementStructures.findFirst({
                where: eq(settlementStructures.settlementId, testSettlementId),
            });
            expect(structure?.health).toBe(50); // Still 50%
        });

        test('should repair structures if settlement has Workshop', async () => {
            // Create Workshop
            await db.insert(settlementStructures).values({
                id: createId(),
                settlementId: testSettlementId,
                structureId: testWorkshopStructureId,
                category: 'BUILDING',
                type: 'WORKSHOP',
                level: 1,
                health: 100,
            });

            // Create damaged structure
            const structureId = createId();
            await db.insert(settlementStructures).values({
                id: structureId,
                settlementId: testSettlementId,
                structureId: testFarmStructureId,
                category: 'EXTRACTOR',
                type: 'FARM',
                level: 1,
                health: 50,
            });

            const result = await processPassiveRepairs(testWorldId);

            expect(result.settlementsProcessed).toBe(1);
            expect(result.settlementsWithWorkshop).toBe(1);
            expect(result.totalStructuresRepaired).toBe(1);

            // Verify health increased by 1%
            const structure = await db.query.settlementStructures.findFirst({
                where: eq(settlementStructures.id, structureId),
            });
            expect(structure?.health).toBe(51); // 50% + 1% = 51%
            expect(structure?.lastRepairedAt).not.toBeNull();
        });
    });

    describe('Health Range Filtering', () => {
        test('should NOT repair structures below 21% health (critical)', async () => {
            // Create Workshop
            await db.insert(settlementStructures).values({
                id: createId(),
                settlementId: testSettlementId,
                structureId: testWorkshopStructureId,
                category: 'BUILDING',
                type: 'WORKSHOP',
                level: 1,
                health: 100,
            });

            // Create critical structure (15% health)
            await db.insert(settlementStructures).values({
                id: createId(),
                settlementId: testSettlementId,
                structureId: testFarmStructureId,
                category: 'EXTRACTOR',
                type: 'FARM',
                level: 1,
                health: 15, // Critical - should NOT repair
            });

            const result = await processPassiveRepairs(testWorldId);

            expect(result.totalStructuresRepaired).toBe(0);
        });

        test('should repair structures at 21% health (minimum threshold)', async () => {
            // Create Workshop
            await db.insert(settlementStructures).values({
                id: createId(),
                settlementId: testSettlementId,
                structureId: testWorkshopStructureId,
                category: 'BUILDING',
                type: 'WORKSHOP',
                level: 1,
                health: 100,
            });

            // Create structure at minimum threshold
            const structureId = createId();
            await db.insert(settlementStructures).values({
                id: structureId,
                settlementId: testSettlementId,
                structureId: testFarmStructureId,
                category: 'EXTRACTOR',
                type: 'FARM',
                level: 1,
                health: 21, // Minimum eligible - should repair
            });

            const result = await processPassiveRepairs(testWorldId);

            expect(result.totalStructuresRepaired).toBe(1);

            const structure = await db.query.settlementStructures.findFirst({
                where: eq(settlementStructures.id, structureId),
            });
            expect(structure?.health).toBe(22); // 21% + 1% = 22%
        });

        test('should NOT repair structures at 100% health (pristine)', async () => {
            // Create Workshop
            await db.insert(settlementStructures).values({
                id: createId(),
                settlementId: testSettlementId,
                structureId: testWorkshopStructureId,
                category: 'BUILDING',
                type: 'WORKSHOP',
                level: 1,
                health: 100,
            });

            // Create pristine structure
            await db.insert(settlementStructures).values({
                id: createId(),
                settlementId: testSettlementId,
                structureId: testFarmStructureId,
                category: 'EXTRACTOR',
                type: 'FARM',
                level: 1,
                health: 100, // Pristine - no need to repair
            });

            const result = await processPassiveRepairs(testWorldId);

            expect(result.totalStructuresRepaired).toBe(0);
        });

        test('should repair structures at 99% health (near-pristine)', async () => {
            // Create Workshop
            await db.insert(settlementStructures).values({
                id: createId(),
                settlementId: testSettlementId,
                structureId: testWorkshopStructureId,
                category: 'BUILDING',
                type: 'WORKSHOP',
                level: 1,
                health: 100,
            });

            // Create near-pristine structure
            const structureId = createId();
            await db.insert(settlementStructures).values({
                id: structureId,
                settlementId: testSettlementId,
                structureId: testFarmStructureId,
                category: 'EXTRACTOR',
                type: 'FARM',
                level: 1,
                health: 99,
            });

            const result = await processPassiveRepairs(testWorldId);

            expect(result.totalStructuresRepaired).toBe(1);

            const structure = await db.query.settlementStructures.findFirst({
                where: eq(settlementStructures.id, structureId),
            });
            expect(structure?.health).toBe(100); // 99% + 1% = 100% (capped)
        });
    });

    describe('Multi-Structure Repairs', () => {
        test('should repair multiple structures in same settlement', async () => {
            // Create Workshop
            await db.insert(settlementStructures).values({
                id: createId(),
                settlementId: testSettlementId,
                structureId: testWorkshopStructureId,
                category: 'BUILDING',
                type: 'WORKSHOP',
                level: 1,
                health: 100,
            });

            // Create 3 damaged structures
            const structure1Id = createId();
            const structure2Id = createId();
            const structure3Id = createId();

            await db.insert(settlementStructures).values([
                {
                    id: structure1Id,
                    settlementId: testSettlementId,
                    structureId: testFarmStructureId,
                    category: 'EXTRACTOR',
                    type: 'FARM',
                    level: 1,
                    health: 50,
                },
                {
                    id: structure2Id,
                    settlementId: testSettlementId,
                    structureId: testMineStructureId,
                    category: 'EXTRACTOR',
                    type: 'MINE',
                    level: 1,
                    health: 75,
                },
                {
                    id: structure3Id,
                    settlementId: testSettlementId,
                    structureId: testQuarryStructureId,
                    category: 'EXTRACTOR',
                    type: 'QUARRY',
                    level: 1,
                    health: 30,
                },
            ]);

            const result = await processPassiveRepairs(testWorldId);

            expect(result.totalStructuresRepaired).toBe(3);

            // Verify all structures repaired by 1%
            const structures = await db.query.settlementStructures.findMany({
                where: eq(settlementStructures.settlementId, testSettlementId),
            });

            const farm = structures.find((s) => s.id === structure1Id);
            const mine = structures.find((s) => s.id === structure2Id);
            const quarry = structures.find((s) => s.id === structure3Id);

            expect(farm?.health).toBe(51); // 50 + 1
            expect(mine?.health).toBe(76); // 75 + 1
            expect(quarry?.health).toBe(31); // 30 + 1
        });
    });

    describe('Database Persistence', () => {
        test('should update lastRepairedAt timestamp', async () => {
            // Create Workshop
            await db.insert(settlementStructures).values({
                id: createId(),
                settlementId: testSettlementId,
                structureId: testWorkshopStructureId,
                category: 'BUILDING',
                type: 'WORKSHOP',
                level: 1,
                health: 100,
            });

            // Create damaged structure
            const structureId = createId();
            const beforeTime = new Date();
            await db.insert(settlementStructures).values({
                id: structureId,
                settlementId: testSettlementId,
                structureId: testFarmStructureId,
                category: 'EXTRACTOR',
                type: 'FARM',
                level: 1,
                health: 50,
                lastRepairedAt: null,
            });

            await processPassiveRepairs(testWorldId);
            const afterTime = new Date();

            const structure = await db.query.settlementStructures.findFirst({
                where: eq(settlementStructures.id, structureId),
            });

            expect(structure?.lastRepairedAt).not.toBeNull();
            expect(structure?.lastRepairedAt!.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
            expect(structure?.lastRepairedAt!.getTime()).toBeLessThanOrEqual(afterTime.getTime());
        });

        test('should update updatedAt timestamp', async () => {
            // Create Workshop
            await db.insert(settlementStructures).values({
                id: createId(),
                settlementId: testSettlementId,
                structureId: testWorkshopStructureId,
                category: 'BUILDING',
                type: 'WORKSHOP',
                level: 1,
                health: 100,
            });

            // Create damaged structure
            const structureId = createId();
            const beforeTime = new Date();
            await db.insert(settlementStructures).values({
                id: structureId,
                settlementId: testSettlementId,
                structureId: testFarmStructureId,
                category: 'EXTRACTOR',
                type: 'FARM',
                level: 1,
                health: 50,
            });

            await processPassiveRepairs(testWorldId);
            const afterTime = new Date();

            const structure = await db.query.settlementStructures.findFirst({
                where: eq(settlementStructures.id, structureId),
            });

            expect(structure?.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
            expect(structure?.updatedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
        });
    });

    describe('GDD Compliance', () => {
        test('GDD Section 3.4.6: Repairs 1% health per hour', async () => {
            // Create Workshop
            await db.insert(settlementStructures).values({
                id: createId(),
                settlementId: testSettlementId,
                structureId: testWorkshopStructureId,
                category: 'BUILDING',
                type: 'WORKSHOP',
                level: 1,
                health: 100,
            });

            // Create damaged structure
            const structureId = createId();
            await db.insert(settlementStructures).values({
                id: structureId,
                settlementId: testSettlementId,
                structureId: testFarmStructureId,
                category: 'EXTRACTOR',
                type: 'FARM',
                level: 1,
                health: 50,
            });

            await processPassiveRepairs(testWorldId);

            const structure = await db.query.settlementStructures.findFirst({
                where: eq(settlementStructures.id, structureId),
            });

            expect(structure?.health).toBe(51); // Exactly 1% increase per hour
        });

        test('GDD Section 3.4.6: Requires Workshop structure', async () => {
            // No Workshop - should not repair
            await db.insert(settlementStructures).values({
                id: createId(),
                settlementId: testSettlementId,
                structureId: testFarmStructureId,
                category: 'EXTRACTOR',
                type: 'FARM',
                level: 1,
                health: 50,
            });

            const result = await processPassiveRepairs(testWorldId);

            expect(result.settlementsWithWorkshop).toBe(0);
            expect(result.totalStructuresRepaired).toBe(0);
        });

        test('GDD Section 3.4.6: Only repairs structures 21-99% health', async () => {
            // Create Workshop
            await db.insert(settlementStructures).values({
                id: createId(),
                settlementId: testSettlementId,
                structureId: testWorkshopStructureId,
                category: 'BUILDING',
                type: 'WORKSHOP',
                level: 1,
                health: 100,
            });

            // Create structures at various health levels
            await db.insert(settlementStructures).values([
                // Critical (should not repair)
                {
                    id: createId(),
                    settlementId: testSettlementId,
                    structureId: testFarmStructureId,
                    category: 'EXTRACTOR',
                    type: 'FARM',
                    level: 1,
                    health: 15,
                },
                // At threshold (should repair)
                {
                    id: createId(),
                    settlementId: testSettlementId,
                    structureId: testFarmStructureId,
                    category: 'EXTRACTOR',
                    type: 'FARM',
                    level: 1,
                    health: 21,
                },
                // Mid-range (should repair)
                {
                    id: createId(),
                    settlementId: testSettlementId,
                    structureId: testFarmStructureId,
                    category: 'EXTRACTOR',
                    type: 'FARM',
                    level: 1,
                    health: 50,
                },
                // Near-pristine (should repair)
                {
                    id: createId(),
                    settlementId: testSettlementId,
                    structureId: testFarmStructureId,
                    category: 'EXTRACTOR',
                    type: 'FARM',
                    level: 1,
                    health: 99,
                },
                // Pristine (should not repair)
                {
                    id: createId(),
                    settlementId: testSettlementId,
                    structureId: testFarmStructureId,
                    category: 'EXTRACTOR',
                    type: 'FARM',
                    level: 1,
                    health: 100,
                },
            ]);

            const result = await processPassiveRepairs(testWorldId);

            // Should repair exactly 3 structures (21%, 50%, 99%)
            expect(result.totalStructuresRepaired).toBe(3);
        });
    });
});
