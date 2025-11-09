import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Ensure DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create postgres connection
// For query purposes
const queryClient = postgres(process.env.DATABASE_URL, {
  max: 10, // Connection pool size
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create drizzle instance
export const db = drizzle(queryClient, { schema });

// Export schema for use in queries
export * from './schema.js';

// Graceful shutdown
export async function closeDatabase() {
  await queryClient.end({ timeout: 5 });
}
