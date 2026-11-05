import type { OnlineGameAdapter, OnlineSession, OnlineSessionSnapshot } from "./online-session.ts";

type SessionResponse = { snapshot: OnlineSessionSnapshot; participantToken: string };
type Action = { action: string; [key: string]: string | number };

async function readResponse<T>(response: Response): Promise<T> {
  const body: unknown = await response.json();
  if (!response.ok) {
    const code = body && typeof body === "object" && "error" in body ? String(body.error) : "ONLINE_UNAVAILABLE";
    throw new Error(code);
  }
  return body as T;
}

export function createHttpOnlineGameAdapter(): OnlineGameAdapter {
  async function openSession(roomCode: string, participantToken: string, initial: OnlineSessionSnapshot): Promise<OnlineSession> {
    let snapshot = initial;
    let stopped = false;
    let requestQueue = Promise.resolve();
    let pollInProgress = false;
    const listeners = new Set<(value: OnlineSessionSnapshot) => void>();

    function update(next: OnlineSessionSnapshot) {
      snapshot = next;
      listeners.forEach((listener) => listener(snapshot));
    }

    async function perform(action: Action): Promise<OnlineSessionSnapshot> {
      const previousRequest = requestQueue;
      let releaseRequest = () => {};
      requestQueue = new Promise<void>((resolve) => { releaseRequest = resolve; });
      await previousRequest;
      try {
        const response = await fetch(`/api/online/rooms/${roomCode}`, {
          method: "POST",
          headers: { authorization: `Bearer ${participantToken}`, "content-type": "application/json" },
          body: JSON.stringify(action),
          cache: "no-store",
        });
        const next = await readResponse<OnlineSessionSnapshot>(response);
        update(next);
        return next;
      } finally {
        releaseRequest();
      }
    }

    const poll = window.setInterval(async () => {
      if (stopped || pollInProgress) return;
      pollInProgress = true;
      try { await perform({ action: "reconnect" }); } catch { }
      finally { pollInProgress = false; }
    }, 1800);

    return {
      participantToken,
      getSnapshot: () => snapshot,
      setSecret: (secret) => perform({ action: "set-secret", secret }),
      submitGuess: (guess) => perform({ action: "guess", guess }),
      requestRematch: () => perform({ action: "rematch" }),
      subscribe(listener) {
        listeners.add(listener);
        listener(snapshot);
        return () => listeners.delete(listener);
      },
      async leave() {
        stopped = true;
        window.clearInterval(poll);
        listeners.clear();
      },
    };
  }

  async function createOrJoin(action: "create" | "join", name: string, settings?: { secretLength: number; difficulty: string }, roomCode?: string): Promise<OnlineSession> {
    const response = await fetch("/api/online/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(roomCode ? { action, roomCode, name } : { action, name, ...settings }),
      cache: "no-store",
    });
    const result = await readResponse<SessionResponse>(response);
    return openSession(result.snapshot.roomCode, result.participantToken, result.snapshot);
  }

  return {
    createRoom: (name, secretLength, difficulty) => createOrJoin("create", name, { secretLength, difficulty }),
    joinRoom: (roomCode, name) => createOrJoin("join", name, undefined, roomCode.toUpperCase()),
    async reconnect(roomCode, participantToken) {
      const snapshot = await fetch(`/api/online/rooms/${roomCode}`, {
        method: "POST",
        headers: { authorization: `Bearer ${participantToken}`, "content-type": "application/json" },
        body: JSON.stringify({ action: "reconnect" }),
        cache: "no-store",
      }).then(readResponse<OnlineSessionSnapshot>);
      return openSession(roomCode, participantToken, snapshot);
    },
  };
}
