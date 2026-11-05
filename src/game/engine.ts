export type Mark = "exact" | "misplaced" | "miss";
export type GuessResult = { guess: string; marks: Mark[] };
export function createSecret(): string { return Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join(""); }
export function scoreGuess(secret: string, guess: string): Mark[] {
 const marks: Mark[] = Array(4).fill("miss"); const remaining = new Map<string, number>();
 for (let i=0;i<4;i++) { if (secret[i]===guess[i]) marks[i]="exact"; else remaining.set(secret[i],(remaining.get(secret[i])??0)+1); }
 for (let i=0;i<4;i++) { if (marks[i]==="exact") continue; const count=remaining.get(guess[i])??0; if (count>0) { marks[i]="misplaced"; remaining.set(guess[i],count-1); } }
 return marks;
}
export function isWinningGuess(marks: Mark[]): boolean { return marks.every(mark=>mark==="exact"); }
