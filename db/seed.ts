import { db } from "./index";
import { alternatives, questions } from "./schema";

type SeedQuestion = {
  subject: string;
  topic: string;
  statement: string;
  source: string;
  difficulty: number;
  alternatives: Array<{ label: "A" | "B" | "C" | "D" | "E"; text: string; isCorrect: boolean }>;
};

const seedQuestions: SeedQuestion[] = [
  {
    subject: "Matematica",
    topic: "Funções",
    statement: "Se f(x)=2x+3, qual o valor de f(7)?",
    source: "UFPR - adaptada",
    difficulty: 1,
    alternatives: [
      { label: "A", text: "14", isCorrect: false },
      { label: "B", text: "17", isCorrect: true },
      { label: "C", text: "10", isCorrect: false },
      { label: "D", text: "21", isCorrect: false },
      { label: "E", text: "7", isCorrect: false },
    ],
  },
  {
    subject: "Matematica",
    topic: "Porcentagem",
    statement: "Um produto de R$ 200 recebeu desconto de 15%. Qual o novo valor?",
    source: "UFPR - adaptada",
    difficulty: 2,
    alternatives: [
      { label: "A", text: "R$ 160", isCorrect: false },
      { label: "B", text: "R$ 170", isCorrect: true },
      { label: "C", text: "R$ 180", isCorrect: false },
      { label: "D", text: "R$ 185", isCorrect: false },
      { label: "E", text: "R$ 150", isCorrect: false },
    ],
  },
  {
    subject: "Portugues",
    topic: "Interpretação de texto",
    statement: "Em um texto argumentativo, a tese corresponde a:",
    source: "UFPR - adaptada",
    difficulty: 2,
    alternatives: [
      { label: "A", text: "Conclusão secundária", isCorrect: false },
      { label: "B", text: "Ideia principal defendida", isCorrect: true },
      { label: "C", text: "Exemplo ilustrativo", isCorrect: false },
      { label: "D", text: "Título do texto", isCorrect: false },
      { label: "E", text: "Referências bibliográficas", isCorrect: false },
    ],
  },
  {
    subject: "Portugues",
    topic: "Pontuação",
    statement: "Assinale a frase com uso correto da vírgula:",
    source: "UFPR - adaptada",
    difficulty: 2,
    alternatives: [
      { label: "A", text: "Os alunos que estudam passam.", isCorrect: true },
      { label: "B", text: "Os alunos, que estudam passam.", isCorrect: false },
      { label: "C", text: "Os alunos que, estudam passam.", isCorrect: false },
      { label: "D", text: "Os alunos que estudam, passam,", isCorrect: false },
      { label: "E", text: "Os, alunos que estudam passam.", isCorrect: false },
    ],
  },
  {
    subject: "Ingles",
    topic: "Reading comprehension",
    statement: "The word 'however' indicates:",
    source: "UFPR - adaptada",
    difficulty: 1,
    alternatives: [
      { label: "A", text: "Addition", isCorrect: false },
      { label: "B", text: "Contrast", isCorrect: true },
      { label: "C", text: "Cause", isCorrect: false },
      { label: "D", text: "Time", isCorrect: false },
      { label: "E", text: "Condition", isCorrect: false },
    ],
  },
  {
    subject: "Ingles",
    topic: "Grammar",
    statement: "Choose the correct sentence:",
    source: "UFPR - adaptada",
    difficulty: 2,
    alternatives: [
      { label: "A", text: "She don't like coffee.", isCorrect: false },
      { label: "B", text: "She doesn't likes coffee.", isCorrect: false },
      { label: "C", text: "She doesn't like coffee.", isCorrect: true },
      { label: "D", text: "She not like coffee.", isCorrect: false },
      { label: "E", text: "She do not likes coffee.", isCorrect: false },
    ],
  },
  {
    subject: "Fisica",
    topic: "Cinemática",
    statement: "Um carro percorre 120 km em 2 horas. Sua velocidade média é:",
    source: "UFPR - adaptada",
    difficulty: 1,
    alternatives: [
      { label: "A", text: "40 km/h", isCorrect: false },
      { label: "B", text: "50 km/h", isCorrect: false },
      { label: "C", text: "60 km/h", isCorrect: true },
      { label: "D", text: "70 km/h", isCorrect: false },
      { label: "E", text: "80 km/h", isCorrect: false },
    ],
  },
  {
    subject: "Quimica",
    topic: "Tabela periódica",
    statement: "O elemento de símbolo Na é:",
    source: "UFPR - adaptada",
    difficulty: 1,
    alternatives: [
      { label: "A", text: "Nitrogênio", isCorrect: false },
      { label: "B", text: "Sódio", isCorrect: true },
      { label: "C", text: "Neon", isCorrect: false },
      { label: "D", text: "Nióbio", isCorrect: false },
      { label: "E", text: "Níquel", isCorrect: false },
    ],
  },
  {
    subject: "Biologia",
    topic: "Citologia",
    statement: "A organela responsável pela respiração celular é:",
    source: "UFPR - adaptada",
    difficulty: 1,
    alternatives: [
      { label: "A", text: "Lisossomo", isCorrect: false },
      { label: "B", text: "Ribossomo", isCorrect: false },
      { label: "C", text: "Mitocôndria", isCorrect: true },
      { label: "D", text: "Complexo de Golgi", isCorrect: false },
      { label: "E", text: "Núcleo", isCorrect: false },
    ],
  },
  {
    subject: "Historia",
    topic: "Brasil República",
    statement: "A Proclamação da República no Brasil ocorreu em:",
    source: "UFPR - adaptada",
    difficulty: 1,
    alternatives: [
      { label: "A", text: "1822", isCorrect: false },
      { label: "B", text: "1888", isCorrect: false },
      { label: "C", text: "1889", isCorrect: true },
      { label: "D", text: "1930", isCorrect: false },
      { label: "E", text: "1964", isCorrect: false },
    ],
  },
];

async function main() {
  const existing = await db.select().from(questions).limit(1);
  if (existing.length > 0) {
    console.log("Seed já executado. Pulando inserção.");
    return;
  }

  for (const entry of seedQuestions) {
    const result = await db
      .insert(questions)
      .values({
        subject: entry.subject,
        topic: entry.topic,
        statement: entry.statement,
        source: entry.source,
        difficulty: entry.difficulty,
      })
      .returning({ id: questions.id });

    const questionId = result[0].id;

    await db.insert(alternatives).values(
      entry.alternatives.map((alt) => ({
        questionId,
        label: alt.label,
        text: alt.text,
        isCorrect: alt.isCorrect,
      })),
    );
  }

  console.log(`Seed concluído com ${seedQuestions.length} questões.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
