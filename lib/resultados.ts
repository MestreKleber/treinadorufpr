import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { attempts, questions } from "@/db/schema";
import type { PerformanceBySubject } from "@/lib/types";

export async function getPerformanceForRun(runAtMs: number) {
  const runDate = new Date(runAtMs);

  const rows = await db
    .select({
      subject: questions.subject,
      isCorrect: attempts.isCorrect,
    })
    .from(attempts)
    .innerJoin(questions, eq(questions.id, attempts.questionId))
    .where(eq(attempts.attemptedAt, runDate));

  const bySubject = new Map<string, { total: number; correct: number }>();
  for (const row of rows) {
    const bucket = bySubject.get(row.subject) ?? { total: 0, correct: 0 };
    bucket.total += 1;
    if (row.isCorrect) bucket.correct += 1;
    bySubject.set(row.subject, bucket);
  }

  const bySubjectList: PerformanceBySubject[] = [...bySubject.entries()].map(
    ([subject, value]) => ({
      subject,
      total: value.total,
      correct: value.correct,
      percentage: value.total === 0 ? 0 : (value.correct / value.total) * 100,
    }),
  );

  const total = bySubjectList.reduce((acc, item) => acc + item.total, 0);
  const correct = bySubjectList.reduce((acc, item) => acc + item.correct, 0);

  return {
    runAt: runAtMs,
    total,
    correct,
    percentage: total === 0 ? 0 : (correct / total) * 100,
    bySubject: bySubjectList,
  };
}

export async function getAttemptHistory(limit = 10) {
  const rows = await db
    .select({
      attemptedAt: attempts.attemptedAt,
      total: sql<number>`count(*)`,
      correct: sql<number>`sum(case when ${attempts.isCorrect} = 1 then 1 else 0 end)`,
    })
    .from(attempts)
    .groupBy(attempts.attemptedAt)
    .orderBy(desc(attempts.attemptedAt))
    .limit(limit);

  return rows.map((row) => ({
    runAt: row.attemptedAt ? row.attemptedAt.getTime() : 0,
    total: row.total,
    correct: row.correct,
    percentage: row.total === 0 ? 0 : (row.correct / row.total) * 100,
  }));
}

export async function getDetailedRunAnswers(runAtMs: number) {
  const runDate = new Date(runAtMs);
  const rows = await db
    .select({
      questionId: questions.id,
      subject: questions.subject,
      statement: questions.statement,
      isCorrect: attempts.isCorrect,
      topic: questions.topic,
      source: questions.source,
    })
    .from(attempts)
    .innerJoin(questions, eq(questions.id, attempts.questionId))
    .where(eq(attempts.attemptedAt, runDate));

  return rows;
}

export async function getPerformanceWindow(startMs: number, endMs: number) {
  const rows = await db
    .select({
      subject: questions.subject,
      total: sql<number>`count(*)`,
      correct: sql<number>`sum(case when ${attempts.isCorrect} = 1 then 1 else 0 end)`,
    })
    .from(attempts)
    .innerJoin(questions, eq(questions.id, attempts.questionId))
    .where(
      and(
        gte(attempts.attemptedAt, new Date(startMs)),
        lte(attempts.attemptedAt, new Date(endMs)),
      ),
    )
    .groupBy(questions.subject)
    .orderBy(sql`${questions.subject} asc`);

  return rows.map((row) => ({
    subject: row.subject,
    total: row.total,
    correct: row.correct,
    percentage: row.total === 0 ? 0 : (row.correct / row.total) * 100,
  }));
}
