export type AlternativeDTO = {
  id: number;
  label: string | null;
  text: string;
};

export type QuestionDTO = {
  id: number;
  subject: string;
  topic: string | null;
  bundleId: string | null;
  bundleTitle: string | null;
  bundleContext: string | null;
  statement: string;
  source: string | null;
  difficulty: number | null;
  imageUrl: string | null;
  alternatives: AlternativeDTO[];
};

export type PerformanceBySubject = {
  subject: string;
  total: number;
  correct: number;
  percentage: number;
};

export type SimuladoSubmissionItem = {
  questionId: number;
  selectedAlternativeId: number | null;
  timeSpentSec: number;
};
