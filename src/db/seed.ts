/**
 * Database Seeding Script for Drizzle ORM
 *
 * Seeds initial data for the game, including biomes.
 * Run with: npx tsx src/db/seed.ts
 */

import 'dotenv/config';
import { db, biomes, structures, resources, structureRequirements } from './index.js';
import { createId } from '@paralleldrive/cuid2';
import { logger } from '../utils/logger.js';
import { eq, and } from 'drizzle-orm';
import { RESOURCES } from '../data/resources.js';
import { BIOMES } from '../data/biomes.js';
import { STRUCTURES } from '../data/structures.js';

/**
 * Biome definitions with environmental parameters and modifiers
 * Generated from master data file: src/data/biomes.ts
 */
const biomeData = BIOMES.map((biome) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, ...biomeWithoutId } = biome;
  return {
    id: createId(),
    ...biomeWithoutId,
  };
});

/**
 * Resource Master Data
 * Generated from master data file: src/data/resources.ts
 */
const resourcesData = RESOURCES.map((resource) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, ...resourceWithoutId } = resource;
  return {
    id: createId(),
    ...resourceWithoutId,
  };
});

/**
 * Structure Master Data
 * Generated from master data file: src/data/structures.ts
 */
const structuresData = STRUCTURES.map((structure) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, requirements: _requirements, ...structureWithoutId } = structure;
  return {
    id: createId(),
    ...structureWithoutId,
  };
});

/**
 * Structure Requirements Data
 * Maps structures to their resource costs (using names for lookup)
 * Based on client/src/lib/game/structures.ts
 */
const structureRequirementsData = STRUCTURES.flatMap((structure) =>
  Object.entries(structure.requirements)
    .filter(([_, quantity]) => quantity && quantity > 0)
    .map(([resourceKey, quantity]) => {
      const resource = RESOURCES.find((r) => r.id === resourceKey);
      if (!resource) {
        throw new Error(
          `Resource with id "${resourceKey}" not found for structure "${structure.name}"`
        );
      }
      return {
        structureName: structure.name,
        resourceName: resource.name,
        quantity: quantity,
      };
    })
);

/**
 * Seed resources with upsert logic (create or update)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _seedResources() {
  logger.info(`[SEED] Starting resource seeding...`);

  let created = 0;
  let updated = 0;

  for (const resource of resourcesData) {
    try {
      // Check if resource exists
      const existing = await db.query.resources.findFirst({
        where: eq(resources.name, resource.name),
      });

      if (existing) {
        // Update existing resource (exclude id from update)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _id, ...resourceDataWithoutId } = resource;
        await db
          .update(resources)
          .set(resourceDataWithoutId)
          .where(eq(resources.name, resource.name));
        updated++;
        logger.info(`[SEED] Updated resource: ${resource.name}`);
      } else {
        // Insert new resource
        await db.insert(resources).values(resource);
        created++;
        logger.info(`[SEED] Created resource: ${resource.name}`);
      }
    } catch (error) {
      logger.error(`[SEED] Error seeding resource ${resource.name}:`, error);
      throw error;
    }
  }

  return { created, updated, total: resourcesData.length };
}

/**
 * Seed structures with upsert logic (create or update)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _seedStructures() {
  logger.info(`[SEED] Starting structure seeding...`);

  let created = 0;
  let updated = 0;

  for (const structure of structuresData) {
    try {
      // Check if structure exists
      const existing = await db.query.structures.findFirst({
        where: eq(structures.name, structure.name),
      });

      if (existing) {
        // Update existing structure (exclude id from update)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _id, ...structureDataWithoutId } = structure;
        await db
          .update(structures)
          .set(structureDataWithoutId)
          .where(eq(structures.name, structure.name));
        updated++;
        logger.info(`[SEED] Updated structure: ${structure.name}`);
      } else {
        // Insert new structure
        await db.insert(structures).values(structure);
        created++;
        logger.info(`[SEED] Created structure: ${structure.name}`);
      }
    } catch (error) {
      logger.error(`[SEED] Error seeding structure ${structure.name}:`, error);
      throw error;
    }
  }

  return { created, updated, total: structuresData.length };
}

/**
 * Seed structure requirements with upsert logic (create or update)
 * Links structures to their resource costs using composite key lookup
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _seedStructureRequirements() {
  logger.info(`[SEED] Starting structure requirements seeding...`);

  let created = 0;
  let updated = 0;

  for (const req of structureRequirementsData) {
    try {
      // Look up structure and resource IDs by name
      const structure = await db.query.structures.findFirst({
        where: eq(structures.name, req.structureName),
      });

      const resource = await db.query.resources.findFirst({
        where: eq(resources.name, req.resourceName),
      });

      if (!structure) {
        logger.warn(`[SEED] Structure not found: ${req.structureName}`);
        continue;
      }

      if (!resource) {
        logger.warn(`[SEED] Resource not found: ${req.resourceName}`);
        continue;
      }

      // Check if requirement exists (composite key: structureId + resourceId)
      const existing = await db.query.structureRequirements.findFirst({
        where: and(
          eq(structureRequirements.structureId, structure.id),
          eq(structureRequirements.resourceId, resource.id)
        ),
      });

      if (existing) {
        // Update existing requirement
        await db
          .update(structureRequirements)
          .set({ quantity: req.quantity })
          .where(
            and(
              eq(structureRequirements.structureId, structure.id),
              eq(structureRequirements.resourceId, resource.id)
            )
          );
        updated++;
      } else {
        // Insert new requirement
        await db.insert(structureRequirements).values({
          id: createId(),
          structureId: structure.id,
          resourceId: resource.id,
          quantity: req.quantity,
        });
        created++;
      }
    } catch (error) {
      logger.error(
        `[SEED] Error seeding requirement ${req.structureName} -> ${req.resourceName}:`,
        error
      );
      throw error;
    }
  }

  return { created, updated, total: structureRequirementsData.length };
}

/**
 * Seed biomes with upsert logic (create or update)
 */
async function seedBiomes() {
  logger.info(`[SEED] Starting biome seeding...`);

  let created = 0;
  let updated = 0;

  for (const biome of biomeData) {
    try {
      // Check if biome exists
      const existing = await db.query.biomes.findFirst({
        where: eq(biomes.name, biome.name),
      });

      if (existing) {
        // Update existing biome (preserve existing ID)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _id, ...biomeDataWithoutId } = biome;
        await db.update(biomes).set(biomeDataWithoutId).where(eq(biomes.name, biome.name));

        logger.info(`[SEED] Updated biome: ${biome.name} [ID: ${existing.id}]`);
        updated++;
      } else {
        // Insert new biome
        await db.insert(biomes).values(biome);

        logger.info(`[SEED] Created biome: ${biome.name} [ID: ${biome.id}]`);
        created++;
      }
    } catch (error) {
      logger.error(`[SEED] Failed to seed biome ${biome.name}:`, error);
      throw error;
    }
  }

  logger.info(`[SEED] Biome seeding complete: ${created} created, ${updated} updated`);

  return { created, updated, total: biomeData.length };
}

/**
 * Main seeding execution
 */
logger.info('[SEED] Starting database seeding...');

try {
  // Seed biomes
  const biomeResult = await seedBiomes();

  logger.info('[SEED] ✅ Seeding completed successfully!', {
    biomes: {
      created: biomeResult.created,
      updated: biomeResult.updated,
      total: biomeResult.total,
    },
  });
} catch (error) {
  logger.error('[SEED] ❌ Seeding failed', error);
  process.exit(1);
} finally {
  // Close database connection
  await db.$client.end();
  process.exit(0);
}
