import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

function getExtension(file: File) {
  const byMime: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  };

  if (byMime[file.type]) return byMime[file.type];

  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["png", "jpg", "jpeg", "webp"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }

  return "png";
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: "Formato inválido. Use PNG, JPG ou WEBP." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Arquivo muito grande. Limite de 5MB." },
        { status: 400 },
      );
    }

    const extension = getExtension(file);
    const monthFolder = new Date().toISOString().slice(0, 7);
    const relativeDir = path.join("questoes", monthFolder);
    const publicDir = path.join(process.cwd(), "public", relativeDir);
    await mkdir(publicDir, { recursive: true });

    const fileName = `${randomUUID()}.${extension}`;
    const fullPath = path.join(publicDir, fileName);

    const bytes = await file.arrayBuffer();
    await writeFile(fullPath, Buffer.from(bytes));

    return NextResponse.json({
      imageUrl: `/${relativeDir.replaceAll("\\", "/")}/${fileName}`,
    });
  } catch {
    return NextResponse.json({ error: "Falha ao fazer upload da imagem." }, { status: 500 });
  }
}
