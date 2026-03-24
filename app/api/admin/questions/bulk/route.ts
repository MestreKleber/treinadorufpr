import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { alternatives, questions } from "@/db/schema";
import { enrichQuestionDraftsWithAI } from "@/lib/question-enrichment";

const alternativeSchema = z.object({
  label: z.enum(["A", "B", "C", "D", "E"]),
  text: z.string().min(1),
  isCorrect: z.boolean(),
});

const imageUrlSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || value.startsWith("/") || /^https?:\/\//.test(value), {
    message: "imageUrl deve ser URL absoluta ou caminho relativo iniciando com /",
  });

const questionSchema = z.object({
  subject: z.string().min(1).optional(),
  topic: z.string().optional(),
  statement: z.string().min(10),
  imageUrl: imageUrlSchema.optional(),
  source: z.string().optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  bundleId: z.string().optional(),
  bundleTitle: z.string().optional(),
  bundleContext: z.string().optional(),
  alternatives: z.array(alternativeSchema).length(5),
});

const bodySchema = z.object({
  questions: z.array(questionSchema).min(1),
  autoClassify: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = bodySchema.parse(body);

    for (const [index, item] of data.questions.entries()) {
      const correctCount = item.alternatives.filter((alt) => alt.isCorrect).length;
      if (correctCount !== 1) {
        return NextResponse.json(
          { error: `Questão ${index + 1}: informe exatamente uma alternativa correta.` },
          { status: 400 },
        );
      }
    }

    const needsEnrichment = data.autoClassify || data.questions.some((item) => !item.subject || !item.difficulty);
    const enrichedMeta = needsEnrichment
      ? await enrichQuestionDraftsWithAI(
          data.questions.map((item) => ({
            subject: item.subject,
            topic: item.topic,
            difficulty: item.difficulty,
            statement: item.statement,
            source: item.source,
            alternatives: item.alternatives.map((alt) => ({
              label: alt.label,
              text: alt.text,
            })),
          })),
        )
      : null;

    const insertedIds = db.transaction((tx) => {
      const ids: number[] = [];

      for (const [index, item] of data.questions.entries()) {
        const ai = enrichedMeta?.[index];
        const subject = (item.subject ?? ai?.subject ?? "Geral").trim();
        const topic = (item.topic ?? ai?.topic ?? "").trim() || null;
        const difficulty = item.difficulty ?? ai?.difficulty ?? 3;
        const bundleId = (item.bundleId ?? ai?.bundleId ?? "").trim() || null;
        const bundleTitle = (item.bundleTitle ?? ai?.bundleTitle ?? "").trim() || null;
        const bundleContext = (item.bundleContext ?? ai?.bundleContext ?? "").trim() || null;

        const inserted = tx
          .insert(questions)
          .values({
            subject,
            topic,
            statement: item.statement,
            imageUrl: item.imageUrl || null,
            source: item.source,
            difficulty,
            bundleId,
            bundleTitle,
            bundleContext,
          })
          .returning({ id: questions.id })
          .all();

        const questionId = inserted[0].id;
        ids.push(questionId);

        tx
          .insert(alternatives)
          .values(
            item.alternatives.map((alt) => ({
              questionId,
              label: alt.label,
              text: alt.text,
              isCorrect: alt.isCorrect,
            })),
          )
          .run();
      }

      return ids;
    });

    return NextResponse.json({ ok: true, insertedCount: insertedIds.length, ids: insertedIds }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Falha ao importar questões em lote." }, { status: 500 });
  }
}
