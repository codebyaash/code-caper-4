export type Mark = "exact" | "misplaced" | "miss";
export type GuessResult = { guess: string; marks: Mark[] };

export type SecretLength = 4 | 5;
export type Difficulty = "classic" | "medium" | "mystery";

export function isValidCode(value: string, length: SecretLength): boolean {
  return new RegExp(`^\\d{${length}}$`).test(value);
}

export function createSecret(length: SecretLength = 4): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
}

export function scoreGuess(secret: string, guess: string): Mark[] {
  if (secret.length !== guess.length) throw new Error("Secret and guess must have the same length.");
  const marks: Mark[] = Array(secret.length).fill("miss");
  const remaining = new Map<string, number>();
  for (let index = 0; index < secret.length; index++) {
    if (secret[index] === guess[index]) marks[index] = "exact";
    else remaining.set(secret[index], (remaining.get(secret[index]) ?? 0) + 1);
  }
  for (let index = 0; index < guess.length; index++) {
    if (marks[index] === "exact") continue;
    const count = remaining.get(guess[index]) ?? 0;
    if (count > 0) {
      marks[index] = "misplaced";
      remaining.set(guess[index], count - 1);
    }
  }
  return marks;
}

export function isWinningGuess(marks: Mark[]): boolean {
  return marks.every((mark) => mark === "exact");
}

export function countGuessMatches(marks: Mark[]): { correctDigits: number; correctPositions: number } {
  return {
    correctDigits: marks.filter((mark) => mark !== "miss").length,
    correctPositions: marks.filter((mark) => mark === "exact").length,
  };
}
