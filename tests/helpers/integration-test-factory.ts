/**
 * Integration Test Factory
 * 
 * Purpose: Create complete database entity chains for integration tests.
 * Eliminates code duplication and ensures correct foreign key relationships.
 * 
 * Pattern: Test Data Builders / Object Mother Pattern
 * 
 * Usage:
 * ```typescript
 * // Create full settlement chain
 * const chain = await createTestSettlement({ settlementName: 'Test Village' });
 * 
 * // Use in tests
 * expect(chain.settlement.name).toBe('Test Village');
 * 
 * // Cleanup after test
 * await cleanupTestChain(chain);
 * ```
 * 
 * @module tests/helpers/integration-test-factory
 */

import { eq } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import {
  accounts,
  profiles,
  servers,
  worlds,
  regions,
  biomes,
  tiles,
  plots,
  settlementStorage,
  settlements,
  settlementStructures,
  structures,
} from '../../src/db/schema.js';
import { createId } from '@paralleldrive/cuid2';

/**
 * Test entity chain containing all created entities and their IDs
 */
export interface TestEntityChain {
  // IDs
  accountId: string;
  profileId: string;
  serverId: string;
  worldId: string;
  regionId: string;
  biomeId: string;
  tileId: string;
  plotId: string;
  settlementStorageId: string;
  settlementId?: string;
  structureId?: string;
  
  // Full objects (for assertions)
  account: any;
  profile: any;
  server: any;
  world: any;
  region: any;
  biome: any;
  tile: any;
  plot: any;
  storage: any;
  settlement?: any;
  structure?: any;
}

/**
 * Options for customizing test entity creation
 */
export interface TestEntityOptions {
  // Account options
  accountEmail?: string;
  accountRole?: 'MEMBER' | 'SUPPORT' | 'ADMINISTRATOR';
  
  // Server options
  serverName?: string;
  
  // World options
  worldName?: string;
  worldTemplateType?: string;
  
  // Region options
  regionX?: number;
  regionY?: number;
  
  // Biome options
  biomeName?: string;
  
  // Tile options
  tileX?: number;
  tileY?: number;
  tileElevation?: number;
  tileTemperature?: number;
  tilePrecipitation?: number;
  
  // Plot options
  plotPosition?: number;
  
  // Settlement options
  settlementName?: string;
  
  // Storage options
  initialFood?: number;
  initialWater?: number;
  initialWood?: number;
  initialStone?: number;
  initialOre?: number;
  
  // Structure options
  structureType?: string;
  structureCategory?: string;
  structureHealth?: number;
}

/**
 * Create a test biome
 */
export async function createTestBiome(options: TestEntityOptions = {}) {
  const biomeId = createId();
  const [biome] = await db.insert(biomes).values({
    id: biomeId,
    name: options.biomeName || `Test Grassland ${biomeId}`, // Add unique ID to prevent collisions
    precipitationMin: 100,
    precipitationMax: 300,
    temperatureMin: 10,
    temperatureMax: 30,
    plotsMin: 5,
    plotsMax: 15,
    plotAreaMin: 100,
    plotAreaMax: 500,
    solarModifier: 1,
    windModifier: 1,
    foodModifier: 1,
    waterModifier: 1,
    woodModifier: 1,
    stoneModifier: 1,
    oreModifier: 1,
  }).returning();
  
  return { biomeId, biome };
}

/**
 * Create a test account
 */
export async function createTestAccount(options: TestEntityOptions = {}) {
  const accountId = createId();
  const [account] = await db.insert(accounts).values({
    id: accountId,
    email: options.accountEmail || `test-${accountId}@example.com`,
    passwordHash: 'hashed-password',
    userAuthToken: `token-${accountId}`,
    role: options.accountRole || 'MEMBER',
  }).returning();
  
  return { accountId, account };
}

/**
 * Create a test server
 */
export async function createTestServer(options: TestEntityOptions = {}) {
  const serverId = createId();
  const [server] = await db.insert(servers).values({
    id: serverId,
    name: options.serverName || `Test Server - ${serverId}`,
    hostname: 'localhost',
    port: Math.floor(Math.random() * (6000 - 5000 + 1)) + 5000,
    status: 'ONLINE',
  }).returning();
  
  return { serverId, server };
}

/**
 * Create a test world (requires serverId)
 */
export async function createTestWorld(serverId: string, options: TestEntityOptions = {}) {
  const worldId = createId();
  const [world] = await db.insert(worlds).values({
    id: worldId,
    name: options.worldName || `Test World - ${worldId}`,
    serverId,
    status: 'READY',
    worldTemplateType: options.worldTemplateType || 'STANDARD',
    elevationSettings: {},
    precipitationSettings: {},
    temperatureSettings: {},
  }).returning();
  
  return { worldId, world };
}

/**
 * Create a test region (requires worldId)
 */
export async function createTestRegion(worldId: string, options: TestEntityOptions = {}) {
  const regionId = createId();
  const [region] = await db.insert(regions).values({
    id: regionId,
    worldId,
    xCoord: options.regionX || 0,
    yCoord: options.regionY || 0,
    name: `Test Region - ${regionId}`,
    elevationMap: {},
    precipitationMap: {},
    temperatureMap: {},
  }).returning();
  
  return { regionId, region };
}

/**
 * Create a test tile (requires regionId and biomeId)
 */
export async function createTestTile(regionId: string, biomeId: string, options: TestEntityOptions = {}) {
  const tileId = createId();
  const [tile] = await db.insert(tiles).values({
    id: tileId,
    regionId,
    biomeId,
    xCoord: options.tileX || 0,
    yCoord: options.tileY || 0,
    elevation: options.tileElevation || 15,
    temperature: options.tileTemperature || 20,
    precipitation: options.tilePrecipitation || 200,
    type: 'LAND',
  }).returning();
  
  return { tileId, tile };
}

/**
 * Create a test plot (requires tileId)
 */
export async function createTestPlot(tileId: string, options: TestEntityOptions = {}) {
  const plotId = createId();
  const [plot] = await db.insert(plots).values({
    id: plotId,
    tileId,
    position: options.plotPosition || 0,
    food: 50,
    water: 50,
    wood: 50,
    stone: 50,
    ore: 50,
  }).returning();
  
  return { plotId, plot };
}

/**
 * Create a test profile (requires accountId)
 */
export async function createTestProfile(accountId: string, options: TestEntityOptions = {}) {
  const profileId = createId();
  const [profile] = await db.insert(profiles).values({
    id: profileId,
    accountId,
    username: `TestUser-${profileId}`,
    picture: 'https://example.com/avatar.jpg',
  }).returning();
  
  return { profileId, profile };
}

/**
 * Create test settlement storage
 */
export async function createTestStorage(options: TestEntityOptions = {}) {
  const settlementStorageId = createId();
  const [storage] = await db.insert(settlementStorage).values({
    id: settlementStorageId,
    food: options.initialFood || 1000,
    water: options.initialWater || 1000,
    wood: options.initialWood || 1000,
    stone: options.initialStone || 1000,
    ore: options.initialOre || 1000,
  }).returning();
  
  return { settlementStorageId, storage };
}

/**
 * Create a test settlement entity (requires plotId, profileId, worldId, storageId)
 */
export async function createTestSettlementEntity(
  plotId: string,
  profileId: string,
  worldId: string,
  storageId: string,
  options: TestEntityOptions = {}
) {
  const settlementId = createId();
  const [settlement] = await db.insert(settlements).values({
    id: settlementId,
    playerProfileId: profileId,
    worldId,
    plotId,
    settlementStorageId: storageId,
    name: options.settlementName || `Test Settlement - ${settlementId}`,
  }).returning();
  
  return { settlementId, settlement };
}

/**
 * Create a test structure (requires settlementId and plotId)
 */
export async function createTestStructure(
  settlementId: string,
  plotId: string,
  options: TestEntityOptions = {}
) {
  // Map structure type to database structure name
  // Database uses title case names like "Farm", "Mine", "Workshop"
  const structureTypeName = options.structureType || 'FARM';
  const structureName = structureTypeName.charAt(0).toUpperCase() + 
                        structureTypeName.slice(1).toLowerCase();
  
  // Get the master structure definition from the database
  const masterStructure = await db.query.structures.findFirst({
    where: eq(structures.name, structureName),
  });
  
  if (!masterStructure) {
    throw new Error(`Master structure definition not found: ${structureName} (from ${structureTypeName})`);
  }
  
  const structureInstanceId = createId();
  const [structure] = await db.insert(settlementStructures).values({
    id: structureInstanceId,
    structureId: masterStructure.id, // Foreign key to master structure
    settlementId,
    plotId,
    level: 1,
    health: options.structureHealth ?? 100,
  }).returning();
  
  return { structureId: structureInstanceId, structure };
}

/**
 * HIGH-LEVEL: Create full dependency chain up to plot
 */
export async function createTestPlotChain(options: TestEntityOptions = {}): Promise<TestEntityChain> {
  const { biomeId, biome } = await createTestBiome(options);
  const { accountId, account } = await createTestAccount(options);
  const { serverId, server } = await createTestServer(options);
  const { worldId, world } = await createTestWorld(serverId, options);
  const { regionId, region } = await createTestRegion(worldId, options);
  const { tileId, tile } = await createTestTile(regionId, biomeId, options);
  const { plotId, plot } = await createTestPlot(tileId, options);
  const { profileId, profile } = await createTestProfile(accountId, options);
  const { settlementStorageId, storage } = await createTestStorage(options);
  
  return {
    accountId,
    profileId,
    serverId,
    worldId,
    regionId,
    biomeId,
    tileId,
    plotId,
    settlementStorageId,
    account,
    profile,
    server,
    world,
    region,
    biome,
    tile,
    plot,
    storage,
  };
}

/**
 * HIGH-LEVEL: Create full dependency chain up to settlement
 */
export async function createTestSettlement(options: TestEntityOptions = {}): Promise<TestEntityChain> {
  const chain = await createTestPlotChain(options);
  
  const { settlementId, settlement } = await createTestSettlementEntity(
    chain.plotId,
    chain.profileId,
    chain.worldId,
    chain.settlementStorageId,
    options
  );
  
  return {
    ...chain,
    settlementId,
    settlement,
  };
}

/**
 * HIGH-LEVEL: Create full dependency chain including structure
 */
export async function createTestSettlementWithStructure(options: TestEntityOptions = {}): Promise<TestEntityChain> {
  const chain = await createTestSettlement(options);
  
  if (!chain.settlementId) {
    throw new Error('Settlement ID is required to create structure');
  }
  
  const { structureId, structure } = await createTestStructure(
    chain.settlementId,
    chain.plotId,
    options
  );
  
  return {
    ...chain,
    structureId,
    structure,
  };
}

/**
 * Cleanup helper: Delete all entities in reverse dependency order
 */
export async function cleanupTestChain(chain: TestEntityChain | undefined) {
  // Guard against undefined chain (setup may have failed)
  if (!chain) {
    return;
  }
  
  // Delete in reverse dependency order
  
  if (chain.structureId) {
    await db.delete(settlementStructures).where(eq(settlementStructures.id, chain.structureId));
  }
  
  if (chain.settlementId) {
    await db.delete(settlements).where(eq(settlements.id, chain.settlementId));
  }
  
  if (chain.settlementStorageId) {
    await db.delete(settlementStorage).where(eq(settlementStorage.id, chain.settlementStorageId));
  }
  
  await db.delete(plots).where(eq(plots.id, chain.plotId));
  await db.delete(tiles).where(eq(tiles.id, chain.tileId));
  await db.delete(regions).where(eq(regions.id, chain.regionId));
  await db.delete(biomes).where(eq(biomes.id, chain.biomeId));
  await db.delete(worlds).where(eq(worlds.id, chain.worldId));
  await db.delete(servers).where(eq(servers.id, chain.serverId));
  await db.delete(profiles).where(eq(profiles.id, chain.profileId));
  await db.delete(accounts).where(eq(accounts.id, chain.accountId));
}
