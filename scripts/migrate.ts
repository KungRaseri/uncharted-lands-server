import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Ensure DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

console.log('🚀 Running database migrations...');

// Create a postgres connection for migrations
const migrationClient = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  // Create drizzle instance for migrations
  const db = drizzle(migrationClient);

  // Run migrations
  await migrate(db, { migrationsFolder: './drizzle' });

  console.log('✅ Migrations completed successfully');
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  // Close the connection
  await migrationClient.end();
}
