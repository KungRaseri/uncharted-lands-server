/**
 * Structure Validation Utilities
 * Validates resource requirements and deducts resources for structure construction
 */

import { eq } from 'drizzle-orm';
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
    throw new Error(`Unknown structure type: ${structureType}`);
  }

  // 2. Query settlement with storage
  const settlement = await tx.query.settlements.findFirst({
    where: eq(settlements.id, settlementId),
    with: {
      storage: true,
    },
  });

  if (!settlement) {
    throw new Error('Settlement not found');
  }

  if (!settlement.storage) {
    throw new Error('Settlement storage not found');
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
      deductedResources: { wood: 0, stone: 0, ore: 0 },
    };
  }

  // 4. Deduct resources (in the same transaction)
  // Use concrete numeric subtraction so tests that mock tx.update(table, data)
  // receive the updated values directly.
  const newWood = storage.wood - costs.wood;
  const newStone = storage.stone - costs.stone;
  const newOre = storage.ore - costs.ore;

  // Deduct resources from settlement storage using correct Drizzle ORM syntax
  await tx
    .update(settlementStorage)
    .set({
      wood: newWood,
      stone: newStone,
      ore: newOre,
    })
    .where(eq(settlementStorage.settlementId, settlementId));

  return {
    success: true,
    deductedResources: {
      wood: costs.wood,
      stone: costs.stone,
      ore: costs.ore,
    },
    shortages: [],
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
    throw new Error(`Unknown structure type: ${structureType}`);
  }

  // 2. Query settlement storage
  const settlement = await tx.query.settlements.findFirst({
    where: eq(settlements.id, settlementId),
    with: { storage: true },
  });

  if (!settlement) {
    throw new Error('Settlement not found');
  }

  if (!settlement.storage) {
    throw new Error('Settlement storage not found');
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
      deductedResources: { wood: 0, stone: 0, ore: 0 },
    };
  }

  return {
    success: true,
  };
}
