"use client";

import { useEffect, useMemo, useState } from "react";
import { createHttpOnlineGameAdapter } from "@/game/http-online-adapter";
import type { OnlineSession, OnlineSessionSnapshot } from "@/game/online-session";

type SavedSession = { roomCode: string; participantToken: string };
const savedSessionKey = "code-caper:online-session:v1";

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "The online game couldn’t connect. Try again.";
  if (error.message === "ONLINE_UNAVAILABLE") return "Online rooms need Redis credentials in .env.local before they can be used.";
  if (error.message === "ROOM_NOT_FOUND") return "That room code wasn’t found or has expired.";
  if (error.message === "ROOM_FULL") return "That room already has two players.";
  if (error.message === "UNAUTHORIZED") return "This session expired. Start or join a room again.";
  return "The online game couldn’t connect. Try again.";
}

export default function OnlinePlay({ onExit }: { onExit: () => void }) {
  const [session, setSession] = useState<OnlineSession | null>(null);
  const [snapshot, setSnapshot] = useState<OnlineSessionSnapshot | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [secret, setSecret] = useState("");
  const [guess, setGuess] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const adapter = useMemo(() => createHttpOnlineGameAdapter(), []);

  useEffect(() => {
    let cancelled = false;
    let activeSession: OnlineSession | null = null;
    let unsubscribe: (() => void) | null = null;
    try {
      const saved = sessionStorage.getItem(savedSessionKey);
        const credentials: SavedSession | null = saved ? JSON.parse(saved) as SavedSession : null;
      if (!credentials?.roomCode || !credentials.participantToken) return;
      void adapter.reconnect(credentials.roomCode, credentials.participantToken).then((restored) => {
        if (cancelled) { void restored.leave(); return; }
        activeSession = restored;
        setSession(restored);
        setSnapshot(restored.getSnapshot());
        unsubscribe = restored.subscribe(setSnapshot);
      }).catch(() => sessionStorage.removeItem(savedSessionKey));
    } catch {
      sessionStorage.removeItem(savedSessionKey);
    }
    return () => { cancelled = true; unsubscribe?.(); void activeSession?.leave(); };
  }, [adapter]);

  async function run(action: () => Promise<OnlineSession | OnlineSessionSnapshot>) {
    setBusy(true); setError("");
    try {
      const result = await action();
      if ("getSnapshot" in result) {
        setSession(result);
        setSnapshot(result.getSnapshot());
        sessionStorage.setItem(savedSessionKey, JSON.stringify({ roomCode: result.getSnapshot().roomCode, participantToken: result.participantToken }));
        result.subscribe(setSnapshot);
      } else setSnapshot(result);
      return result;
    } catch (caught) {
      setError(errorMessage(caught));
      return null;
    } finally { setBusy(false); }
  }

  async function createRoom() {
    const created = await run(() => adapter.createRoom());
    if (created && "getSnapshot" in created) {
      sessionStorage.setItem(savedSessionKey, JSON.stringify({ roomCode: created.getSnapshot().roomCode, participantToken: created.participantToken }));
    }
  }

  async function joinRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const joined = await run(() => adapter.joinRoom(roomCodeInput.trim()));
    if (joined && "getSnapshot" in joined) {
      sessionStorage.setItem(savedSessionKey, JSON.stringify({ roomCode: joined.getSnapshot().roomCode, participantToken: joined.participantToken }));
    }
  }

  async function submitSecret(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4}$/.test(secret)) { setError("Enter exactly four digits."); return; }
    if (session && await run(() => session.setSecret(secret))) setSecret("");
  }

  async function submitGuess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4}$/.test(guess)) { setError("Enter exactly four digits."); return; }
    if (session && await run(() => session.submitGuess(guess))) setGuess("");
  }

  async function exitOnline() {
    await session?.leave();
    sessionStorage.removeItem(savedSessionKey);
    onExit();
  }

  const creator = snapshot?.yourRole === "creator";
  const finished = snapshot?.status === "won" || snapshot?.status === "lost";
  const won = snapshot?.winner === snapshot?.yourRole;

  return <main className="online-shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-icon">✳</span> code caper</a><span className="edition">ONLINE CHALLENGE</span><button className="help" onClick={exitOnline}>×</button></header>
    <section className="online-card">
      <p className="panel-kicker">TWO PLAYERS · TWO DEVICES</p>
      <h1>{!snapshot ? "Bring a friend into the game." : finished ? won ? "A lovely bit of codebreaking." : "The code held its ground." : snapshot.status === "waiting" ? "Your room is ready." : snapshot.status === "setting-secret" && creator ? "Set the secret code." : snapshot.status === "setting-secret" ? "Waiting for the code." : snapshot.status === "guessing" && creator ? "Your code is being cracked." : "Crack the code."}</h1>
      {!snapshot ? <div className="online-lobby"><p>Create a room and share its code, or enter a friend’s room code to join.</p><button className="primary" disabled={busy} onClick={createRoom}>Create room <span>↗</span></button><form onSubmit={joinRoom}><label htmlFor="room-code">JOIN A ROOM</label><div className="input-line"><input id="room-code" maxLength={8} autoComplete="off" value={roomCodeInput} onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="ROOM CODE"/><button className="submit" disabled={busy || roomCodeInput.length < 6} aria-label="Join room">↗</button></div></form></div>
      : <><div className="room-code"><small>ROOM CODE</small><b>{snapshot.roomCode}</b><span>Share this code with your friend</span></div>
        {snapshot.status === "waiting" && <p className="online-status">Waiting for a player to join…</p>}
        {snapshot.status === "setting-secret" && creator && <form className="guess-form" onSubmit={submitSecret}><label htmlFor="online-secret">SECRET CODE · FOUR DIGITS</label><div className="input-line"><input id="online-secret" inputMode="numeric" maxLength={4} value={secret} onChange={(event) => setSecret(event.target.value.replace(/\D/g, "").slice(0, 4))}/><button className="submit" disabled={busy} aria-label="Set secret code">↗</button></div></form>}
        {snapshot.status === "setting-secret" && !creator && <p className="online-status">Player One is choosing the secret. Hang tight.</p>}
        {snapshot.status === "guessing" && <><div className="online-status">{creator ? "Waiting for Player Two’s guess…" : `Guess ${snapshot.turnNumber} of 8 · ${snapshot.attemptsRemaining} tries left`}</div>{snapshot.guesses.length > 0 && <div className="online-history">{[...snapshot.guesses].reverse().map((row, index) => <div className="guess-row" key={`${row.guess}-${index}`}><div className="digits">{row.guess.split("").map((digit, slot) => <span className={`digit ${row.marks[slot]}`} key={slot}>{digit}</span>)}</div><div className="marks">{row.marks.map((mark, slot) => <span className={`mark ${mark}`} key={slot}/>)}</div></div>)}</div>}{!creator && <form className="guess-form" onSubmit={submitGuess}><label htmlFor="online-guess">YOUR GUESS · FOUR DIGITS</label><div className="input-line"><input id="online-guess" inputMode="numeric" maxLength={4} value={guess} onChange={(event) => setGuess(event.target.value.replace(/\D/g, "").slice(0, 4))}/><button className="submit" disabled={busy} aria-label="Submit guess">↗</button></div></form>}</>}
        {finished && <div className="online-result"><b>{won ? "You won this round." : "Your opponent won this round."}</b>{snapshot.revealedSecret && <span>The secret was {snapshot.revealedSecret}.</span>}<button className="again" onClick={exitOnline}>Leave room</button></div>}
      </>}
      {error && <p className="online-error" role="alert">{error}</p>}
      <p className="online-footnote">Online rooms expire after one hour. Your session token stays in this browser tab.</p>
    </section>
  </main>;
}
