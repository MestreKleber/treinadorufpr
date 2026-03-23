import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { alternatives, attempts } from "@/db/schema";

const submissionSchema = z.object({
  runAt: z.number().int().positive(),
  answers: z
    .array(
      z.object({
        questionId: z.number().int().positive(),
        selectedAlternativeId: z.number().int().positive().nullable(),
        timeSpentSec: z.number().int().min(0),
      }),
    )
    .min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = submissionSchema.parse(body);

    const questionIds = [...new Set(data.answers.map((item) => item.questionId))];

    const correctRows = await db
      .select({
        questionId: alternatives.questionId,
        alternativeId: alternatives.id,
      })
      .from(alternatives)
      .where(and(inArray(alternatives.questionId, questionIds), eq(alternatives.isCorrect, true)));

    const correctMap = new Map<number, number>();
    for (const row of correctRows) {
      if (!row.questionId) continue;
      correctMap.set(row.questionId, row.alternativeId);
    }

    await db.insert(attempts).values(
      data.answers.map((answer) => ({
        questionId: answer.questionId,
        isCorrect: answer.selectedAlternativeId === correctMap.get(answer.questionId),
        timeSpentSec: answer.timeSpentSec,
        attemptedAt: new Date(data.runAt),
      })),
    );

    return NextResponse.json({ ok: true, runAt: data.runAt });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Falha ao salvar tentativa." }, { status: 500 });
  }
}
