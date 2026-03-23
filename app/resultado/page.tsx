import { Suspense } from "react";
import { ResultadoClient } from "@/components/resultado/resultado-client";

export default function ResultadoPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-4xl px-4 py-10">Carregando...</div>}>
      <ResultadoClient />
    </Suspense>
  );
}
