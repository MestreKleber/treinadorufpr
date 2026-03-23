import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pickRandomQuestionsBySubject } from "@/lib/simulado";

const requestSchema = z.object({
  subjects: z.array(z.string().min(1)).min(1),
  perSubject: z.number().int().min(1).max(20),
  durationMin: z.number().int().min(10).max(300),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = requestSchema.parse(body);

    const questions = await pickRandomQuestionsBySubject(data.subjects, data.perSubject);

    return NextResponse.json({
      runAt: Date.now(),
      durationMin: data.durationMin,
      questions,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Falha ao montar simulado." }, { status: 500 });
  }
}
