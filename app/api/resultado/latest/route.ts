import { NextResponse } from "next/server";
import { getAttemptHistory, getPerformanceForRun } from "@/lib/resultados";

export async function GET() {
  const history = await getAttemptHistory(1);
  if (history.length === 0) {
    return NextResponse.json({
      runAt: null,
      bySubject: [],
    });
  }

  const current = await getPerformanceForRun(history[0].runAt);
  return NextResponse.json({
    runAt: current.runAt,
    bySubject: current.bySubject,
  });
}
