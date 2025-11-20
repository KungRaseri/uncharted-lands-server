/**
 * Structure Validation Utilities
 * Validates resource requirements and deducts resources for structure construction
 */

import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { getStructureCost } from '../data/structure-costs.js';
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
  const costDef = getStructureCost(structureType);
  if (!costDef) {
    throw new Error(`Unknown structure type: ${structureType}`);
  }

  const costs = costDef.costs;

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

  // Only check costs that are defined (handle optional properties)
  const woodCost = costs.wood ?? 0;
  const stoneCost = costs.stone ?? 0;
  const oreCost = costs.ore ?? 0;

  if (storage.wood < woodCost) {
    shortages.push({
      type: 'wood',
      required: woodCost,
      available: storage.wood,
      missing: woodCost - storage.wood,
    });
  }

  if (storage.stone < stoneCost) {
    shortages.push({
      type: 'stone',
      required: stoneCost,
      available: storage.stone,
      missing: stoneCost - storage.stone,
    });
  }

  if (storage.ore < oreCost) {
    shortages.push({
      type: 'ore',
      required: oreCost,
      available: storage.ore,
      missing: oreCost - storage.ore,
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
  const newWood = storage.wood - woodCost;
  const newStone = storage.stone - stoneCost;
  const newOre = storage.ore - oreCost;

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
      wood: woodCost,
      stone: stoneCost,
      ore: oreCost,
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
  const costDef = getStructureCost(structureType);
  if (!costDef) {
    throw new Error(`Unknown structure type: ${structureType}`);
  }

  const costs = costDef.costs;

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

  // Only check costs that are defined (handle optional properties)
  const woodCost = costs.wood ?? 0;
  const stoneCost = costs.stone ?? 0;
  const oreCost = costs.ore ?? 0;

  if (storage.wood < woodCost) {
    shortages.push({
      type: 'wood',
      required: woodCost,
      available: storage.wood,
      missing: woodCost - storage.wood,
    });
  }

  if (storage.stone < stoneCost) {
    shortages.push({
      type: 'stone',
      required: stoneCost,
      available: storage.stone,
      missing: stoneCost - storage.stone,
    });
  }

  if (storage.ore < oreCost) {
    shortages.push({
      type: 'ore',
      required: oreCost,
      available: storage.ore,
      missing: oreCost - storage.ore,
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
