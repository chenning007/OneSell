/**
 * Drizzle ORM schema — PostgreSQL tables for OneSell Scout.
 * Matches ARCHITECTURE §8.1 exactly.
 *
 * Security invariants (P9):
 * - All user-owned queries must enforce WHERE user_id = :userId
 * - All queries are parameterized via Drizzle ORM — no raw SQL
 * - Cascading deletes: user → preferences, sessions, saved_products
 *
 * Closes #92
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  integer,
  smallint,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ── users ───────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  tier: varchar('tier', { length: 20 }).notNull().default('free'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── user_preferences ────────────────────────────────────────────────

export const userPreferences = pgTable(
  'user_preferences',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    market: varchar('market', { length: 10 }).notNull(),
    budgetLocal: numeric('budget_local', { precision: 12, scale: 2 }),
    preferredPlatforms: text('preferred_platforms').array().notNull().default(sql`'{}'`),
    productType: varchar('product_type', { length: 20 }),
    categories: text('categories').array().notNull().default(sql`'{}'`),
    timeAvailability: varchar('time_availability', { length: 20 }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueUserMarket: unique('uq_user_preferences_user_market').on(table.userId, table.market),
  })
);

// ── analysis_sessions ───────────────────────────────────────────────

export const analysisSessions = pgTable(
  'analysis_sessions',
  {
    id: uuid('id').primaryKey(), // Client-generated session UUID
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    market: varchar('market', { length: 10 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    platformsUsed: text('platforms_used').array().notNull().default(sql`'{}'`),
    resultCount: integer('result_count'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    userIdx: index('idx_analysis_sessions_user').on(table.userId, table.createdAt),
  })
);

// ── saved_products ──────────────────────────────────────────────────

export const savedProducts = pgTable(
  'saved_products',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => analysisSessions.id),
    market: varchar('market', { length: 10 }).notNull(),
    productName: varchar('product_name', { length: 500 }).notNull(),
    overallScore: smallint('overall_score').notNull(),
    cardData: jsonb('card_data').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('idx_saved_products_user').on(table.userId, table.createdAt),
  })
);
