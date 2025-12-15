/**
 * Run Population Capacity Modifiers Migration
 * Fixes critical bug where modifier names were wrong
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { structureModifiers } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

// Database connection
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/uncharted-lands';
const client = postgres(connectionString);
const db = drizzle(client);

async function runMigration() {
  console.log('🔧 Starting Population Capacity Modifiers Migration...\n');

  try {
    // Step 1: Check BEFORE state
    console.log('📊 BEFORE Migration:');
    const beforeModifiers = await db
      .select()
      .from(structureModifiers)
      .where(eq(structureModifiers.name, 'Housing Capacity'));
    
    console.log(`Found ${beforeModifiers.length} modifiers with name "Housing Capacity"`);
    if (beforeModifiers.length > 0) {
      console.log('Sample:', beforeModifiers[0]);
    }
    console.log('');

    // Step 2: Run UPDATE migration
    console.log('🔄 Running UPDATE migration...');
    const result = await db
      .update(structureModifiers)
      .set({
        name: 'Population Capacity',
        value: 2,
        description: 'Provides shelter for 2 people'
      })
      .where(eq(structureModifiers.name, 'Housing Capacity'));
    
    console.log('✅ Migration executed successfully\n');

    // Step 3: Check AFTER state
    console.log('📊 AFTER Migration:');
    const afterModifiers = await db
      .select()
      .from(structureModifiers)
      .where(eq(structureModifiers.name, 'Population Capacity'));
    
    console.log(`Found ${afterModifiers.length} modifiers with name "Population Capacity"`);
    if (afterModifiers.length > 0) {
      console.log('Sample:', afterModifiers[0]);
    }
    console.log('');

    // Step 4: Verify old name is gone
    const remainingOld = await db
      .select()
      .from(structureModifiers)
      .where(eq(structureModifiers.name, 'Housing Capacity'));
    
    if (remainingOld.length === 0) {
      console.log('✅ SUCCESS: No "Housing Capacity" modifiers remain');
      console.log(`✅ SUCCESS: ${afterModifiers.length} "Population Capacity" modifiers now exist`);
    } else {
      console.log(`⚠️  WARNING: ${remainingOld.length} "Housing Capacity" modifiers still exist`);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
    console.log('\n🏁 Migration script complete');
  }
}

// Run the migration
runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
