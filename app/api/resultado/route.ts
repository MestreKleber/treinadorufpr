import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAttemptHistory, getDetailedRunAnswers, getPerformanceForRun } from "@/lib/resultados";

const querySchema = z.object({
  runAt: z.coerce.number().int().positive(),
});

export async function GET(request: NextRequest) {
  try {
    const runAtRaw = request.nextUrl.searchParams.get("runAt");
    const { runAt } = querySchema.parse({ runAt: runAtRaw });

    const [current, history, details] = await Promise.all([
      getPerformanceForRun(runAt),
      getAttemptHistory(15),
      getDetailedRunAnswers(runAt),
    ]);

    return NextResponse.json({ current, history, details });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Falha ao calcular resultado." }, { status: 500 });
  }
}
