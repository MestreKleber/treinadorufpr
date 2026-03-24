import { and, eq, like, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { questions } from "@/db/schema";

function toPercent(count: number, total: number) {
  if (!total) return 0;
  return Number(((count / total) * 100).toFixed(2));
}

function extractYear(source: string) {
  const match = source.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : null;
}

export async function GET(req: NextRequest) {
  const sourceFilter = req.nextUrl.searchParams.get("source")?.trim() ?? "";
  const yearFilter = req.nextUrl.searchParams.get("year")?.trim() ?? "";

  const whereClauses = [] as ReturnType<typeof eq>[];
  if (sourceFilter && sourceFilter !== "all") {
    whereClauses.push(eq(questions.source, sourceFilter));
  }
  if (yearFilter && /^\d{4}$/.test(yearFilter)) {
    whereClauses.push(like(questions.source, `%${yearFilter}%`));
  }

  const whereExpr =
    whereClauses.length === 0
      ? undefined
      : whereClauses.length === 1
        ? whereClauses[0]
        : and(...whereClauses);

  const rows = await db
    .select({
      subject: questions.subject,
      topic: questions.topic,
      difficulty: questions.difficulty,
      bundleId: questions.bundleId,
      source: questions.source,
    })
    .from(questions)
    .where(whereExpr);

  const sourceRows = await db
    .select({ source: questions.source })
    .from(questions)
    .where(sql`${questions.source} is not null and trim(${questions.source}) <> ''`)
    .groupBy(questions.source)
    .orderBy(sql`${questions.source} asc`);

  const total = rows.length;

  const availableSources = sourceRows
    .map((row) => row.source?.trim() ?? "")
    .filter((item) => item.length > 0);

  const availableYears = [...new Set(availableSources.map((item) => extractYear(item)).filter((item): item is string => Boolean(item)))].sort();

  const subjectMap = new Map<string, { count: number; topics: Map<string, number> }>();
  const topicGlobalMap = new Map<string, number>();
  const difficultyMap = new Map<number, number>();
  const bundleIds = new Set<string>();

  for (const row of rows) {
    const subject = row.subject || "Geral";
    const topic = row.topic?.trim() || "Sem tópico";
    const difficulty = row.difficulty ?? 3;

    if (row.bundleId?.trim()) {
      bundleIds.add(row.bundleId.trim());
    }

    const currentSubject = subjectMap.get(subject) ?? { count: 0, topics: new Map<string, number>() };
    currentSubject.count += 1;
    currentSubject.topics.set(topic, (currentSubject.topics.get(topic) ?? 0) + 1);
    subjectMap.set(subject, currentSubject);

    topicGlobalMap.set(topic, (topicGlobalMap.get(topic) ?? 0) + 1);
    difficultyMap.set(difficulty, (difficultyMap.get(difficulty) ?? 0) + 1);
  }

  const bySubject = [...subjectMap.entries()]
    .map(([subject, data]) => ({
      subject,
      count: data.count,
      percentage: toPercent(data.count, total),
      topics: [...data.topics.entries()]
        .map(([topic, count]) => ({
          topic,
          count,
          percentageWithinSubject: toPercent(count, data.count),
          percentageGlobal: toPercent(count, total),
        }))
        .sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.count - a.count);

  const byTopicGlobal = [...topicGlobalMap.entries()]
    .map(([topic, count]) => ({
      topic,
      count,
      percentage: toPercent(count, total),
    }))
    .sort((a, b) => b.count - a.count);

  const byDifficulty = [...difficultyMap.entries()]
    .map(([difficulty, count]) => ({
      difficulty,
      count,
      percentage: toPercent(count, total),
    }))
    .sort((a, b) => a.difficulty - b.difficulty);

  return NextResponse.json({
    totalQuestions: total,
    totalBundles: bundleIds.size,
    bySubject,
    byTopicGlobal,
    byDifficulty,
    availableSources,
    availableYears,
    appliedFilters: {
      source: sourceFilter || null,
      year: yearFilter || null,
    },
  });
}
