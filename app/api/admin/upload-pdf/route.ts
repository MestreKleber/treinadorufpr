import { spawn } from "child_process";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

type IngestSummaryItem = {
  baseName: string;
  extracted: number;
  imported: number;
  outputDir: string;
};

function runIngestCommand(args: string[]) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
    const proc = spawn(npmCmd, ["run", "ingest:pdf", "--", ...args], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY não configurada no .env." },
      { status: 400 },
    );
  }

  let uploadDir = "";
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const sourcePrefix = String(formData.get("sourcePrefix") ?? "UFPR").trim() || "UFPR";
    const chunkRaw = Number(formData.get("chunkSize") ?? 6);
    const chunkSize = Number.isFinite(chunkRaw) ? Math.max(1, Math.min(12, Math.floor(chunkRaw))) : 6;
    const renderImages = String(formData.get("renderImages") ?? "true") !== "false";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Envie um arquivo PDF válido." }, { status: 400 });
    }

    const fileName = file.name || "prova.pdf";
    if (!fileName.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "O arquivo precisa estar em formato .pdf." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    uploadDir = path.join(process.cwd(), "data", "uploads", unique);
    await mkdir(uploadDir, { recursive: true });

    const savedPdfPath = path.join(uploadDir, fileName);
    await writeFile(savedPdfPath, Buffer.from(bytes));

    const ingestArgs = [
      "--input",
      uploadDir,
      "--source-prefix",
      sourcePrefix,
      "--chunk",
      String(chunkSize),
    ];
    if (!renderImages) {
      ingestArgs.push("--no-images");
    }

    const result = await runIngestCommand(ingestArgs);
    if (result.code !== 0) {
      return NextResponse.json(
        {
          error: "Falha ao processar o PDF.",
          details: result.stderr || result.stdout,
        },
        { status: 500 },
      );
    }

    const summaryPath = path.join(process.cwd(), "data", "processed", "ingest-summary.json");
    const summaryRaw = await readFile(summaryPath, "utf8");
    const summary = JSON.parse(summaryRaw) as IngestSummaryItem[];
    const baseName = path.basename(fileName, path.extname(fileName));
    const current = summary.find((item) => item.baseName === baseName) ?? summary.at(-1);

    if (!current) {
      return NextResponse.json(
        { error: "PDF processado, mas não foi possível localizar o resumo da importação." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      fileName,
      extracted: current.extracted,
      imported: current.imported,
      outputDir: current.outputDir,
      log: (result.stdout || "").split("\n").slice(-20).join("\n").trim(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Falha ao fazer upload e processar o PDF." },
      { status: 500 },
    );
  } finally {
    if (uploadDir) {
      await rm(uploadDir, { recursive: true, force: true });
    }
  }
}