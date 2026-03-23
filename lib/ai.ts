import { openai } from "@ai-sdk/openai";

export const scheduleModel = openai("gpt-4o-mini");

export function buildSchedulePrompt(
  performance: Array<{ subject: string; percentage: number; total: number }>,
) {
  const summary = performance
    .map(
      (item) =>
        `- ${item.subject}: ${item.percentage.toFixed(1)}% de acerto em ${item.total} questoes`,
    )
    .join("\n");

  return `Voce e um tutor de vestibular UFPR para ADS.\nCrie um plano semanal de estudos em JSON com 7 dias.\nCada dia deve ter os blocos: manha, tarde e noite.\nCada bloco deve incluir: foco, atividades e duracaoMin.\nPriorize as materias com menor percentual e inclua revisao ativa + questoes.\nResponda apenas JSON valido no formato:\n{\n  "semana": [{"dia":"Segunda","manha":{...},"tarde":{...},"noite":{...}}],\n  "orientacoesGerais": ["..."]\n}\n\nDesempenho:\n${summary}`;
}
