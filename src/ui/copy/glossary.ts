export type GlossaryId =
  | "missScore"
  | "bestMove"
  | "recordedAi"
  | "factsPrompt"
  | "freeText"
  | "energy"
  | "defense"
  | "seed"
  | "smallSample"
  | "modelReason";

export type GlossaryEntry = {
  id: GlossaryId;
  term: string;
  short: string;
  long: string;
};

export const GLOSSARY: Record<GlossaryId, GlossaryEntry> = {
  missScore: {
    id: "missScore",
    term: "Points vs best",
    short: "How many points worse than the best move in this situation",
    long: "Beat the AI only; measured against a fixed player plan—not a whole-game claim."
  },
  bestMove: {
    id: "bestMove",
    term: "Best move",
    short: "Highest-scoring legal move in that situation",
    long: "Beat the AI only; free play has no best-move judge."
  },
  recordedAi: {
    id: "recordedAi",
    term: "Recorded AI",
    short: "A saved answer from an earlier run",
    long: "Not a live model call in your browser."
  },
  factsPrompt: {
    id: "factsPrompt",
    term: "With facts",
    short: "Prompt that included engine-stated facts",
    long: "Compared to the basic prompt on the same situations."
  },
  freeText: {
    id: "freeText",
    term: "Free-text",
    short: "Prompt that asked for freer wording",
    long: "Same decision task; different instructions."
  },
  energy: {
    id: "energy",
    term: "Energy",
    short: "Resource spent to use a move",
    long: "If you cannot pay, the fight may switch to a safe stabilize."
  },
  defense: {
    id: "defense",
    term: "Defense",
    short: "Softens incoming hits",
    long: "Raised by defense moves such as Null Pulse."
  },
  seed: {
    id: "seed",
    term: "Replay code",
    short: "Number/text that locks randomness",
    long: "Same replay code and robots → same fight."
  },
  smallSample: {
    id: "smallSample",
    term: "Small sample",
    short: "Not enough situations to rank models",
    long: "We say we cannot rank instead of guessing."
  },
  modelReason: {
    id: "modelReason",
    term: "What the AI wrote",
    short: "Text the model produced as its reason",
    long: "Not proof of inner thinking."
  }
};

export const GLOSSARY_IDS = Object.keys(GLOSSARY) as GlossaryId[];
