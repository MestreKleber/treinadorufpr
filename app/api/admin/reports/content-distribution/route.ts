import { NextResponse } from "next/server";
import { db } from "@/db";
import { questions } from "@/db/schema";

function toPercent(count: number, total: number) {
  if (!total) return 0;
  return Number(((count / total) * 100).toFixed(2));
}

export async function GET() {
  const rows = await db
    .select({
      subject: questions.subject,
      topic: questions.topic,
      difficulty: questions.difficulty,
      bundleId: questions.bundleId,
    })
    .from(questions);

  const total = rows.length;

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
  });
}
