"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { BarChart3, FileUp, ImageUp, PlusCircle, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatSubjectLabel } from "@/lib/pt";

type QuestionListItem = {
  id: number;
  subject: string;
  topic: string | null;
  bundleId: string | null;
  statement: string;
  source: string | null;
  difficulty: number | null;
};

type AlternativeForm = {
  label: "A" | "B" | "C" | "D" | "E";
  text: string;
  isCorrect: boolean;
};

type BulkQuestionInput = {
  subject: string;
  topic?: string;
  statement: string;
  imageUrl?: string;
  source?: string;
  difficulty: number;
  alternatives: AlternativeForm[];
};

type ReportTopic = {
  topic: string;
  count: number;
  percentageWithinSubject: number;
  percentageGlobal: number;
};

type ReportResponse = {
  totalQuestions: number;
  totalBundles: number;
  bySubject: Array<{
    subject: string;
    count: number;
    percentage: number;
    topics: ReportTopic[];
  }>;
  byTopicGlobal: Array<{ topic: string; count: number; percentage: number }>;
  byDifficulty: Array<{ difficulty: number; count: number; percentage: number }>;
  availableSources?: string[];
  availableYears?: string[];
  appliedFilters?: {
    source: string | null;
    year: string | null;
  };
};

type ReportMode = "geral" | "por-prova";

const defaultAlternatives: AlternativeForm[] = [
  { label: "A", text: "", isCorrect: false },
  { label: "B", text: "", isCorrect: false },
  { label: "C", text: "", isCorrect: false },
  { label: "D", text: "", isCorrect: false },
  { label: "E", text: "", isCorrect: false },
];

export function AdminClient() {
  const [questions, setQuestions] = useState<QuestionListItem[]>([]);
  const [subject, setSubject] = useState("Matematica");
  const [topic, setTopic] = useState("");
  const [statement, setStatement] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [source, setSource] = useState("UFPR - manual");
  const [difficulty, setDifficulty] = useState(2);
  const [alternatives, setAlternatives] = useState<AlternativeForm[]>(defaultAlternatives);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [bulkJson, setBulkJson] = useState("[]");
  const [importingBulk, setImportingBulk] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfSourcePrefix, setPdfSourcePrefix] = useState("UFPR");
  const [pdfChunkSize, setPdfChunkSize] = useState(6);
  const [pdfRenderImages, setPdfRenderImages] = useState(true);
  const [importingPdf, setImportingPdf] = useState(false);
  const [pdfDebugLog, setPdfDebugLog] = useState("");
  const [reportMode, setReportMode] = useState<ReportMode>("geral");
  const [reportYear, setReportYear] = useState("all");
  const [reportSource, setReportSource] = useState("all");
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const debugBoxRef = useRef<HTMLPreElement | null>(null);

  async function loadQuestions() {
    const res = await fetch("/api/admin/questions");
    const data = (await res.json()) as { questions: QuestionListItem[] };
    setQuestions(data.questions ?? []);
  }

  async function loadReport() {
    setLoadingReport(true);
    try {
      const params = new URLSearchParams();
      if (reportMode === "por-prova") {
        if (reportYear !== "all") {
          params.set("year", reportYear);
        }
        if (reportSource !== "all") {
          params.set("source", reportSource);
        }
      }

      const url = params.size > 0
        ? `/api/admin/reports/content-distribution?${params.toString()}`
        : "/api/admin/reports/content-distribution";

      const res = await fetch(url);
      const data = (await res.json()) as ReportResponse;
      setReport(data);
    } finally {
      setLoadingReport(false);
    }
  }

  useEffect(() => {
    void loadQuestions();
  }, []);

  useEffect(() => {
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportMode, reportYear, reportSource]);

  function setAlternativeText(index: number, value: string) {
    setAlternatives((prev) => prev.map((item, i) => (i === index ? { ...item, text: value } : item)));
  }

  function setCorrect(label: AlternativeForm["label"]) {
    setAlternatives((prev) => prev.map((item) => ({ ...item, isCorrect: item.label === label })));
  }

  async function uploadImage() {
    if (!imageFile) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", imageFile);

      const res = await fetch("/api/admin/upload-image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? "Falha no upload");
      }

      const payload = (await res.json()) as { imageUrl: string };
      setImageUrl(payload.imageUrl);
      setImageFile(null);
    } catch (error) {
      console.error(error);
      alert("Não foi possível enviar a imagem. Verifique formato e tamanho.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function submitQuestion() {
    setSaving(true);
    try {
      await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          topic,
          statement,
          imageUrl,
          source,
          difficulty,
          alternatives,
        }),
      });

      setTopic("");
      setStatement("");
      setImageUrl("");
      setImageFile(null);
      setAlternatives(defaultAlternatives);
      await loadQuestions();
    } finally {
      setSaving(false);
    }
  }

  async function removeQuestion(id: number) {
    await fetch(`/api/admin/questions?id=${id}`, { method: "DELETE" });
    await loadQuestions();
  }

  async function importBulkQuestions() {
    setImportingBulk(true);
    try {
      const parsed = JSON.parse(bulkJson) as BulkQuestionInput[];
      const res = await fetch("/api/admin/questions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: parsed, autoClassify: true }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error ? String(payload.error) : "Falha na importação");
      }

      alert(`Importação concluída: ${payload.insertedCount} questões cadastradas.`);
      await loadQuestions();
      await loadReport();
    } catch (error) {
      console.error(error);
      alert("Não foi possível importar o JSON. Verifique o formato e tente novamente.");
    } finally {
      setImportingBulk(false);
    }
  }

  async function onBulkFileChange(file: File | null) {
    if (!file) return;

    try {
      const text = await file.text();
      setBulkJson(text);
    } catch {
      alert("Não foi possível ler o arquivo JSON.");
    }
  }

  async function importPdf() {
    if (!pdfFile) return;

    setImportingPdf(true);
    setPdfDebugLog("");
    try {
      const formData = new FormData();
      formData.append("file", pdfFile);
      formData.append("sourcePrefix", pdfSourcePrefix);
      formData.append("chunkSize", String(pdfChunkSize));
      formData.append("renderImages", pdfRenderImages ? "true" : "false");

      const res = await fetch("/api/admin/upload-pdf/stream", {
        method: "POST",
        body: formData,
      });

      if (!res.ok || !res.body) {
        const errorBody = await res.text();
        throw new Error(errorBody || "Falha ao iniciar processamento em stream");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result: { ok?: boolean; error?: string; extracted?: number; imported?: number } | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          if (line.startsWith("__RESULT__")) {
            result = JSON.parse(line.replace("__RESULT__", ""));
          } else {
            setPdfDebugLog((prev) => (prev ? `${prev}\n${line}` : line));
          }
        }
      }

      if (buffer.trim()) {
        if (buffer.startsWith("__RESULT__")) {
          result = JSON.parse(buffer.replace("__RESULT__", ""));
        } else {
          setPdfDebugLog((prev) => (prev ? `${prev}\n${buffer}` : buffer));
        }
      }

      if (!result) {
        throw new Error("Importação finalizou sem resultado final.");
      }

      if (!result.ok) {
        throw new Error(result.error ?? "Falha na importação do PDF");
      }

      alert(
        `PDF processado com sucesso. Questões extraídas: ${result.extracted ?? 0}. Questões importadas: ${result.imported ?? 0}.`,
      );
      setPdfFile(null);
      await loadQuestions();
      await loadReport();
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      alert(`Não foi possível processar o PDF. ${message}`);
    } finally {
      setImportingPdf(false);
    }
  }

  const filteredSources = (report?.availableSources ?? []).filter((item) => {
    if (reportYear === "all") return true;
    return item.includes(reportYear);
  });

  useEffect(() => {
    if (debugBoxRef.current) {
      debugBoxRef.current.scrollTop = debugBoxRef.current.scrollHeight;
    }
  }, [pdfDebugLog]);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Admin de Questões</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 rounded-lg border bg-zinc-50 p-4">
            <p className="text-base font-semibold">Upload de prova (PDF)</p>
            <p className="text-sm text-zinc-700">
              Envie o PDF completo da prova. A IA extrai questões, classifica disciplina/conteúdo/dificuldade,
              identifica bundles de enunciado compartilhado e importa no banco automaticamente.
            </p>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="pdfUpload">Arquivo PDF</Label>
                <Input
                  id="pdfUpload"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pdfSourcePrefix">Prefixo da fonte</Label>
                <Input
                  id="pdfSourcePrefix"
                  value={pdfSourcePrefix}
                  onChange={(e) => setPdfSourcePrefix(e.target.value)}
                  placeholder="UFPR"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3 md:items-end">
              <div className="space-y-2">
                <Label htmlFor="pdfChunkSize">Páginas por chunk IA</Label>
                <Input
                  id="pdfChunkSize"
                  type="number"
                  min={1}
                  max={12}
                  value={pdfChunkSize}
                  onChange={(e) => setPdfChunkSize(Number(e.target.value))}
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={pdfRenderImages}
                  onChange={(e) => setPdfRenderImages(e.target.checked)}
                />
                Gerar imagens das páginas (gráficos/figuras)
              </label>
              <Button type="button" onClick={importPdf} disabled={!pdfFile || importingPdf}>
                <Upload className="mr-2 h-4 w-4" />
                {importingPdf ? "Processando PDF..." : "Enviar PDF e importar"}
              </Button>
            </div>

            <div className="space-y-2 rounded-lg border bg-black p-3">
              <p className="text-sm font-semibold text-zinc-100">Debug da importação (tempo real)</p>
              <pre
                ref={debugBoxRef}
                className="max-h-56 overflow-auto whitespace-pre-wrap text-xs text-emerald-300"
              >
                {pdfDebugLog || "Aguardando início da importação..."}
              </pre>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border bg-zinc-50 p-4">
            <p className="text-base font-semibold">Importação em lote (JSON)</p>
            <p className="text-sm text-zinc-700">
              Cole um array JSON de questões ou carregue um arquivo .json para cadastrar tudo de uma vez. A IA classifica
              automaticamente disciplina, conteúdo, dificuldade e bundles compartilhados.
            </p>
            <Textarea value={bulkJson} onChange={(e) => setBulkJson(e.target.value)} rows={8} />
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="file"
                accept="application/json"
                onChange={(e) => void onBulkFileChange(e.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="outline" onClick={importBulkQuestions} disabled={importingBulk}>
                <FileUp className="mr-2 h-4 w-4" />
                {importingBulk ? "Importando..." : "Importar JSON"}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="subject">Matéria</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="topic">Tópico</Label>
              <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="statement">Enunciado</Label>
            <Textarea
              id="statement"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="imageUrl">URL da imagem (opcional)</Label>
            <Input
              id="imageUrl"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="/questoes/ufpr-2023/q012-fig1.png"
            />

            <div className="mt-2 rounded-lg border bg-zinc-50 p-3">
              <Label htmlFor="imageUpload">Upload de imagem</Label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Input
                  id="imageUpload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={uploadImage}
                  disabled={!imageFile || uploadingImage}
                >
                  <ImageUp className="mr-2 h-4 w-4" />
                  {uploadingImage ? "Enviando..." : "Enviar imagem"}
                </Button>
              </div>
              <p className="mt-2 text-xs text-zinc-600">Formatos: PNG, JPG, WEBP. Tamanho máximo: 5MB.</p>
            </div>

            {imageUrl ? (
              <div className="overflow-hidden rounded-lg border bg-white p-2">
                <Image
                  src={imageUrl}
                  alt="Pré-visualização da imagem"
                  width={720}
                  height={480}
                  className="max-h-64 w-auto rounded object-contain"
                />
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="source">Fonte</Label>
              <Input id="source" value={source} onChange={(e) => setSource(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="difficulty">Dificuldade (1-5)</Label>
              <Input
                id="difficulty"
                type="number"
                min={1}
                max={5}
                value={difficulty}
                onChange={(e) => setDifficulty(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border bg-zinc-50 p-4">
            <p className="text-sm font-semibold">Alternativas (A-E)</p>
            {alternatives.map((alt, index) => (
              <div key={alt.label} className="grid gap-2 md:grid-cols-[auto_1fr_auto] md:items-center">
                <p className="font-medium">{alt.label})</p>
                <Input
                  value={alt.text}
                  onChange={(e) => setAlternativeText(index, e.target.value)}
                  placeholder={`Texto da alternativa ${alt.label}`}
                />
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="correct"
                    checked={alt.isCorrect}
                    onChange={() => setCorrect(alt.label)}
                  />
                  Correta
                </label>
              </div>
            ))}
          </div>

          <Button onClick={submitQuestion} disabled={saving}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {saving ? "Salvando..." : "Cadastrar questão"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-2">
            <CardTitle className="inline-flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Relatório de conteúdo
            </CardTitle>
            <div className="inline-flex rounded-lg border p-1">
              <button
                type="button"
                className={`rounded-md px-3 py-1 text-sm ${reportMode === "geral" ? "bg-zinc-900 text-white" : "text-zinc-700"}`}
                onClick={() => setReportMode("geral")}
              >
                Geral
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1 text-sm ${reportMode === "por-prova" ? "bg-zinc-900 text-white" : "text-zinc-700"}`}
                onClick={() => setReportMode("por-prova")}
              >
                Por prova/ano
              </button>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadReport()} disabled={loadingReport}>
            {loadingReport ? "Atualizando..." : "Atualizar"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {reportMode === "por-prova" ? (
            <div className="grid gap-3 rounded-lg border bg-zinc-50 p-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="reportYear">Ano</Label>
                <select
                  id="reportYear"
                  value={reportYear}
                  onChange={(e) => {
                    setReportYear(e.target.value);
                    setReportSource("all");
                  }}
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
                >
                  <option value="all">Todos</option>
                  {(report?.availableYears ?? []).map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="reportSource">Prova/Fonte</Label>
                <select
                  id="reportSource"
                  value={reportSource}
                  onChange={(e) => setReportSource(e.target.value)}
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
                >
                  <option value="all">Todas do filtro</option>
                  {filteredSources.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          {report ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border bg-zinc-50 p-3">
                  <p className="text-sm text-zinc-600">Total de questões</p>
                  <p className="text-2xl font-semibold">{report.totalQuestions}</p>
                </div>
                <div className="rounded-lg border bg-zinc-50 p-3">
                  <p className="text-sm text-zinc-600">Bundles detectados</p>
                  <p className="text-2xl font-semibold">{report.totalBundles}</p>
                </div>
                <div className="rounded-lg border bg-zinc-50 p-3">
                  <p className="text-sm text-zinc-600">Tópicos mapeados</p>
                  <p className="text-2xl font-semibold">{report.byTopicGlobal.length}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Distribuição por disciplina</p>
                <div className="space-y-2">
                  {report.bySubject.map((item) => (
                    <div key={item.subject} className="rounded-lg border p-3">
                      <p className="font-medium">
                        {formatSubjectLabel(item.subject)}: {item.count} questões ({item.percentage.toFixed(2)}%)
                      </p>
                      <p className="text-xs text-zinc-600">
                        Principais conteúdos: {item.topics.slice(0, 5).map((topic) => `${topic.topic} (${topic.percentageWithinSubject.toFixed(2)}%)`).join(", ") || "-"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Dificuldade (percentual global)</p>
                <div className="grid gap-2 md:grid-cols-5">
                  {report.byDifficulty.map((item) => (
                    <div key={item.difficulty} className="rounded-lg border bg-zinc-50 p-3 text-center">
                      <p className="text-sm text-zinc-600">Nível {item.difficulty}</p>
                      <p className="text-lg font-semibold">{item.percentage.toFixed(2)}%</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-600">Sem dados para relatório ainda.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Banco de questões</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Matéria</TableHead>
                <TableHead>Tópico</TableHead>
                <TableHead>Bundle</TableHead>
                <TableHead>Dificuldade</TableHead>
                <TableHead>Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map((question) => (
                <TableRow key={question.id}>
                  <TableCell>{question.id}</TableCell>
                  <TableCell>{formatSubjectLabel(question.subject)}</TableCell>
                  <TableCell>{question.topic ?? "-"}</TableCell>
                  <TableCell>{question.bundleId ?? "-"}</TableCell>
                  <TableCell>{question.difficulty ?? 2}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => removeQuestion(question.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
