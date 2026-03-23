import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { alternatives, questions } from "@/db/schema";

const alternativeSchema = z.object({
  label: z.enum(["A", "B", "C", "D", "E"]),
  text: z.string().min(1),
  isCorrect: z.boolean(),
});

const questionSchema = z.object({
  subject: z.string().min(1),
  topic: z.string().optional(),
  statement: z.string().min(10),
  imageUrl: z.string().url().optional().or(z.literal("")),
  source: z.string().optional(),
  difficulty: z.number().int().min(1).max(5),
  alternatives: z.array(alternativeSchema).length(5),
});

export async function GET() {
  const rows = await db
    .select({
      id: questions.id,
      subject: questions.subject,
      topic: questions.topic,
      statement: questions.statement,
      source: questions.source,
      difficulty: questions.difficulty,
    })
    .from(questions);

  return NextResponse.json({ questions: rows });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = questionSchema.parse(body);

    const correctCount = data.alternatives.filter((item) => item.isCorrect).length;
    if (correctCount !== 1) {
      return NextResponse.json(
        { error: "Informe exatamente uma alternativa correta." },
        { status: 400 },
      );
    }

    const inserted = await db
      .insert(questions)
      .values({
        subject: data.subject,
        topic: data.topic,
        statement: data.statement,
        imageUrl: data.imageUrl || null,
        source: data.source,
        difficulty: data.difficulty,
      })
      .returning({ id: questions.id });

    const questionId = inserted[0].id;

    await db.insert(alternatives).values(
      data.alternatives.map((item) => ({
        questionId,
        label: item.label,
        text: item.text,
        isCorrect: item.isCorrect,
      })),
    );

    return NextResponse.json({ ok: true, id: questionId }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Falha ao cadastrar questao." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const idRaw = request.nextUrl.searchParams.get("id");
    const id = Number(idRaw);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID invalido." }, { status: 400 });
    }

    const body = await request.json();
    const data = questionSchema.parse(body);

    const correctCount = data.alternatives.filter((item) => item.isCorrect).length;
    if (correctCount !== 1) {
      return NextResponse.json(
        { error: "Informe exatamente uma alternativa correta." },
        { status: 400 },
      );
    }

    await db
      .update(questions)
      .set({
        subject: data.subject,
        topic: data.topic,
        statement: data.statement,
        imageUrl: data.imageUrl || null,
        source: data.source,
        difficulty: data.difficulty,
      })
      .where(eq(questions.id, id));

    await db.delete(alternatives).where(eq(alternatives.questionId, id));

    await db.insert(alternatives).values(
      data.alternatives.map((item) => ({
        questionId: id,
        label: item.label,
        text: item.text,
        isCorrect: item.isCorrect,
      })),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Falha ao atualizar questao." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const idRaw = request.nextUrl.searchParams.get("id");
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "ID invalido." }, { status: 400 });
  }

  await db.delete(alternatives).where(eq(alternatives.questionId, id));
  await db.delete(questions).where(eq(questions.id, id));
  return NextResponse.json({ ok: true });
}
