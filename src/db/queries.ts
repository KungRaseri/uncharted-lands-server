/**
 * Database Query Helpers
 *
 * Common database operations for the game server
 */

import { eq, and, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { logger } from '../utils/logger.js';
import {
  db,
  accounts,
  profiles,
  settlements,
  settlementStorage,
  settlementPopulation,
  settlementStructures,
  structureRequirements,
  structureModifiers,
  servers,
  worlds,
  regions,
  biomes,
  tiles,
  plots,
} from './index.js';

// ===========================
// UTILITY FUNCTIONS
// ===========================

/**
 * Generate CUID ID using the @paralleldrive/cuid2 library
 * This is a cryptographically secure ID generator
 * Re-exported for backward compatibility with existing code
 */
export const generateId = createId;

// ===========================
// AUTHENTICATION & PROFILES
// ===========================

/**
 * Find account by auth token
 */
export async function findAccountByToken(token: string) {
  try {
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userAuthToken, token))
      .limit(1);

    return account;
  } catch (error) {
    logger.error('[DB] Failed to find account by token', error);
    throw error;
  }
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
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);

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
      ...initialResources,
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
  return await db.select().from(servers).where(eq(servers.status, 'ONLINE'));
}

// ===========================
// BIOMES
// ===========================

/**
 * Get all biomes
 */
export async function getAllBiomes() {
  return await db.select().from(biomes);
}

/**
 * Find biome by precipitation and temperature ranges
 */
export async function findBiome(precipitation: number, temperature: number) {
  const allBiomes = await getAllBiomes();

  // Filter biomes that match both precipitation and temperature
  let filteredBiomes = allBiomes.filter(
    (biome) =>
      Math.round(precipitation) >= biome.precipitationMin &&
      Math.round(precipitation) <= biome.precipitationMax &&
      Math.round(temperature) >= biome.temperatureMin &&
      Math.round(temperature) <= biome.temperatureMax
  );

  // If no exact match, try matching precipitation only
  if (!filteredBiomes.length) {
    filteredBiomes = allBiomes.filter(
      (biome) =>
        Math.round(precipitation) >= biome.precipitationMin &&
        Math.round(precipitation) <= biome.precipitationMax
    );
  }

  // Fallback to first biome if still no match
  if (!filteredBiomes.length) {
    return allBiomes[0];
  }

  // Return random matching biome for variety
  return filteredBiomes[Math.floor(Math.random() * filteredBiomes.length)];
}

// ===========================
// POPULATION
// ===========================

/**
 * Get or create population data for a settlement
 */
export async function getSettlementPopulation(settlementId: string) {
  try {
    const [population] = await db
      .select()
      .from(settlementPopulation)
      .where(eq(settlementPopulation.settlementId, settlementId))
      .limit(1);

    // Create default population entry if none exists
    if (!population) {
      const newId = generateId();
      const [created] = await db
        .insert(settlementPopulation)
        .values({
          id: newId,
          settlementId,
          currentPopulation: 10,
          happiness: 50,
          lastGrowthTick: new Date(),
        })
        .returning();

      return created;
    }

    return population;
  } catch (error) {
    logger.error('[DB] Failed to get settlement population', error, { settlementId });
    throw error;
  }
}

/**
 * Update settlement population
 */
export async function updateSettlementPopulation(
  settlementId: string,
  updates: {
    currentPopulation?: number;
    happiness?: number;
    lastGrowthTick?: Date;
  }
) {
  try {
    const [updated] = await db
      .update(settlementPopulation)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(settlementPopulation.settlementId, settlementId))
      .returning();

    return updated;
  } catch (error) {
    logger.error('[DB] Failed to update settlement population', error, { settlementId, updates });
    throw error;
  }
}

// ===========================
// STRUCTURES
// ===========================

/**
 * Get settlement structures with their requirements and modifiers
 */
export async function getSettlementStructures(settlementId: string) {
  return await db
    .select({
      structure: settlementStructures,
      requirements: structureRequirements,
      modifiers: structureModifiers,
    })
    .from(settlementStructures)
    .leftJoin(
      structureRequirements,
      eq(settlementStructures.structureRequirementsId, structureRequirements.id)
    )
    .leftJoin(
      structureModifiers,
      eq(settlementStructures.id, structureModifiers.settlementStructureId)
    )
    .where(eq(settlementStructures.settlementId, settlementId));
}

/**
 * Create a new structure with requirements and modifiers
 */
export async function createStructure(
  settlementId: string,
  name: string,
  description: string,
  requirements: {
    area: number;
    solar: number;
    wind: number;
    food: number;
    water: number;
    wood: number;
    stone: number;
    ore: number;
  },
  modifiers?: Array<{
    name: string;
    description: string;
    value: number;
  }>
) {
  // Create requirements first
  const [reqRecord] = await db
    .insert(structureRequirements)
    .values({
      id: generateId(),
      ...requirements,
    })
    .returning();

  // Create structure
  const [structure] = await db
    .insert(settlementStructures)
    .values({
      id: generateId(),
      structureRequirementsId: reqRecord.id,
      settlementId,
      name,
      description,
    })
    .returning();

  // Create modifiers if provided
  if (modifiers && modifiers.length > 0) {
    const modifierRecords = await db
      .insert(structureModifiers)
      .values(
        modifiers.map((mod) => ({
          id: generateId(),
          settlementStructureId: structure.id,
          name: mod.name,
          description: mod.description,
          value: mod.value,
        }))
      )
      .returning();

    return { structure, requirements: reqRecord, modifiers: modifierRecords };
  }

  return { structure, requirements: reqRecord, modifiers: [] };
}
