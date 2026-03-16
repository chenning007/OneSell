/**
 * Database connection + Drizzle ORM instance.
 *
 * All queries must go through this Drizzle instance — no raw SQL (P9).
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env.js';
import * as schema from './schema.js';

const queryClient = postgres(env.DATABASE_URL);

export const db = drizzle(queryClient, { schema });

export { schema };
