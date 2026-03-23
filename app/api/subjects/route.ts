import { NextResponse } from "next/server";
import { getAvailableSubjects } from "@/lib/simulado";

export async function GET() {
  const subjects = await getAvailableSubjects();
  return NextResponse.json({ subjects });
}
