"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BarChart3, History, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ResultResponse = {
  current: {
    runAt: number;
    total: number;
    correct: number;
    percentage: number;
    bySubject: Array<{ subject: string; total: number; correct: number; percentage: number }>;
  };
  history: Array<{ runAt: number; total: number; correct: number; percentage: number }>;
  details: Array<{ questionId: number; subject: string; statement: string; isCorrect: boolean | null }>;
};

export function ResultadoClient() {
  const searchParams = useSearchParams();
  const runAtParam = searchParams.get("runAt");
  const [data, setData] = useState<ResultResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const runAt = runAtParam ? Number(runAtParam) : 0;

  async function loadResult() {
    if (!runAt) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/resultado?runAt=${runAt}`);
      const payload: ResultResponse = await res.json();
      setData(payload);
    } finally {
      setLoading(false);
    }
  }

  const incorrectCount = useMemo(() => {
    if (!data) return 0;
    return data.current.total - data.current.correct;
  }, [data]);

  if (!runAt) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Resultado do Simulado</CardTitle>
            <CardDescription>
              Nenhum simulado informado. Finalize um simulado para ver os indicadores.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <BarChart3 className="h-5 w-5 text-emerald-600" />
            Resultado do Simulado
          </CardTitle>
          <CardDescription>
            Visualize seu percentual de acerto por materia e acompanhe o historico de tentativas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={loadResult} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            {loading ? "Atualizando..." : "Carregar resultado"}
          </Button>
        </CardContent>
      </Card>

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Acertos</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold">{data.current.correct}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Erros</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold">{incorrectCount}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Percentual Geral</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold">
                {data.current.percentage.toFixed(1)}%
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Desempenho por materia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.current.bySubject.map((item) => (
                <div key={item.subject} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.subject}</span>
                    <span>
                      {item.correct}/{item.total} ({item.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress value={item.percentage} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Historico de tentativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Acertos</TableHead>
                    <TableHead>Percentual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.history.map((item) => (
                    <TableRow key={item.runAt}>
                      <TableCell>{new Date(item.runAt).toLocaleString("pt-BR")}</TableCell>
                      <TableCell>{item.total}</TableCell>
                      <TableCell>{item.correct}</TableCell>
                      <TableCell>{item.percentage.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </main>
  );
}
