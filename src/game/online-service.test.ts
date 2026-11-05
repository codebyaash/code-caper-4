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

type Service = ReturnType<typeof createOnlineGameService>;
type SessionAccess = Awaited<ReturnType<Service["createRoom"]>>;

async function setBothSecrets(service: Service, creator: SessionAccess, opponent: SessionAccess, creatorSecret = "1122", opponentSecret = "3344") {
  const creatorSetup = await service.setSecret(creator.snapshot.roomCode, creator.participantToken, creatorSecret);
  assert.equal(creatorSetup.status, "setting-secrets");
  assert.equal(creatorSetup.otherSecretSet, false);
  assert.equal(creatorSetup.revealedSecrets, undefined);
  const opponentSetup = await service.setSecret(creator.snapshot.roomCode, opponent.participantToken, opponentSecret);
  assert.equal(opponentSetup.status, "guessing");
  assert.equal(opponentSetup.activePlayer, "creator");
}

describe("online session service", () => {
  it("requires both secrets before starting and keeps each secret private", async () => {
    const { service, creator, opponent } = await createTwoPlayerRoom();
    await setBothSecrets(service, creator, opponent);
    const creatorView = await service.reconnect(creator.snapshot.roomCode, creator.participantToken);
    const opponentView = await service.reconnect(creator.snapshot.roomCode, opponent.participantToken);
    assert.equal(creatorView.yourSecretSet, true);
    assert.equal(creatorView.otherSecretSet, true);
    assert.equal(opponentView.yourSecretSet, true);
    assert.equal("creatorSecret" in creatorView, false);
  });

  it("alternates turns and awards the win to the player who cracks the other code", async () => {
    const { service, creator, opponent } = await createTwoPlayerRoom();
    await setBothSecrets(service, creator, opponent, "1122", "3344");
    const firstTurn = await service.submitGuess(creator.snapshot.roomCode, creator.participantToken, "0000");
    assert.equal(firstTurn.activePlayer, "opponent");
    await assert.rejects(service.submitGuess(creator.snapshot.roomCode, creator.participantToken, "3344"), { code: "INVALID_STATE" });
    const winningTurn = await service.submitGuess(creator.snapshot.roomCode, opponent.participantToken, "1122");
    assert.equal(winningTurn.status, "won");
    assert.equal(winningTurn.winner, "opponent");
    assert.equal(winningTurn.revealedSecrets?.creator, "1122");
    assert.equal(winningTurn.revealedSecrets?.opponent, "3344");
  });

  it("ends in a draw after both players use all eight guesses", async () => {
    const { service, creator, opponent } = await createTwoPlayerRoom();
    await setBothSecrets(service, creator, opponent, "1234", "5678");
    let result = await service.reconnect(creator.snapshot.roomCode, creator.participantToken);
    for (let attempt = 0; attempt < 16; attempt++) {
      const role = attempt % 2 === 0 ? creator : opponent;
      result = await service.submitGuess(creator.snapshot.roomCode, role.participantToken, "0000");
    }
    assert.equal(result.status, "draw");
    assert.equal(result.attemptsRemaining, 0);
    assert.equal(result.winner, undefined);
  });

  it("rejects invalid secrets and guesses", async () => {
    const { service, creator, opponent } = await createTwoPlayerRoom();
    await assert.rejects(service.setSecret(creator.snapshot.roomCode, creator.participantToken, "123"), { code: "INVALID_SECRET" });
    await service.setSecret(creator.snapshot.roomCode, creator.participantToken, "1234");
    await service.setSecret(creator.snapshot.roomCode, opponent.participantToken, "5678");
    await assert.rejects(service.submitGuess(creator.snapshot.roomCode, creator.participantToken, "12x4"), { code: "INVALID_GUESS" });
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
});
