import wordList from "./dictionary.json";

let wordSet: Set<string> | null = null;

function getSet(): Set<string> {
  if (!wordSet) wordSet = new Set(wordList as string[]);
  return wordSet;
}

export function isValidWord(word: string): boolean {
  return getSet().has(word.toUpperCase());
}

export function validateWords(words: string[]): { valid: boolean; invalid: string[] } {
  const invalid = words.filter(w => !isValidWord(w));
  return { valid: invalid.length === 0, invalid };
}