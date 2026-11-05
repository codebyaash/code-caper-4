import type { GuessResult } from "./engine";

export type OnlinePlayerRole = "creator" | "opponent";
export type OnlineSessionStatus = "waiting" | "setting-secret" | "guessing" | "won" | "lost";

export type OnlineSessionSnapshot = {
  roomCode: string;
  status: OnlineSessionStatus;
  yourRole: OnlinePlayerRole;
  turnNumber: number;
  attemptsRemaining: number;
  guesses: GuessResult[];
  winner?: OnlinePlayerRole;
};

export type OnlineSession = {
  getSnapshot(): OnlineSessionSnapshot;
  setSecret(secret: string): Promise<OnlineSessionSnapshot>;
  submitGuess(guess: string): Promise<OnlineSessionSnapshot>;
  subscribe(listener: (snapshot: OnlineSessionSnapshot) => void): () => void;
  leave(): Promise<void>;
};

export type OnlineGameAdapter = {
  createRoom(): Promise<OnlineSession>;
  joinRoom(roomCode: string): Promise<OnlineSession>;
  reconnect(roomCode: string): Promise<OnlineSession>;
};
