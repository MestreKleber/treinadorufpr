import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const questions = sqliteTable("questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  subject: text("subject").notNull(),
  topic: text("topic"),
  statement: text("statement").notNull(),
  bundleId: text("bundle_id"),
  bundleTitle: text("bundle_title"),
  bundleContext: text("bundle_context"),
  imageUrl: text("image_url"),
  source: text("source"),
  difficulty: integer("difficulty").default(2),
});

export const alternatives = sqliteTable("alternatives", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  questionId: integer("question_id").references(() => questions.id),
  label: text("label"),
  text: text("text").notNull(),
  isCorrect: integer("is_correct", { mode: "boolean" }),
});

export const attempts = sqliteTable("attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  questionId: integer("question_id").references(() => questions.id),
  isCorrect: integer("is_correct", { mode: "boolean" }),
  timeSpentSec: integer("time_spent_sec"),
  attemptedAt: integer("attempted_at", { mode: "timestamp" }),
});

export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type Alternative = typeof alternatives.$inferSelect;
export type NewAlternative = typeof alternatives.$inferInsert;
export type Attempt = typeof attempts.$inferSelect;
export type NewAttempt = typeof attempts.$inferInsert;
