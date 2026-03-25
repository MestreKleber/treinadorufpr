import "dotenv/config";

import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import { createRequire } from "module";
import path from "path";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { z } from "zod";
import { db } from "../db";
import { alternatives, questions } from "../db/schema";

const require = createRequire(import.meta.url);

if (!("getBuiltinModule" in process)) {
  (process as unknown as { getBuiltinModule?: (moduleName: string) => unknown }).getBuiltinModule = (moduleName: string) => {
    try {
      return require(moduleName);
    } catch {
      return undefined;
    }
  };
}

if (!("DOMMatrix" in globalThis)) {
  // pdf-parse requires browser-like canvas globals in some Node versions.
  (globalThis as Record<string, unknown>).DOMMatrix = DOMMatrix;
}
if (!("ImageData" in globalThis)) {
  (globalThis as Record<string, unknown>).ImageData = ImageData;
}
if (!("Path2D" in globalThis)) {
  (globalThis as Record<string, unknown>).Path2D = Path2D;
}

type CliOptions = {
  inputDir: string;
  renderImages: boolean;
  importToDb: boolean;
  chunkSize: number;
  sourcePrefix: string;
  pdfPublicUrl?: string;
};

type ParsedQuestion = {
  subject: string;
  topic?: string;
  statement: string;
  bundleId?: string;
  bundleTitle?: string;
  bundleContext?: string;
  source?: string;
  difficulty: number;
  page: number;
  alternatives: Array<{ label: "A" | "B" | "C" | "D" | "E"; text: string; isCorrect: boolean }>;
};

const LABELS = ["A", "B", "C", "D", "E"] as const;

const aiSchema = z.object({
  questions: z.array(
    z.object({
      page: z.number().int().positive(),
      subject: z.string().min(1),
      topic: z.string().min(1).nullable(),
      statement: z.string().min(20),
      source: z.string().min(1).nullable(),
      difficulty: z.number().int().min(1).max(5),
      bundleId: z.string().min(1).nullable(),
      bundleTitle: z.string().min(1).nullable(),
      sharedContext: z.string().min(1).nullable(),
      alternatives: z
        .array(
          z.object({
            label: z.enum(LABELS),
            text: z.string().min(1),
          }),
        )
        .length(5),
      correctLabel: z.enum(LABELS),
    }),
  ),
});

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    inputDir: "data/provas",
    renderImages: true,
    importToDb: true,
    chunkSize: 6,
    sourcePrefix: "UFPR",
    pdfPublicUrl: undefined,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--input" && argv[i + 1]) {
      options.inputDir = argv[i + 1];
      i += 1;
    } else if (value === "--no-images") {
      options.renderImages = false;
    } else if (value === "--dry-run") {
      options.importToDb = false;
    } else if (value === "--chunk" && argv[i + 1]) {
      options.chunkSize = Math.max(1, Number(argv[i + 1]));
      i += 1;
    } else if (value === "--source-prefix" && argv[i + 1]) {
      options.sourcePrefix = argv[i + 1];
      i += 1;
    } else if (value === "--pdf-public-url" && argv[i + 1]) {
      options.pdfPublicUrl = argv[i + 1];
      i += 1;
    }
  }

  return options;
}

function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function shortStableId(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return `b-${Math.abs(hash).toString(36).slice(0, 8)}`;
}

function splitIntoChunks<T>(arr: T[], size: number) {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

function stripCorrectMarker(text: string) {
  return text.replace(/^\s*[►▶>]+\s*/u, "").trim();
}

function hasCorrectMarker(text: string) {
  return /^\s*[►▶>]+\s*/u.test(text);
}

function inferTopicFallback(subject: string, statement: string) {
  const s = statement.toLowerCase();
  const normalizedSubject = subject.toLowerCase();

  if (normalizedSubject.includes("matem")) {
    if (/fun[cç][aã]o|equa[cç][aã]o|reta|gr[aá]fico/.test(s)) return "Funções e Equações";
    if (/probabilidade|combina[cç][aã]o|arranjo|permuta[cç][aã]o/.test(s)) return "Análise Combinatória e Probabilidade";
    if (/tri[aâ]ngulo|[aá]rea|per[ií]metro|tangente|seno|cosseno/.test(s)) return "Geometria e Trigonometria";
    return "Matemática Geral";
  }

  if (normalizedSubject.includes("f[ií]s") || normalizedSubject.includes("fis")) {
    if (/for[cç]a|movimento|velocidade|acelera[cç][aã]o/.test(s)) return "Mecânica";
    if (/circuito|corrente|tens[aã]o|resistor|el[eé]tric/.test(s)) return "Eletricidade";
    if (/calor|temperatura|termo/.test(s)) return "Termologia";
    if (/onda|luz|espelho|lente|som/.test(s)) return "Ondulatória e Óptica";
    return "Física Geral";
  }

  if (normalizedSubject.includes("qu[ií]m") || normalizedSubject.includes("quim")) {
    if (/org[aâ]nic|hidrocarboneto|fun[cç][aã]o org[aâ]nica/.test(s)) return "Química Orgânica";
    if (/equil[ií]brio|ph|[aá]cido|base/.test(s)) return "Fisico-Química";
    if (/liga[cç][aã]o|estequiometria|mol|rea[cç][aã]o/.test(s)) return "Química Geral";
    return "Química Geral";
  }

  if (normalizedSubject.includes("biolog")) {
    if (/gen[eê]tica|dna|rna|gene/.test(s)) return "Genética";
    if (/ecossistema|bioma|esp[eé]cie|cadeia alimentar|biodivers/.test(s)) return "Ecologia";
    if (/c[eé]lula|tecido|[oó]rg[aã]o|horm[oô]nio/.test(s)) return "Fisiologia";
    return "Biologia Geral";
  }

  if (normalizedSubject.includes("hist")) return "História Geral";
  if (normalizedSubject.includes("geograf")) return "Geografia Geral";
  if (normalizedSubject.includes("liter")) return "Literatura Brasileira";
  if (normalizedSubject.includes("ingl") || normalizedSubject.includes("espan") || normalizedSubject.includes("italian") || normalizedSubject.includes("l[ií]ngua")) {
    return "Compreensão e Interpretação de Texto";
  }

  return "Conteúdo Geral";
}

async function renderPdfPagesWithParser(parser: {
  getScreenshot: (opts: { scale: number }) => Promise<{ pages: Array<{ pageNumber: number; data: Uint8Array }> }>;
}, outputDir: string) {
  const screenshots = await parser.getScreenshot({ scale: 1.5 });
  await mkdir(outputDir, { recursive: true });

  const imageMap = new Map<number, string>();
  for (const page of screenshots.pages) {
    const pageNumber = page.pageNumber;
    const fileName = `page-${String(pageNumber).padStart(3, "0")}.png`;
    const outPath = path.join(outputDir, fileName);
    await writeFile(outPath, Buffer.from(page.data));

    imageMap.set(pageNumber, fileName);
  }

  return imageMap;
}

async function extractQuestionsFromChunk(params: {
  pages: string[];
  startPage: number;
  sourceName: string;
  provaLabel: string;
}) {
  const { pages, startPage, sourceName, provaLabel } = params;

  const chunkText = pages
    .map((pageText, index) => `--- PAGINA ${startPage + index} ---\n${pageText}`)
    .join("\n\n");

  const prompt = [
    `Você é especialista em extração de provas de vestibular da UFPR (${provaLabel}).`,
    "Extraia questões objetivas com 5 alternativas (A-E) e gabarito único.",
    "Regras obrigatórias:",
    "1) Classifique disciplina (subject), tópico (topic) e dificuldade (1 a 5) de cada questão.",
    "1.1) topic é obrigatório para todas as questões e deve ser específico (nunca 'Sem tópico' ou vazio).",
    "2) Quando houver enunciado compartilhado (ex: 'responda as questões 1 e 2'), preencha sharedContext e gere bundleId/bundleTitle iguais para o mesmo bloco.",
    "3) Inclua o número da página real em 'page'.",
    "4) Ignore instruções gerais que não são questão.",
    "5) Retorne apenas questões com alternativas completas A-E e correctLabel.",
    "6) Se o gabarito vier marcado na alternativa por símbolo (ex.: '►' ou '▶'), use essa alternativa como correctLabel e remova o símbolo do texto da alternativa.",
    `Fonte padrão: ${sourceName}.`,
    "Conteúdo bruto das páginas:",
    chunkText,
  ].join("\n");

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: aiSchema,
    prompt,
    temperature: 0.1,
  });

  return object.questions;
}

function normalizeQuestions(
  aiQuestions: z.infer<typeof aiSchema>["questions"],
  opts: { defaultSource: string },
): ParsedQuestion[] {
  const result: ParsedQuestion[] = [];

  for (const q of aiQuestions) {
    const markerMatches = q.alternatives.filter((alt) => hasCorrectMarker(alt.text));
    const inferredCorrectLabel = markerMatches.length === 1 ? markerMatches[0].label : q.correctLabel;

    const correctCount = q.alternatives.filter((alt) => alt.label === inferredCorrectLabel).length;
    if (correctCount !== 1) {
      continue;
    }

    const normalized: ParsedQuestion = {
      subject: q.subject.trim(),
      topic: q.topic?.trim() || inferTopicFallback(q.subject.trim(), q.statement),
      statement: q.statement.trim(),
      bundleId: q.bundleId?.trim() || undefined,
      bundleTitle: q.bundleTitle?.trim() || undefined,
      bundleContext: q.sharedContext?.trim() || undefined,
      source: q.source?.trim() || opts.defaultSource,
      difficulty: q.difficulty,
      page: q.page,
      alternatives: q.alternatives.map((alt) => ({
        label: alt.label,
        text: stripCorrectMarker(alt.text),
        isCorrect: alt.label === inferredCorrectLabel,
      })),
    };

    if (normalized.alternatives.length === 5 && normalized.statement.length > 10) {
      if (normalized.bundleContext && !normalized.bundleId) {
        normalized.bundleId = shortStableId(normalized.bundleContext);
      }
      if (normalized.bundleId && !normalized.bundleTitle) {
        normalized.bundleTitle = "Bloco compartilhado";
      }
      result.push(normalized);
    }
  }

  // Dedup por statement + subject.
  const seen = new Set<string>();
  return result.filter((item) => {
    const key = `${item.subject}::${item.statement.toLowerCase().replace(/\s+/g, " ")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function importQuestionsToDb(
  parsed: ParsedQuestion[],
  imageUrlByPage: Map<number, string>,
  pdfPublicUrl?: string,
) {
  if (parsed.length === 0) return [] as number[];

  const ids = db.transaction((tx) => {
    const insertedIds: number[] = [];

    for (const q of parsed) {
      const pageImage = imageUrlByPage.get(q.page) ?? (pdfPublicUrl ? `${pdfPublicUrl}#page=${q.page}` : null);
      console.log(
        `[import] page=${q.page} subject=${q.subject} topic=${q.topic ?? "-"} bundle=${q.bundleId ?? "-"} hasImage=${pageImage ? "yes" : "no"}`,
      );

      const inserted = tx
        .insert(questions)
        .values({
          subject: q.subject,
          topic: q.topic,
          statement: q.statement,
          bundleId: q.bundleId,
          bundleTitle: q.bundleTitle,
          bundleContext: q.bundleContext,
          imageUrl: pageImage,
          source: q.source,
          difficulty: q.difficulty,
        })
        .returning({ id: questions.id })
        .all();

      const questionId = inserted[0].id;
      insertedIds.push(questionId);

      tx
        .insert(alternatives)
        .values(
          q.alternatives.map((alt) => ({
            questionId,
            label: alt.label,
            text: alt.text,
            isCorrect: alt.isCorrect,
          })),
        )
        .run();

      const correct = q.alternatives.find((item) => item.isCorrect);
      console.log(`[import] questionId=${questionId} correct=${correct?.label ?? "-"}`);
    }

    return insertedIds;
  });

  return ids;
}

function buildAnalytics(parsed: ParsedQuestion[]) {
  const total = parsed.length;
  const bySubject = new Map<string, number>();
  const byTopic = new Map<string, number>();
  const bySubjectTopic = new Map<string, Map<string, number>>();
  const byDifficulty = new Map<number, number>();
  const bundleIds = new Set<string>();

  for (const q of parsed) {
    bySubject.set(q.subject, (bySubject.get(q.subject) ?? 0) + 1);
    if (q.bundleId) {
      bundleIds.add(q.bundleId);
    }

    const subjectTopics = bySubjectTopic.get(q.subject) ?? new Map<string, number>();
    if (q.topic) {
      byTopic.set(q.topic, (byTopic.get(q.topic) ?? 0) + 1);
      subjectTopics.set(q.topic, (subjectTopics.get(q.topic) ?? 0) + 1);
      bySubjectTopic.set(q.subject, subjectTopics);
    }
    byDifficulty.set(q.difficulty, (byDifficulty.get(q.difficulty) ?? 0) + 1);
  }

  const subjectEntries = [...bySubject.entries()].sort((a, b) => b[1] - a[1]);
  const bySubjectWithPercentage = subjectEntries.map(([subject, count]) => ({
    subject,
    count,
    percentage: total === 0 ? 0 : Number(((count / total) * 100).toFixed(2)),
    topics: [...(bySubjectTopic.get(subject)?.entries() ?? [])]
      .map(([topic, topicCount]) => ({
        topic,
        count: topicCount,
        percentageWithinSubject: count === 0 ? 0 : Number(((topicCount / count) * 100).toFixed(2)),
        percentageGlobal: total === 0 ? 0 : Number(((topicCount / total) * 100).toFixed(2)),
      }))
      .sort((a, b) => b.count - a.count),
  }));

  const byTopicWithPercentage = [...byTopic.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => ({
      topic,
      count,
      percentage: total === 0 ? 0 : Number(((count / total) * 100).toFixed(2)),
    }));

  const byDifficultyWithPercentage = [...byDifficulty.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([difficulty, count]) => ({
      difficulty,
      count,
      percentage: total === 0 ? 0 : Number(((count / total) * 100).toFixed(2)),
    }));

  return {
    totalQuestions: total,
    totalBundles: bundleIds.size,
    bySubject: bySubjectWithPercentage,
    byTopic: byTopicWithPercentage,
    byDifficulty: byDifficultyWithPercentage,
  };
}

function mergeAnalytics(items: Array<ReturnType<typeof buildAnalytics>>) {
  const allQuestions = items.reduce((acc, item) => acc + item.totalQuestions, 0);
  const allBundles = items.reduce((acc, item) => acc + item.totalBundles, 0);

  const subjectCounter = new Map<string, number>();
  const topicCounter = new Map<string, number>();
  const difficultyCounter = new Map<number, number>();
  const subjectTopicCounter = new Map<string, Map<string, number>>();

  for (const item of items) {
    for (const subjectRow of item.bySubject) {
      subjectCounter.set(subjectRow.subject, (subjectCounter.get(subjectRow.subject) ?? 0) + subjectRow.count);

      const topicMap = subjectTopicCounter.get(subjectRow.subject) ?? new Map<string, number>();
      for (const topic of subjectRow.topics) {
        topicMap.set(topic.topic, (topicMap.get(topic.topic) ?? 0) + topic.count);
      }
      subjectTopicCounter.set(subjectRow.subject, topicMap);
    }

    for (const topicRow of item.byTopic) {
      topicCounter.set(topicRow.topic, (topicCounter.get(topicRow.topic) ?? 0) + topicRow.count);
    }

    for (const diffRow of item.byDifficulty) {
      difficultyCounter.set(diffRow.difficulty, (difficultyCounter.get(diffRow.difficulty) ?? 0) + diffRow.count);
    }
  }

  const bySubject = [...subjectCounter.entries()]
    .map(([subject, count]) => ({
      subject,
      count,
      percentage: allQuestions === 0 ? 0 : Number(((count / allQuestions) * 100).toFixed(2)),
      topics: [...(subjectTopicCounter.get(subject)?.entries() ?? [])]
        .map(([topic, topicCount]) => ({
          topic,
          count: topicCount,
          percentageWithinSubject: count === 0 ? 0 : Number(((topicCount / count) * 100).toFixed(2)),
          percentageGlobal: allQuestions === 0 ? 0 : Number(((topicCount / allQuestions) * 100).toFixed(2)),
        }))
        .sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.count - a.count);

  const byTopic = [...topicCounter.entries()]
    .map(([topic, count]) => ({
      topic,
      count,
      percentage: allQuestions === 0 ? 0 : Number(((count / allQuestions) * 100).toFixed(2)),
    }))
    .sort((a, b) => b.count - a.count);

  const byDifficulty = [...difficultyCounter.entries()]
    .map(([difficulty, count]) => ({
      difficulty,
      count,
      percentage: allQuestions === 0 ? 0 : Number(((count / allQuestions) * 100).toFixed(2)),
    }))
    .sort((a, b) => a.difficulty - b.difficulty);

  return {
    totalQuestions: allQuestions,
    totalBundles: allBundles,
    bySubject,
    byTopic,
    byDifficulty,
  };
}

async function processPdf(pdfPath: string, options: CliOptions) {
  const pdfBuffer = await readFile(pdfPath);
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: pdfBuffer });
  const textResult = await parser.getText();
  const pages = textResult.pages.map((p) => p.text.trim()).filter((p) => p.length > 0);

  const baseName = path.basename(pdfPath, path.extname(pdfPath));
  const proofSlug = slugify(baseName);
  const sourceName = `${options.sourcePrefix} ${baseName}`;

  console.log(`\n[${baseName}] paginas detectadas: ${pages.length}`);

  let imageFilesByPage = new Map<number, string>();
  if (options.renderImages) {
    try {
      const publicDir = path.join(process.cwd(), "public", "questoes", "importadas", proofSlug);
      const imageNames = await renderPdfPagesWithParser(parser, publicDir);
      imageFilesByPage = new Map(
        [...imageNames.entries()].map(([page, fileName]) => [
          page,
          `/questoes/importadas/${proofSlug}/${fileName}`,
        ]),
      );
      console.log(`[${baseName}] imagens de paginas geradas: ${imageFilesByPage.size}`);
    } catch (error) {
      console.warn(`[${baseName}] falha ao gerar imagens; continuando sem imagens por pagina.`);
      console.warn(error);
    }
  }

  const chunks = splitIntoChunks(pages, options.chunkSize);
  const aiQuestions: z.infer<typeof aiSchema>["questions"] = [];

  for (let i = 0; i < chunks.length; i += 1) {
    const startPage = i * options.chunkSize + 1;
    console.log(`[${baseName}] extraindo chunk ${i + 1}/${chunks.length} (paginas ${startPage}-${startPage + chunks[i].length - 1})`);
    try {
      const extracted = await extractQuestionsFromChunk({
        pages: chunks[i],
        startPage,
        sourceName,
        provaLabel: baseName,
      });
      aiQuestions.push(...extracted);
    } catch (error) {
      console.error(`[${baseName}] falha no chunk ${i + 1}:`, error);
    }
  }

  const normalized = normalizeQuestions(aiQuestions, { defaultSource: sourceName });
  const missingTopics = normalized.filter((item) => !item.topic || item.topic.trim().length === 0).length;
  console.log(`[${baseName}] questoes normalizadas: ${normalized.length}; sem topico: ${missingTopics}`);
  const analytics = buildAnalytics(normalized);

  const outBase = path.join(process.cwd(), "data", "processed", proofSlug);
  await mkdir(outBase, { recursive: true });
  await writeFile(path.join(outBase, "questions.json"), JSON.stringify(normalized, null, 2), "utf8");
  await writeFile(path.join(outBase, "analytics.json"), JSON.stringify(analytics, null, 2), "utf8");

  let insertedIds: number[] = [];
  if (options.importToDb) {
    insertedIds = await importQuestionsToDb(normalized, imageFilesByPage, options.pdfPublicUrl);
  }

  await parser.destroy();

  return {
    baseName,
    extracted: normalized.length,
    imported: insertedIds.length,
    analytics,
    outputDir: outBase,
  };
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY nao configurada. Defina no .env antes de executar.");
  }

  const options = parseArgs(process.argv.slice(2));
  const inputDir = path.resolve(process.cwd(), options.inputDir);

  const files = await readdir(inputDir);
  const pdfFiles = files.filter((f) => f.toLowerCase().endsWith(".pdf"));

  if (pdfFiles.length === 0) {
    console.log(`Nenhum PDF encontrado em ${inputDir}`);
    return;
  }

  console.log(`Iniciando ingestao de ${pdfFiles.length} PDF(s).`);
  console.log(`Render de imagens: ${options.renderImages ? "ativado" : "desativado"}`);
  console.log(`Importar no banco: ${options.importToDb ? "sim" : "nao (dry-run)"}`);

  const summaries = [] as Array<{
    baseName: string;
    extracted: number;
    imported: number;
    outputDir: string;
    analytics: ReturnType<typeof buildAnalytics>;
  }>;

  for (const fileName of pdfFiles) {
    const summary = await processPdf(path.join(inputDir, fileName), options);
    summaries.push(summary);
  }

  await mkdir(path.join(process.cwd(), "data", "processed"), { recursive: true });
  await writeFile(
    path.join(process.cwd(), "data", "processed", "ingest-summary.json"),
    JSON.stringify(summaries, null, 2),
    "utf8",
  );

  const mergedReport = mergeAnalytics(summaries.map((item) => item.analytics));
  await writeFile(
    path.join(process.cwd(), "data", "processed", "report-conteudos.json"),
    JSON.stringify(mergedReport, null, 2),
    "utf8",
  );

  console.log("\nResumo final:");
  for (const item of summaries) {
    console.log(`- ${item.baseName}: extraidas=${item.extracted}, importadas=${item.imported}`);
    console.log(`  saida: ${item.outputDir}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
