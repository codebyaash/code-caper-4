import { randomInt, randomUUID } from "node:crypto";
import { isWinningGuess, scoreGuess } from "./engine.ts";
import type { OnlineGuess, OnlinePlayerRole, OnlineSessionSnapshot } from "./online-session";

export type OnlineGameRecord = {
  roomCode: string;
  revision: number;
  status: OnlineSessionSnapshot["status"];
  turnNumber: number;
  creatorAttemptsRemaining: number;
  opponentAttemptsRemaining: number;
  guesses: OnlineGuess[];
  activePlayer?: OnlinePlayerRole;
  winner?: OnlinePlayerRole;
  creatorSecret?: string;
  opponentSecret?: string;
  creatorToken: string;
  opponentToken?: string;
};

export type OnlineGameStore = {
  get(roomCode: string): Promise<OnlineGameRecord | undefined>;
  create(record: OnlineGameRecord): Promise<void>;
  compareAndSwap(record: OnlineGameRecord, expectedRevision: number): Promise<boolean>;
};

export type OnlineSessionAccess = {
  snapshot: OnlineSessionSnapshot;
  participantToken: string;
};

export class OnlineGameError extends Error {
  readonly code: "ROOM_NOT_FOUND" | "ROOM_FULL" | "INVALID_STATE" | "INVALID_SECRET" | "INVALID_GUESS" | "UNAUTHORIZED";

  constructor(code: OnlineGameError["code"]) {
    super(code);
    this.name = "OnlineGameError";
    this.code = code;
  }
}

function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join("");
}

function toSnapshot(record: OnlineGameRecord, role: OnlinePlayerRole): OnlineSessionSnapshot {
  const finished = record.status === "won" || record.status === "lost" || record.status === "draw";
  return {
    roomCode: record.roomCode,
    status: record.status,
    yourRole: role,
    yourSecretSet: role === "creator" ? Boolean(record.creatorSecret) : Boolean(record.opponentSecret),
    otherSecretSet: role === "creator" ? Boolean(record.opponentSecret) : Boolean(record.creatorSecret),
    activePlayer: record.activePlayer,
    turnNumber: record.turnNumber,
    attemptsRemaining: role === "creator" ? record.creatorAttemptsRemaining : record.opponentAttemptsRemaining,
    guesses: record.guesses,
    winner: record.winner,
    revealedSecrets: finished ? { creator: record.creatorSecret, opponent: record.opponentSecret } : undefined,
  };
}

export function createOnlineGameService(store: OnlineGameStore) {
  async function saveNextRevision(record: OnlineGameRecord): Promise<void> {
    const expectedRevision = record.revision;
    const updated = { ...record, revision: expectedRevision + 1 };
    if (!await store.compareAndSwap(updated, expectedRevision)) throw new OnlineGameError("INVALID_STATE");
    record.revision = updated.revision;
  }

  async function authorizedRecord(roomCode: string, participantToken: string) {
    const stored = await store.get(roomCode);
    if (!stored) throw new OnlineGameError("ROOM_NOT_FOUND");
    const record = structuredClone(stored);
    const role: OnlinePlayerRole | undefined = participantToken === record.creatorToken
      ? "creator"
      : participantToken === record.opponentToken ? "opponent" : undefined;
    if (!role) throw new OnlineGameError("UNAUTHORIZED");
    return { record, role };
  }

  return {
    async createRoom(): Promise<OnlineSessionAccess> {
      let roomCode = makeRoomCode();
      while (await store.get(roomCode)) roomCode = makeRoomCode();
      const record: OnlineGameRecord = {
        roomCode,
        revision: 0,
        status: "waiting",
        turnNumber: 1,
        creatorAttemptsRemaining: 8,
        opponentAttemptsRemaining: 8,
        guesses: [],
        creatorToken: randomUUID(),
      };
      await store.create(record);
      return { snapshot: toSnapshot(record, "creator"), participantToken: record.creatorToken };
    },

    async joinRoom(roomCode: string): Promise<OnlineSessionAccess> {
      const stored = await store.get(roomCode);
      if (!stored) throw new OnlineGameError("ROOM_NOT_FOUND");
      const record = structuredClone(stored);
      if (record.status !== "waiting") throw new OnlineGameError("ROOM_FULL");
      record.opponentToken = randomUUID();
      record.status = "setting-secrets";
      if (!await store.compareAndSwap({ ...record, revision: record.revision + 1 }, record.revision)) throw new OnlineGameError("ROOM_FULL");
      record.revision += 1;
      return { snapshot: toSnapshot(record, "opponent"), participantToken: record.opponentToken };
    },

    async reconnect(roomCode: string, participantToken: string): Promise<OnlineSessionSnapshot> {
      const { record, role } = await authorizedRecord(roomCode, participantToken);
      return toSnapshot(record, role);
    },

    async setSecret(roomCode: string, participantToken: string, secret: string): Promise<OnlineSessionSnapshot> {
      const { record, role } = await authorizedRecord(roomCode, participantToken);
      if (record.status !== "setting-secrets") throw new OnlineGameError("INVALID_STATE");
      if (!/^\d{4}$/.test(secret)) throw new OnlineGameError("INVALID_SECRET");
      if (role === "creator") {
        if (record.creatorSecret) throw new OnlineGameError("INVALID_STATE");
        record.creatorSecret = secret;
      } else {
        if (record.opponentSecret) throw new OnlineGameError("INVALID_STATE");
        record.opponentSecret = secret;
      }
      if (record.creatorSecret && record.opponentSecret) {
        record.status = "guessing";
        record.activePlayer = "creator";
      }
      await saveNextRevision(record);
      return toSnapshot(record, role);
    },

    async submitGuess(roomCode: string, participantToken: string, guess: string): Promise<OnlineSessionSnapshot> {
      const { record, role } = await authorizedRecord(roomCode, participantToken);
      if (record.status !== "guessing" || record.activePlayer !== role || !record.creatorSecret || !record.opponentSecret) throw new OnlineGameError("INVALID_STATE");
      if (!/^\d{4}$/.test(guess)) throw new OnlineGameError("INVALID_GUESS");
      const targetSecret = role === "creator" ? record.opponentSecret : record.creatorSecret;
      const marks = scoreGuess(targetSecret, guess);
      record.guesses = [...record.guesses, { guess, marks, player: role }];
      if (role === "creator") record.creatorAttemptsRemaining -= 1;
      else record.opponentAttemptsRemaining -= 1;
      if (isWinningGuess(marks)) {
        record.status = "won";
        record.winner = role;
      } else if (record.creatorAttemptsRemaining === 0 && record.opponentAttemptsRemaining === 0) {
        record.status = "draw";
      } else {
        record.activePlayer = role === "creator" ? "opponent" : "creator";
        record.turnNumber += 1;
      }
      await saveNextRevision(record);
      return toSnapshot(record, role);
    },
  };
}
