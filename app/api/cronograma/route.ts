import { streamText } from "ai";
import { NextRequest } from "next/server";
import { z } from "zod";
import { buildSchedulePrompt, scheduleModel } from "@/lib/ai";

export const maxDuration = 30;

const bodySchema = z.object({
  performance: z.array(
    z.object({
      subject: z.string(),
      percentage: z.number(),
      total: z.number().int().nonnegative(),
    }),
  ),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = bodySchema.parse(body);

  const result = streamText({
    model: scheduleModel,
    prompt: buildSchedulePrompt(data.performance),
    temperature: 0.4,
  });

  return result.toTextStreamResponse();
}
