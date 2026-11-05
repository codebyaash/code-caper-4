import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createOnlineGameService, type OnlineGameRecord, type OnlineGameStore } from "./online-service.ts";

class MemoryStore implements OnlineGameStore {
  private records = new Map<string, OnlineGameRecord>();

  async get(roomCode: string) {
    const record = this.records.get(roomCode);
    return record ? structuredClone(record) : undefined;
  }

  async create(record: OnlineGameRecord) {
    this.records.set(record.roomCode, structuredClone(record));
  }

  async compareAndSwap(record: OnlineGameRecord, expectedRevision: number) {
    const current = this.records.get(record.roomCode);
    if (!current || current.revision !== expectedRevision) return false;
    this.records.set(record.roomCode, structuredClone(record));
    return true;
  }
}

async function createTwoPlayerRoom() {
  const service = createOnlineGameService(new MemoryStore());
  const creator = await service.createRoom();
  const opponent = await service.joinRoom(creator.snapshot.roomCode);
  return { service, creator, opponent };
}

describe("online session service", () => {
  it("keeps the secret out of snapshots and awards the correct winner", async () => {
    const { service, creator, opponent } = await createTwoPlayerRoom();
    await service.setSecret(creator.snapshot.roomCode, creator.participantToken, "1122");
    const result = await service.submitGuess(creator.snapshot.roomCode, opponent.participantToken, "1122");
    assert.equal(result.status, "won");
    assert.equal(result.winner, "opponent");
    assert.equal("secret" in result, false);
  });

  it("awards the code setter the win after eight missed guesses", async () => {
    const { service, creator, opponent } = await createTwoPlayerRoom();
    await service.setSecret(creator.snapshot.roomCode, creator.participantToken, "1234");
    let result = await service.reconnect(creator.snapshot.roomCode, opponent.participantToken);
    for (let attempt = 0; attempt < 8; attempt++) {
      result = await service.submitGuess(creator.snapshot.roomCode, opponent.participantToken, "0000");
    }
    assert.equal(result.status, "lost");
    assert.equal(result.winner, "creator");
    assert.equal(result.attemptsRemaining, 0);
  });

  it("rejects invalid secrets and guesses", async () => {
    const { service, creator, opponent } = await createTwoPlayerRoom();
    await assert.rejects(service.setSecret(creator.snapshot.roomCode, creator.participantToken, "123"), { code: "INVALID_SECRET" });
    await service.setSecret(creator.snapshot.roomCode, creator.participantToken, "1234");
    await assert.rejects(service.submitGuess(creator.snapshot.roomCode, opponent.participantToken, "12x4"), { code: "INVALID_GUESS" });
  });

  it("allows only one opponent to claim a waiting room", async () => {
    const service = createOnlineGameService(new MemoryStore());
    const creator = await service.createRoom();
    const joins = await Promise.allSettled([
      service.joinRoom(creator.snapshot.roomCode),
      service.joinRoom(creator.snapshot.roomCode),
    ]);
    assert.equal(joins.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(joins.filter((result) => result.status === "rejected").length, 1);
  });

  it("rejects guesses from the code setter", async () => {
    const { service, creator } = await createTwoPlayerRoom();
    await service.setSecret(creator.snapshot.roomCode, creator.participantToken, "1234");
    await assert.rejects(service.submitGuess(creator.snapshot.roomCode, creator.participantToken, "1234"), { code: "INVALID_STATE" });
  });
});
