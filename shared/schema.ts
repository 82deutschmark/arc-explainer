import { pgTable, text, serial, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Worm Arena Sessions table for persistent live-link resolution
export const wormArenaSessions = pgTable("worm_arena_sessions", {
  sessionId: varchar("session_id", { length: 255 }).primaryKey(),
  modelA: varchar("model_a", { length: 255 }).notNull(),
  modelB: varchar("model_b", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  gameId: varchar("game_id", { length: 255 }),
});

export const insertWormArenaSessionSchema = createInsertSchema(wormArenaSessions).pick({
  sessionId: true,
  modelA: true,
  modelB: true,
  expiresAt: true,
});

// Visitor stats for landing page
export const visitorStats = pgTable("visitor_stats", {
  id: serial("id").primaryKey(),
  page: varchar("page", { length: 255 }).notNull().unique(),
  count: integer("count").notNull().default(0),
});

export const insertVisitorStatsSchema = createInsertSchema(visitorStats).pick({
  page: true,
  count: true,
});

export type InsertVisitorStats = z.infer<typeof insertVisitorStatsSchema>;
export type VisitorStats = typeof visitorStats.$inferSelect;
