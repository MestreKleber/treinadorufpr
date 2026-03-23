export const UFPR_SUBJECTS = [
  "Matematica",
  "Portugues",
  "Ingles",
  "Fisica",
  "Quimica",
  "Biologia",
  "Historia",
  "Geografia",
  "Sociologia",
  "Filosofia",
] as const;

export type Subject = (typeof UFPR_SUBJECTS)[number];
