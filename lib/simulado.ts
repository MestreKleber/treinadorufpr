import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { alternatives, questions } from "@/db/schema";
import type { QuestionDTO } from "@/lib/types";

const LABEL_ORDER = ["A", "B", "C", "D", "E"];

export async function pickRandomQuestionsBySubject(
  subjects: string[],
  perSubject: number,
): Promise<QuestionDTO[]> {
  if (subjects.length === 0 || perSubject <= 0) {
    return [];
  }

  const rows = await db
    .select({
      id: questions.id,
      subject: questions.subject,
      topic: questions.topic,
      bundleId: questions.bundleId,
      bundleTitle: questions.bundleTitle,
      bundleContext: questions.bundleContext,
      statement: questions.statement,
      source: questions.source,
      difficulty: questions.difficulty,
      imageUrl: questions.imageUrl,
    })
    .from(questions)
    .where(inArray(questions.subject, subjects));

  const bySubject = new Map<string, typeof rows>();
  for (const row of rows) {
    const current = bySubject.get(row.subject) ?? [];
    current.push(row);
    bySubject.set(row.subject, current);
  }

  const selectedQuestionIds: number[] = [];

  for (const subject of subjects) {
    const pool = [...(bySubject.get(subject) ?? [])];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    selectedQuestionIds.push(...pool.slice(0, perSubject).map((item) => item.id));
  }

  if (selectedQuestionIds.length === 0) {
    return [];
  }

  const altRows = await db
    .select({
      id: alternatives.id,
      questionId: alternatives.questionId,
      label: alternatives.label,
      text: alternatives.text,
    })
    .from(alternatives)
    .where(inArray(alternatives.questionId, selectedQuestionIds));

  const alternativesByQuestion = new Map<number, typeof altRows>();
  for (const alt of altRows) {
    if (!alt.questionId) continue;
    const current = alternativesByQuestion.get(alt.questionId) ?? [];
    current.push(alt);
    alternativesByQuestion.set(alt.questionId, current);
  }

  return selectedQuestionIds
    .map((questionId) => rows.find((row) => row.id === questionId))
    .filter((row): row is (typeof rows)[number] => Boolean(row))
    .map((row) => {
      const sortedAlternatives = [...(alternativesByQuestion.get(row.id) ?? [])].sort(
        (a, b) => {
          const ia = LABEL_ORDER.indexOf(a.label ?? "");
          const ib = LABEL_ORDER.indexOf(b.label ?? "");
          return ia - ib;
        },
      );

      return {
        ...row,
        alternatives: sortedAlternatives.map((alt) => ({
          id: alt.id,
          label: alt.label,
          text: alt.text,
        })),
      };
    });
}

export async function getCorrectAlternativeIds(questionIds: number[]) {
  if (questionIds.length === 0) return new Map<number, number>();

  const rows = await db
    .select({
      questionId: alternatives.questionId,
      alternativeId: alternatives.id,
    })
    .from(alternatives)
    .where(
      and(
        inArray(alternatives.questionId, questionIds),
        eq(alternatives.isCorrect, true),
      ),
    );

  const result = new Map<number, number>();
  for (const row of rows) {
    if (!row.questionId) continue;
    result.set(row.questionId, row.alternativeId);
  }
  return result;
}

export async function getAvailableSubjects() {
  const rows = await db
    .select({ subject: questions.subject })
    .from(questions)
    .groupBy(questions.subject)
    .orderBy(sql`${questions.subject} asc`);

  return rows.map((item) => item.subject);
}
