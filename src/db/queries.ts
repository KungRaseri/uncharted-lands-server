/**
 * Database Query Helpers
 * 
 * Common database operations for the game server
 */

import { eq, and, desc } from 'drizzle-orm';
import { db, accounts, profiles, settlements, settlementStorage, servers, worlds, regions, tiles, plots } from './index';

// ===========================
// AUTHENTICATION & PROFILES
// ===========================

/**
 * Find account by auth token
 */
export async function findAccountByToken(token: string) {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userAuthToken, token))
    .limit(1);
  
  return account;
}

/**
 * Find profile by account ID with account data
 */
export async function findProfileByAccountId(accountId: string) {
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.accountId, accountId))
    .limit(1);
  
  return profile;
}

/**
 * Find profile by ID
 */
export async function findProfileById(profileId: string) {
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  
  return profile;
}

// ===========================
// SETTLEMENTS
// ===========================

/**
 * Get all settlements for a player profile
 */
export async function getPlayerSettlements(profileId: string) {
  return await db
    .select()
    .from(settlements)
    .where(eq(settlements.playerProfileId, profileId))
    .orderBy(desc(settlements.createdAt));
}

/**
 * Get settlement with storage and plot details
 */
export async function getSettlementWithDetails(settlementId: string) {
  const [settlement] = await db
    .select({
      settlement: settlements,
      storage: settlementStorage,
      plot: plots,
    })
    .from(settlements)
    .leftJoin(settlementStorage, eq(settlements.settlementStorageId, settlementStorage.id))
    .leftJoin(plots, eq(settlements.plotId, plots.id))
    .where(eq(settlements.id, settlementId))
    .limit(1);
  
  return settlement;
}

/**
 * Create a new settlement with storage
 */
export async function createSettlement(
  profileId: string,
  plotId: string,
  name: string,
  initialResources: { food: number; water: number; wood: number; stone: number; ore: number }
) {
  // Create storage first
  const [storage] = await db
    .insert(settlementStorage)
    .values({
      id: generateId(),
      ...initialResources
    })
    .returning();

  // Create settlement
  const [settlement] = await db
    .insert(settlements)
    .values({
      id: generateId(),
      playerProfileId: profileId,
      plotId,
      settlementStorageId: storage.id,
      name,
    })
    .returning();

  return { settlement, storage };
}

/**
 * Update settlement storage
 */
export async function updateSettlementStorage(
  storageId: string,
  resources: Partial<{ food: number; water: number; wood: number; stone: number; ore: number }>
) {
  const [updated] = await db
    .update(settlementStorage)
    .set(resources)
    .where(eq(settlementStorage.id, storageId))
    .returning();
  
  return updated;
}

// ===========================
// WORLDS & REGIONS
// ===========================

/**
 * Find world by name and server ID
 */
export async function findWorldByName(worldName: string, serverId: string) {
  const [world] = await db
    .select()
    .from(worlds)
    .where(and(eq(worlds.name, worldName), eq(worlds.serverId, serverId)))
    .limit(1);
  
  return world;
}

/**
 * Get region with tiles
 */
export async function getRegionWithTiles(regionId: string) {
  return await db
    .select({
      region: regions,
      tile: tiles,
    })
    .from(regions)
    .leftJoin(tiles, eq(regions.id, tiles.regionId))
    .where(eq(regions.id, regionId));
}

/**
 * Get regions by world ID
 */
export async function getWorldRegions(worldId: string) {
  return await db
    .select()
    .from(regions)
    .where(eq(regions.worldId, worldId))
    .orderBy(regions.xCoord, regions.yCoord);
}

// ===========================
// SERVERS
// ===========================

/**
 * Find server by hostname and port
 */
export async function findServerByAddress(hostname: string, port: number) {
  const [server] = await db
    .select()
    .from(servers)
    .where(and(eq(servers.hostname, hostname), eq(servers.port, port)))
    .limit(1);
  
  return server;
}

/**
 * Get all online servers
 */
export async function getOnlineServers() {
  return await db
    .select()
    .from(servers)
    .where(eq(servers.status, 'ONLINE'));
}

// ===========================
// UTILITY FUNCTIONS
// ===========================

/**
 * Generate CUID-like ID (simple version)
 * In production, use a proper CUID library
 */
export function generateId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
}
