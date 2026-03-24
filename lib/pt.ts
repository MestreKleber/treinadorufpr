const SUBJECT_LABELS: Record<string, string> = {
  Matematica: "Matemática",
  Portugues: "Português",
  Ingles: "Inglês",
  Fisica: "Física",
  Quimica: "Química",
  Biologia: "Biologia",
  Historia: "História",
  Geografia: "Geografia",
  Filosofia: "Filosofia",
  Sociologia: "Sociologia",
};

export function formatSubjectLabel(subject: string) {
  return SUBJECT_LABELS[subject] ?? subject;
}
