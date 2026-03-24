"use client";

import { useState } from "react";
import { Sparkles, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type DayBlock = {
  foco: string;
  atividades: string[];
  duracaoMin: number;
};

type WeekDay = {
  dia: string;
  manha: DayBlock;
  tarde: DayBlock;
  noite: DayBlock;
};

type Schedule = {
  semana: WeekDay[];
  orientacoesGerais: string[];
};

const defaultPerformance = [
  { subject: "Matematica", percentage: 45, total: 20 },
  { subject: "Portugues", percentage: 65, total: 20 },
  { subject: "Ingles", percentage: 72, total: 20 },
  { subject: "Fisica", percentage: 38, total: 20 },
];

export function CronogramaClient() {
  const [loading, setLoading] = useState(false);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [customData, setCustomData] = useState(JSON.stringify(defaultPerformance, null, 2));

  async function loadLatestPerformance() {
    setLoadingLatest(true);
    try {
      const response = await fetch("/api/resultado/latest");
      const data = (await response.json()) as {
        runAt: number | null;
        bySubject: Array<{ subject: string; percentage: number; total: number }>;
      };

      if (data.bySubject.length > 0) {
        setCustomData(JSON.stringify(data.bySubject, null, 2));
      }
    } finally {
      setLoadingLatest(false);
    }
  }

  async function generate() {
    setLoading(true);
    setStreamText("");
    setSchedule(null);

    try {
      const performance = JSON.parse(customData) as Array<{
        subject: string;
        percentage: number;
        total: number;
      }>;

      const response = await fetch("/api/cronograma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ performance }),
      });

      if (!response.body) {
        throw new Error("Stream indisponivel");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setStreamText(fullText);
      }

      try {
        const parsed = JSON.parse(fullText) as Schedule;
        setSchedule(parsed);
      } catch {
        setSchedule(null);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            Cronograma Semanal com IA
          </CardTitle>
          <CardDescription>
            Envie seu desempenho por matéria para gerar plano semanal em streaming.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={customData} onChange={(e) => setCustomData(e.target.value)} rows={8} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={loadLatestPerformance} disabled={loadingLatest}>
              {loadingLatest ? "Buscando..." : "Usar ultimo desempenho"}
            </Button>
            <Button onClick={generate} disabled={loading}>
              {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? "Gerando..." : "Gerar cronograma"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {streamText ? (
        <Card>
          <CardHeader>
            <CardTitle>Streaming</CardTitle>
            <CardDescription>Conteudo chegando em tempo real.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-56 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">
              {streamText}
            </pre>
          </CardContent>
        </Card>
      ) : null}

      {schedule ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {schedule.semana.map((day) => (
            <Card key={day.dia}>
              <CardHeader>
                <CardTitle>{day.dia}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {["manha", "tarde", "noite"].map((period) => {
                  const block = day[period as keyof Pick<WeekDay, "manha" | "tarde" | "noite">];
                  return (
                    <div key={period} className="rounded-lg border bg-zinc-50 p-3">
                      <p className="font-semibold capitalize">{period}</p>
                      <p className="mt-1">Foco: {block.foco}</p>
                      <p>Duração: {block.duracaoMin} min</p>
                      <ul className="mt-1 list-disc pl-4">
                        {block.atividades.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}
    </main>
  );
}
