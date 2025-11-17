/**
 * Structure Validation Utilities
 * Validates resource requirements and deducts resources for structure construction
 */

import { eq, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { getStructureCost } from './structure-costs.js';
import { settlementStorage, settlements } from '../db/schema.js';
import type * as schema from '../db/schema.js';

/**
 * Resource shortage information
 */
export interface ResourceShortage {
  type: 'wood' | 'stone' | 'ore' | 'food' | 'water';
  required: number;
  available: number;
  missing: number;
}

/**
 * Validation result
 */
export interface ValidationResult {
  success: boolean;
  error?: string;
  shortages?: ResourceShortage[];
  deductedResources?: {
    wood: number;
    stone: number;
    ore: number;
  };
}

/**
 * Validate that a settlement has sufficient resources to build a structure,
 * and deduct the resources if validation passes.
 *
 * This function MUST be called within a database transaction to ensure atomicity.
 *
 * @param tx - The database transaction
 * @param settlementId - The settlement attempting to build
 * @param structureType - The type of structure to build (e.g., 'FARM', 'HOUSE')
 * @returns Validation result with success status, error message, or shortage details
 */
export async function validateAndDeductResources(
  tx:
    | PostgresJsDatabase<typeof schema>
    | Parameters<Parameters<PostgresJsDatabase<typeof schema>['transaction']>[0]>[0],
  settlementId: string,
  structureType: string
): Promise<ValidationResult> {
  // 1. Get structure costs
  const costs = getStructureCost(structureType);
  if (!costs) {
    return {
      success: false,
      error: `Unknown structure type: ${structureType}`,
    };
  }

  // 2. Query settlement with storage
  const settlement = await tx.query.settlements.findFirst({
    where: eq(settlements.id, settlementId),
    with: {
      storage: true,
    },
  });

  if (!settlement?.storage) {
    return {
      success: false,
      error: 'Settlement or storage not found',
    };
  }

  const storage = settlement.storage;

  // 3. Validate sufficient resources
  const shortages: ResourceShortage[] = [];

  if (storage.wood < costs.wood) {
    shortages.push({
      type: 'wood',
      required: costs.wood,
      available: storage.wood,
      missing: costs.wood - storage.wood,
    });
  }

  if (storage.stone < costs.stone) {
    shortages.push({
      type: 'stone',
      required: costs.stone,
      available: storage.stone,
      missing: costs.stone - storage.stone,
    });
  }

  if (storage.ore < costs.ore) {
    shortages.push({
      type: 'ore',
      required: costs.ore,
      available: storage.ore,
      missing: costs.ore - storage.ore,
    });
  }

  if (shortages.length > 0) {
    return {
      success: false,
      error: 'Insufficient resources to build structure',
      shortages,
    };
  }

  // 4. Deduct resources (in the same transaction)
  await tx
    .update(settlementStorage)
    .set({
      wood: sql`${settlementStorage.wood} - ${costs.wood}`,
      stone: sql`${settlementStorage.stone} - ${costs.stone}`,
      ore: sql`${settlementStorage.ore} - ${costs.ore}`,
    })
    .where(eq(settlementStorage.id, storage.id));

  return {
    success: true,
    deductedResources: {
      wood: costs.wood,
      stone: costs.stone,
      ore: costs.ore,
    },
  };
}

/**
 * Check if a settlement has sufficient resources WITHOUT deducting them.
 * Useful for UI validation before attempting to build.
 *
 * @param tx - The database transaction or connection
 * @param settlementId - The settlement to check
 * @param structureType - The type of structure to check
 * @returns Validation result (success or shortages)
 */
export async function checkResourceAvailability(
  tx:
    | PostgresJsDatabase<typeof schema>
    | Parameters<Parameters<PostgresJsDatabase<typeof schema>['transaction']>[0]>[0],
  settlementId: string,
  structureType: string
): Promise<ValidationResult> {
  // 1. Get structure costs
  const costs = getStructureCost(structureType);
  if (!costs) {
    return {
      success: false,
      error: `Unknown structure type: ${structureType}`,
    };
  }

  // 2. Query settlement storage
  const settlement = await tx.query.settlements.findFirst({
    where: eq(settlements.id, settlementId),
    with: { storage: true },
  });

  if (!settlement?.storage) {
    return {
      success: false,
      error: 'Settlement or storage not found',
    };
  }

  const storage = settlement.storage;

  // 3. Check for shortages
  const shortages: ResourceShortage[] = [];

  if (storage.wood < costs.wood) {
    shortages.push({
      type: 'wood',
      required: costs.wood,
      available: storage.wood,
      missing: costs.wood - storage.wood,
    });
  }

  if (storage.stone < costs.stone) {
    shortages.push({
      type: 'stone',
      required: costs.stone,
      available: storage.stone,
      missing: costs.stone - storage.stone,
    });
  }

  if (storage.ore < costs.ore) {
    shortages.push({
      type: 'ore',
      required: costs.ore,
      available: storage.ore,
      missing: costs.ore - storage.ore,
    });
  }

  if (shortages.length > 0) {
    return {
      success: false,
      error: 'Insufficient resources to build structure',
      shortages,
    };
  }

  return {
    success: true,
  };
}
