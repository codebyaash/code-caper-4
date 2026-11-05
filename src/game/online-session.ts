import type { GuessResult } from "./engine.ts";

export type OnlinePlayerRole = "creator" | "opponent";
export type OnlineSessionStatus = "waiting" | "setting-secrets" | "guessing" | "won" | "lost" | "draw";
export type OnlineGuess = GuessResult & { player: OnlinePlayerRole };

export type OnlineSessionSnapshot = {
  roomCode: string;
  status: OnlineSessionStatus;
  yourRole: OnlinePlayerRole;
  yourSecretSet: boolean;
  otherSecretSet: boolean;
  activePlayer?: OnlinePlayerRole;
  turnNumber: number;
  attemptsRemaining: number;
  guesses: OnlineGuess[];
  winner?: OnlinePlayerRole;
  revealedSecrets?: Partial<Record<OnlinePlayerRole, string>>;
};

export type OnlineSession = {
  participantToken: string;
  getSnapshot(): OnlineSessionSnapshot;
  setSecret(secret: string): Promise<OnlineSessionSnapshot>;
  submitGuess(guess: string): Promise<OnlineSessionSnapshot>;
  subscribe(listener: (snapshot: OnlineSessionSnapshot) => void): () => void;
  leave(): Promise<void>;
};

export type OnlineGameAdapter = {
  createRoom(): Promise<OnlineSession>;
  joinRoom(roomCode: string): Promise<OnlineSession>;
  reconnect(roomCode: string, participantToken: string): Promise<OnlineSession>;
};
