import type { Difficulty, GuessResult, SecretLength } from "./engine.ts";

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
  playerNames: Record<OnlinePlayerRole, string>;
  secretLength: SecretLength;
  difficulty: Difficulty;
  expiresAt: number;
  roundNumber: number;
  rematchRequested: boolean;
  otherRematchRequested: boolean;
  winner?: OnlinePlayerRole;
  revealedSecrets?: Partial<Record<OnlinePlayerRole, string>>;
};

export type OnlineSession = {
  participantToken: string;
  getSnapshot(): OnlineSessionSnapshot;
  setSecret(secret: string): Promise<OnlineSessionSnapshot>;
  submitGuess(guess: string): Promise<OnlineSessionSnapshot>;
  requestRematch(): Promise<OnlineSessionSnapshot>;
  subscribe(listener: (snapshot: OnlineSessionSnapshot) => void): () => void;
  leave(): Promise<void>;
};

export type OnlineGameAdapter = {
  createRoom(name: string, secretLength: SecretLength, difficulty: Difficulty): Promise<OnlineSession>;
  joinRoom(roomCode: string, name: string): Promise<OnlineSession>;
  reconnect(roomCode: string, participantToken: string): Promise<OnlineSession>;
};
