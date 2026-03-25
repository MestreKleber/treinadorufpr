import { spawn } from "child_process";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

type IngestSummaryItem = {
  baseName: string;
  extracted: number;
  imported: number;
  outputDir: string;
};

function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response("__RESULT__" + safeJson({ error: "OPENAI_API_KEY não configurada no .env." }) + "\n", {
      status: 400,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const sourcePrefix = String(formData.get("sourcePrefix") ?? "UFPR").trim() || "UFPR";
  const chunkRaw = Number(formData.get("chunkSize") ?? 6);
  const chunkSize = Number.isFinite(chunkRaw) ? Math.max(1, Math.min(12, Math.floor(chunkRaw))) : 6;
  const renderImages = String(formData.get("renderImages") ?? "true") !== "false";

  if (!(file instanceof File)) {
    return new Response("__RESULT__" + safeJson({ error: "Envie um arquivo PDF válido." }) + "\n", {
      status: 400,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  }

  const fileName = file.name || "prova.pdf";
  if (!fileName.toLowerCase().endsWith(".pdf")) {
    return new Response("__RESULT__" + safeJson({ error: "O arquivo precisa estar em formato .pdf." }) + "\n", {
      status: 400,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  }

  const bytes = await file.arrayBuffer();
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const uploadDir = path.join(process.cwd(), "data", "uploads", unique);
  await mkdir(uploadDir, { recursive: true });
  const savedPdfPath = path.join(uploadDir, fileName);
  await writeFile(savedPdfPath, Buffer.from(bytes));

  const proofSlug = slugify(path.basename(fileName, path.extname(fileName)));
  const publicPdfDir = path.join(process.cwd(), "public", "questoes", "importadas", proofSlug);
  await mkdir(publicPdfDir, { recursive: true });
  const publicPdfPath = path.join(publicPdfDir, "original.pdf");
  await writeFile(publicPdfPath, Buffer.from(bytes));
  const publicPdfUrl = `/questoes/importadas/${proofSlug}/original.pdf`;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const writeLine = (line: string) => controller.enqueue(encoder.encode(`${line}\n`));

      const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
      const ingestArgs = [
        "--input",
        uploadDir,
        "--source-prefix",
        sourcePrefix,
        "--chunk",
        String(chunkSize),
        "--pdf-public-url",
        publicPdfUrl,
      ];
      if (!renderImages) {
        ingestArgs.push("--no-images");
      }

      writeLine(`[upload] arquivo recebido: ${fileName}`);
      writeLine(`[upload] iniciando ingestão...`);

      const proc = spawn(npmCmd, ["run", "ingest:pdf", "--", ...ingestArgs], {
        cwd: process.cwd(),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });

      proc.stdout.on("data", (chunk) => {
        const text = chunk.toString();
        for (const line of text.split(/\r?\n/)) {
          if (line.trim()) writeLine(line);
        }
      });

      proc.stderr.on("data", (chunk) => {
        const text = chunk.toString();
        for (const line of text.split(/\r?\n/)) {
          if (line.trim()) writeLine(`[stderr] ${line}`);
        }
      });

      proc.on("close", async (code) => {
        try {
          if ((code ?? 1) !== 0) {
            writeLine("__RESULT__" + safeJson({ error: "Falha ao processar o PDF.", exitCode: code ?? 1 }));
            return;
          }

          const summaryPath = path.join(process.cwd(), "data", "processed", "ingest-summary.json");
          const summaryRaw = await readFile(summaryPath, "utf8");
          const summary = JSON.parse(summaryRaw) as IngestSummaryItem[];
          const baseName = path.basename(fileName, path.extname(fileName));
          const current = summary.find((item) => item.baseName === baseName) ?? summary.at(-1);

          if (!current) {
            writeLine("__RESULT__" + safeJson({ error: "PDF processado, mas sem resumo de importação." }));
            return;
          }

          writeLine(
            "__RESULT__" +
              safeJson({
                ok: true,
                fileName,
                extracted: current.extracted,
                imported: current.imported,
                outputDir: current.outputDir,
              }),
          );
        } catch (error) {
          writeLine("__RESULT__" + safeJson({ error: "Falha ao montar resultado final.", details: String(error) }));
        } finally {
          await rm(uploadDir, { recursive: true, force: true });
          controller.close();
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}