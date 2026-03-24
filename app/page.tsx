import Link from "next/link";
import { ArrowRight, BrainCircuit, ClipboardCheck, LineChart, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10">
      <section className="rounded-2xl border border-orange-200 bg-white/90 p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-orange-700">Vestibular UFPR</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-900">Painel de Estudos ADS</h1>
        <p className="mt-3 max-w-2xl text-zinc-700">
          Monte simulados com sorteio por matéria, acompanhe seu desempenho e gere um plano semanal
          personalizado com IA em streaming.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="h-5 w-5 text-emerald-700" /> Simulado
            </CardTitle>
            <CardDescription>Timer, navegação por questão e envio de tentativas.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/simulado" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800">
              Abrir simulador <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <LineChart className="h-5 w-5 text-blue-700" /> Resultado
            </CardTitle>
            <CardDescription>Percentual por matéria e histórico de tentativas.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/resultado" className="inline-flex items-center gap-2 text-sm font-medium text-blue-800">
              Ver resultados <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BrainCircuit className="h-5 w-5 text-violet-700" /> Cronograma IA
            </CardTitle>
            <CardDescription>Plano semanal em streaming com gpt-4o-mini.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/cronograma" className="inline-flex items-center gap-2 text-sm font-medium text-violet-800">
              Gerar cronograma <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-amber-700" /> Admin
            </CardTitle>
            <CardDescription>Cadastro manual de questões e alternativas A-E.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-medium text-amber-800">
              Gerenciar banco <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
