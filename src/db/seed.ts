/**
 * Database Seeding Script for Drizzle ORM
 *
 * Seeds initial data for the game, including biomes.
 * Run with: npx tsx src/db/seed.ts
 */

import 'dotenv/config';
import { db, biomes } from './index.js';
import { createId } from '@paralleldrive/cuid2';
import { logger } from '../utils/logger.js';
import { eq } from 'drizzle-orm';

/**
 * Biome definitions with environmental parameters and modifiers
 */
const biomeData = [
  {
    id: createId(),
    name: 'TUNDRA',
    precipitationMin: 10,
    precipitationMax: 175,
    temperatureMin: -10,
    temperatureMax: 5,
    solarModifier: 2,
    windModifier: 2,
    foodModifier: 1,
    waterModifier: 1,
    woodModifier: 1,
    stoneModifier: 1,
    oreModifier: 1,
    plotsMin: 0,
    plotsMax: 6,
    plotAreaMin: 50,
    plotAreaMax: 70,
  },
  {
    id: createId(),
    name: 'FOREST_BOREAL',
    precipitationMin: 25,
    precipitationMax: 300,
    temperatureMin: -5,
    temperatureMax: 10,
    solarModifier: 2,
    windModifier: 1,
    foodModifier: 2,
    waterModifier: 2,
    woodModifier: 2,
    stoneModifier: 1,
    oreModifier: 1,
    plotsMin: 2,
    plotsMax: 8,
    plotAreaMin: 50,
    plotAreaMax: 85,
  },
  {
    id: createId(),
    name: 'FOREST_TEMPERATE_SEASONAL',
    precipitationMin: 50,
    precipitationMax: 350,
    temperatureMin: 4,
    temperatureMax: 22,
    solarModifier: 2,
    windModifier: 1,
    foodModifier: 2,
    waterModifier: 2,
    woodModifier: 2,
    stoneModifier: 2,
    oreModifier: 2,
    plotsMin: 3,
    plotsMax: 8,
    plotAreaMin: 55,
    plotAreaMax: 95,
  },
  {
    id: createId(),
    name: 'FOREST_TROPICAL_SEASONAL',
    precipitationMin: 50,
    precipitationMax: 350,
    temperatureMin: 20,
    temperatureMax: 32,
    solarModifier: 3,
    windModifier: 1,
    foodModifier: 3,
    waterModifier: 3,
    woodModifier: 3,
    stoneModifier: 2,
    oreModifier: 2,
    plotsMin: 3,
    plotsMax: 9,
    plotAreaMin: 55,
    plotAreaMax: 100,
  },
  {
    id: createId(),
    name: 'RAINFOREST_TEMPERATE',
    precipitationMin: 175,
    precipitationMax: 375,
    temperatureMin: 7,
    temperatureMax: 25,
    solarModifier: 2,
    windModifier: 1,
    foodModifier: 2,
    waterModifier: 3,
    woodModifier: 3,
    stoneModifier: 2,
    oreModifier: 2,
    plotsMin: 3,
    plotsMax: 9,
    plotAreaMin: 60,
    plotAreaMax: 95,
  },
  {
    id: createId(),
    name: 'RAINFOREST_TROPICAL',
    precipitationMin: 225,
    precipitationMax: 450,
    temperatureMin: 24,
    temperatureMax: 31,
    solarModifier: 3,
    windModifier: 1,
    foodModifier: 3,
    waterModifier: 3,
    woodModifier: 3,
    stoneModifier: 2,
    oreModifier: 2,
    plotsMin: 4,
    plotsMax: 10,
    plotAreaMin: 65,
    plotAreaMax: 100,
  },
  {
    id: createId(),
    name: 'WOODLAND',
    precipitationMin: 15,
    precipitationMax: 150,
    temperatureMin: -2,
    temperatureMax: 23,
    solarModifier: 2,
    windModifier: 1,
    foodModifier: 2,
    waterModifier: 1,
    woodModifier: 2,
    stoneModifier: 1,
    oreModifier: 1,
    plotsMin: 1,
    plotsMax: 7,
    plotAreaMin: 50,
    plotAreaMax: 75,
  },
  {
    id: createId(),
    name: 'SHRUBLAND',
    precipitationMin: 15,
    precipitationMax: 125,
    temperatureMin: -2,
    temperatureMax: 23,
    solarModifier: 2,
    windModifier: 1,
    foodModifier: 1,
    waterModifier: 1,
    woodModifier: 2,
    stoneModifier: 1,
    oreModifier: 1,
    plotsMin: 1,
    plotsMax: 7,
    plotAreaMin: 50,
    plotAreaMax: 70,
  },
  {
    id: createId(),
    name: 'SAVANNA',
    precipitationMin: 50,
    precipitationMax: 275,
    temperatureMin: 22,
    temperatureMax: 32,
    solarModifier: 3,
    windModifier: 2,
    foodModifier: 3,
    waterModifier: 2,
    woodModifier: 1,
    stoneModifier: 1,
    oreModifier: 1,
    plotsMin: 2,
    plotsMax: 8,
    plotAreaMin: 55,
    plotAreaMax: 95,
  },
  {
    id: createId(),
    name: 'GRASSLAND_TEMPERATE',
    precipitationMin: 5,
    precipitationMax: 50,
    temperatureMin: -4,
    temperatureMax: 22,
    solarModifier: 2,
    windModifier: 2,
    foodModifier: 2,
    waterModifier: 1,
    woodModifier: 1,
    stoneModifier: 1,
    oreModifier: 1,
    plotsMin: 1,
    plotsMax: 7,
    plotAreaMin: 50,
    plotAreaMax: 70,
  },
  {
    id: createId(),
    name: 'DESERT_COLD',
    precipitationMin: 1,
    precipitationMax: 50,
    temperatureMin: -4,
    temperatureMax: 22,
    solarModifier: 3,
    windModifier: 3,
    foodModifier: 1,
    waterModifier: 1,
    woodModifier: 1,
    stoneModifier: 2,
    oreModifier: 2,
    plotsMin: 0,
    plotsMax: 5,
    plotAreaMin: 50,
    plotAreaMax: 60,
  },
  {
    id: createId(),
    name: 'DESERT_SUBTROPICAL',
    precipitationMin: 1,
    precipitationMax: 100,
    temperatureMin: 18,
    temperatureMax: 32,
    solarModifier: 4,
    windModifier: 4,
    foodModifier: 1,
    waterModifier: 1,
    woodModifier: 1,
    stoneModifier: 3,
    oreModifier: 3,
    plotsMin: 0,
    plotsMax: 5,
    plotAreaMin: 50,
    plotAreaMax: 70,
  },
];

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
