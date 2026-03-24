import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

type DraftAlternative = { label: "A" | "B" | "C" | "D" | "E"; text: string };

type QuestionDraft = {
  subject?: string;
  topic?: string;
  difficulty?: number;
  statement: string;
  source?: string;
  alternatives: DraftAlternative[];
};

type EnrichedMeta = {
  subject: string;
  topic?: string;
  difficulty: number;
  bundleId?: string;
  bundleTitle?: string;
  bundleContext?: string;
};

const aiSchema = z.object({
  items: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      subject: z.string().min(1),
      topic: z.string().optional(),
      difficulty: z.number().int().min(1).max(5),
      bundleId: z.string().min(1).optional(),
      bundleTitle: z.string().min(1).optional(),
      bundleContext: z.string().min(10).optional(),
    }),
  ),
});

function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
}

function fallbackMeta(draft: QuestionDraft, index: number): EnrichedMeta {
  const bundleHint = /(quest(ao|ões)|responda).*(1\s*e\s*2|2\s*e\s*3|itens|seguintes)/i.test(draft.statement);
  const bundleId = bundleHint ? `bloco-${index + 1}` : undefined;

  return {
    subject: draft.subject?.trim() || "Geral",
    topic: draft.topic?.trim() || undefined,
    difficulty: Math.min(5, Math.max(1, draft.difficulty ?? 3)),
    bundleId,
    bundleTitle: bundleId ? "Bloco compartilhado" : undefined,
    bundleContext: undefined,
  };
}

export async function enrichQuestionDraftsWithAI(drafts: QuestionDraft[]): Promise<EnrichedMeta[]> {
  if (drafts.length === 0) return [];

  if (!process.env.OPENAI_API_KEY) {
    return drafts.map((draft, index) => fallbackMeta(draft, index));
  }

  const payload = drafts.map((draft, index) => ({
    index,
    statement: draft.statement,
    source: draft.source,
    alternatives: draft.alternatives,
    existingSubject: draft.subject,
    existingTopic: draft.topic,
    existingDifficulty: draft.difficulty,
  }));

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: aiSchema,
    temperature: 0.1,
    prompt: [
      "Classifique questões de vestibular UFPR.",
      "Para cada item, defina subject, topic e difficulty (1 a 5).",
      "Quando houver enunciado compartilhado para duas ou mais questões, defina bundleId, bundleTitle e bundleContext iguais entre elas.",
      "bundleId deve ser curto, em kebab-case, estável no mesmo bloco.",
      "Se não houver bloco compartilhado, não preencha campos de bundle.",
      "Respeite conteúdo acadêmico realista para disciplinas de vestibular.",
      JSON.stringify(payload),
    ].join("\n"),
  });

  const byIndex = new Map(object.items.map((item) => [item.index, item]));

  return drafts.map((draft, index) => {
    const aiItem = byIndex.get(index);
    if (!aiItem) {
      return fallbackMeta(draft, index);
    }

    const bundleId = aiItem.bundleId ? slugify(aiItem.bundleId) : undefined;

    return {
      subject: aiItem.subject.trim() || draft.subject?.trim() || "Geral",
      topic: aiItem.topic?.trim() || draft.topic?.trim() || undefined,
      difficulty: Math.min(5, Math.max(1, aiItem.difficulty || draft.difficulty || 3)),
      bundleId,
      bundleTitle: aiItem.bundleTitle?.trim() || undefined,
      bundleContext: aiItem.bundleContext?.trim() || undefined,
    };
  });
}
