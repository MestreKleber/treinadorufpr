"use client";

import { useEffect, useState } from "react";
import { PlusCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type QuestionListItem = {
  id: number;
  subject: string;
  topic: string | null;
  statement: string;
  source: string | null;
  difficulty: number | null;
};

type AlternativeForm = {
  label: "A" | "B" | "C" | "D" | "E";
  text: string;
  isCorrect: boolean;
};

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
  const [source, setSource] = useState("UFPR - manual");
  const [difficulty, setDifficulty] = useState(2);
  const [alternatives, setAlternatives] = useState<AlternativeForm[]>(defaultAlternatives);
  const [saving, setSaving] = useState(false);

  async function loadQuestions() {
    const res = await fetch("/api/admin/questions");
    const data = (await res.json()) as { questions: QuestionListItem[] };
    setQuestions(data.questions ?? []);
  }

  useEffect(() => {
    void loadQuestions();
  }, []);

  function setAlternativeText(index: number, value: string) {
    setAlternatives((prev) => prev.map((item, i) => (i === index ? { ...item, text: value } : item)));
  }

  function setCorrect(label: AlternativeForm["label"]) {
    setAlternatives((prev) => prev.map((item) => ({ ...item, isCorrect: item.label === label })));
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
          source,
          difficulty,
          alternatives,
        }),
      });

      setTopic("");
      setStatement("");
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

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Admin de Questoes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="subject">Materia</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="topic">Topico</Label>
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
            {saving ? "Salvando..." : "Cadastrar questao"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Banco de questoes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Materia</TableHead>
                <TableHead>Topico</TableHead>
                <TableHead>Dificuldade</TableHead>
                <TableHead>Acao</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map((question) => (
                <TableRow key={question.id}>
                  <TableCell>{question.id}</TableCell>
                  <TableCell>{question.subject}</TableCell>
                  <TableCell>{question.topic ?? "-"}</TableCell>
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
