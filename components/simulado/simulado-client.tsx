"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Timer, Play, ArrowLeft, ArrowRight, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { formatSubjectLabel } from "@/lib/pt";
import type { QuestionDTO } from "@/lib/types";

type SimuladoResponse = {
  runAt: number;
  durationMin: number;
  questions: QuestionDTO[];
};

type AnswerState = {
  selectedAlternativeId: number | null;
  timeSpentSec: number;
};

function formatClock(seconds: number) {
  const safe = Math.max(0, seconds);
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function SimuladoClient() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [perSubject, setPerSubject] = useState(2);
  const [durationMin, setDurationMin] = useState(90);

  const [runAt, setRunAt] = useState<number | null>(null);
  const [questions, setQuestions] = useState<QuestionDTO[]>([]);
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSec, setRemainingSec] = useState(0);
  const [questionStartedAt, setQuestionStartedAt] = useState<number>(Date.now());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/subjects")
      .then((res) => res.json())
      .then((data: { subjects: string[] }) => {
        setSubjects(data.subjects ?? []);
        setSelectedSubjects((data.subjects ?? []).slice(0, 3));
      })
      .catch(() => {
        setSubjects([]);
      });
  }, []);

  useEffect(() => {
    if (remainingSec <= 0) return;
    const id = setInterval(() => {
      setRemainingSec((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(id);
  }, [remainingSec]);

  useEffect(() => {
    if (remainingSec === 0 && questions.length > 0 && runAt) {
      void finishSimulado();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSec]);

  const currentQuestion = questions[currentIndex];

  const progressValue = useMemo(() => {
    if (questions.length === 0) return 0;
    const answered = Object.values(answers).filter((a) => a.selectedAlternativeId !== null).length;
    return (answered / questions.length) * 100;
  }, [answers, questions.length]);

  function toggleSubject(subject: string) {
    setSelectedSubjects((prev) => {
      if (prev.includes(subject)) {
        return prev.filter((item) => item !== subject);
      }
      return [...prev, subject];
    });
  }

  async function startSimulado() {
    if (selectedSubjects.length === 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/simulado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjects: selectedSubjects,
          perSubject,
          durationMin,
        }),
      });

      const data: SimuladoResponse = await res.json();
      setQuestions(data.questions ?? []);
      setRunAt(data.runAt);
      setRemainingSec(data.durationMin * 60);
      setCurrentIndex(0);
      setQuestionStartedAt(Date.now());
      setAnswers({});
    } finally {
      setLoading(false);
    }
  }

  function updateQuestionTime(indexToCommit: number) {
    const question = questions[indexToCommit];
    if (!question) return;

    const elapsed = Math.max(1, Math.round((Date.now() - questionStartedAt) / 1000));
    setAnswers((prev) => {
      const current = prev[question.id] ?? { selectedAlternativeId: null, timeSpentSec: 0 };
      return {
        ...prev,
        [question.id]: {
          ...current,
          timeSpentSec: current.timeSpentSec + elapsed,
        },
      };
    });
  }

  function goToQuestion(nextIndex: number) {
    updateQuestionTime(currentIndex);
    setCurrentIndex(nextIndex);
    setQuestionStartedAt(Date.now());
  }

  function selectAlternative(questionId: number, alternativeId: number) {
    setAnswers((prev) => {
      const current = prev[questionId] ?? { selectedAlternativeId: null, timeSpentSec: 0 };
      return {
        ...prev,
        [questionId]: {
          ...current,
          selectedAlternativeId: alternativeId,
        },
      };
    });
  }

  async function finishSimulado() {
    if (!runAt || questions.length === 0) return;

    updateQuestionTime(currentIndex);

    const payload = questions.map((question) => ({
      questionId: question.id,
      selectedAlternativeId: answers[question.id]?.selectedAlternativeId ?? null,
      timeSpentSec: answers[question.id]?.timeSpentSec ?? 0,
    }));

    await fetch("/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runAt, answers: payload }),
    });

    router.push(`/resultado?runAt=${runAt}`);
  }

  if (questions.length === 0) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Simulado UFPR ADS</CardTitle>
            <CardDescription>
              Escolha matérias, quantidade por matéria e tempo total. O sorteio é automático.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Matérias</Label>
              <div className="flex flex-wrap gap-2">
                {subjects.map((subject) => {
                  const selected = selectedSubjects.includes(subject);
                  return (
                    <button
                      key={subject}
                      type="button"
                      onClick={() => toggleSubject(subject)}
                      className={`rounded-full border px-3 py-1 text-sm transition ${
                        selected
                          ? "border-emerald-400 bg-emerald-100 text-emerald-900"
                          : "border-zinc-300 bg-white hover:bg-zinc-100"
                      }`}
                    >
                      {formatSubjectLabel(subject)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="perSubject">Questões por matéria</Label>
                <Input
                  id="perSubject"
                  type="number"
                  min={1}
                  max={20}
                  value={perSubject}
                  onChange={(e) => setPerSubject(Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="durationMin">Tempo total (minutos)</Label>
                <Input
                  id="durationMin"
                  type="number"
                  min={10}
                  max={300}
                  value={durationMin}
                  onChange={(e) => setDurationMin(Number(e.target.value))}
                />
              </div>
            </div>

            <Button onClick={startSimulado} disabled={loading || selectedSubjects.length === 0}>
              <Play className="mr-2 h-4 w-4" />
              {loading ? "Montando simulado..." : "Iniciar simulado"}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="mb-4 grid gap-4 md:grid-cols-[1fr_auto]">
        <Card>
          <CardContent className="pt-4">
            <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Questão {currentIndex + 1} de {questions.length}
              </span>
              <span>{Math.round(progressValue)}% respondido</span>
            </div>
            <Progress value={progressValue} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-2 pt-4 text-lg font-semibold">
            <Timer className="h-5 w-5 text-amber-600" />
            {formatClock(remainingSec)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{formatSubjectLabel(currentQuestion.subject)}</Badge>
            {currentQuestion.topic ? <Badge variant="outline">{currentQuestion.topic}</Badge> : null}
            {currentQuestion.bundleId ? <Badge variant="outline">Bundle: {currentQuestion.bundleId}</Badge> : null}
          </div>
          {currentQuestion.bundleContext ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <p className="font-semibold">{currentQuestion.bundleTitle || "Texto-base"}</p>
              <p className="mt-1 whitespace-pre-wrap">{currentQuestion.bundleContext}</p>
            </div>
          ) : null}
          <CardTitle className="text-xl leading-7">{currentQuestion.statement}</CardTitle>
          {currentQuestion.source ? (
            <CardDescription>Fonte: {currentQuestion.source}</CardDescription>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-2">
          {currentQuestion.imageUrl ? (
            <div className="overflow-hidden rounded-lg border bg-white p-2">
              <Image
                src={currentQuestion.imageUrl}
                alt="Imagem da questão"
                width={960}
                height={540}
                className="h-auto w-full rounded-md object-contain"
              />
            </div>
          ) : null}

          {currentQuestion.alternatives.map((alt) => {
            const selected = answers[currentQuestion.id]?.selectedAlternativeId === alt.id;
            return (
              <button
                key={alt.id}
                type="button"
                onClick={() => selectAlternative(currentQuestion.id, alt.id)}
                className={`block w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                  selected
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-zinc-200 bg-white hover:bg-zinc-50"
                }`}
              >
                <span className="mr-2 font-semibold">{alt.label})</span>
                {alt.text}
              </button>
            );
          })}
        </CardContent>
      </Card>

      <div className="mt-4 flex flex-wrap justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => goToQuestion(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Anterior
        </Button>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => goToQuestion(Math.min(questions.length - 1, currentIndex + 1))}
            disabled={currentIndex >= questions.length - 1}
          >
            Próxima
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <Button type="button" onClick={finishSimulado}>
            <Send className="mr-2 h-4 w-4" />
            Finalizar
          </Button>
        </div>
      </div>
    </main>
  );
}
