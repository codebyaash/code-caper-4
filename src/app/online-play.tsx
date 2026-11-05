"use client";

import { useEffect, useMemo, useState } from "react";
import { countGuessMatches, isValidCode, type Difficulty, type SecretLength } from "@/game/engine";
import { createHttpOnlineGameAdapter } from "@/game/http-online-adapter";
import type { OnlineGuess, OnlinePlayerRole, OnlineSession, OnlineSessionSnapshot } from "@/game/online-session";

type SavedSession = { roomCode: string; participantToken: string };
const savedSessionKey = "code-caper:online-session:v1";

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "The online game couldn’t connect. Try again.";
  if (error.message === "ONLINE_UNAVAILABLE") return "Online rooms are temporarily unavailable. Try again shortly.";
  if (error.message === "ROOM_NOT_FOUND") return "That room code wasn’t found or has expired.";
  if (error.message === "ROOM_FULL") return "That room already has two players.";
  if (error.message === "UNAUTHORIZED") return "This session expired. Start or join a room again.";
  if (error.message === "INVALID_SECRET") return "Enter a valid secret code.";
  return "The online game couldn’t connect. Try again.";
}

function OnlineGuessRow({ row, index, difficulty }: { row: OnlineGuess; index: number; difficulty: Difficulty }) {
  if (difficulty === "mystery") {
    const exact = row.marks.filter((mark) => mark === "exact").length;
    return <div className="guess-row mystery-row"><span className="guess-number">{String(index + 1).padStart(2, "0")}</span><div className="digits">{row.guess.split("").map((digit, slot) => <span className="digit" key={slot}>{digit}</span>)}</div><span className="exact-count">{exact} exact {exact === 1 ? "hit" : "hits"}</span></div>;
  }
  if (difficulty === "medium") {
    const { correctDigits, correctPositions } = countGuessMatches(row.marks);
    return <div className="guess-row mystery-row"><span className="guess-number">{String(index + 1).padStart(2, "0")}</span><div className="digits">{row.guess.split("").map((digit, slot) => <span className="digit" key={slot}>{digit}</span>)}</div><span className="medium-count">{correctDigits} num · {correctPositions} pos</span></div>;
  }
  return <div className="guess-row"><span className="guess-number">{String(index + 1).padStart(2, "0")}</span><div className="digits">{row.guess.split("").map((digit, slot) => <span className={`digit ${row.marks[slot]}`} key={slot}>{digit}</span>)}</div><div className="marks">{row.marks.map((mark, slot) => <span className={`mark ${mark}`} key={slot}/>)}</div></div>;
}

export default function OnlinePlay({ onExit, secretLength, difficulty }: { onExit: () => void; secretLength: SecretLength; difficulty: Difficulty }) {
  const [session, setSession] = useState<OnlineSession | null>(null);
  const [snapshot, setSnapshot] = useState<OnlineSessionSnapshot | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [joinNameStep, setJoinNameStep] = useState(false);
  const [joinPlayerName, setJoinPlayerName] = useState("");
  const [playerName, setPlayerName] = useState("");
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
    const created = await run(() => adapter.createRoom(playerName.trim(), secretLength, difficulty));
    if (created && "getSnapshot" in created) setPlayerName("");
  }

  async function joinRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!joinNameStep) {
      if (roomCodeInput.trim().length >= 6) { setJoinNameStep(true); setError(""); }
      return;
    }
    const joined = await run(() => adapter.joinRoom(roomCodeInput.trim(), joinPlayerName.trim()));
    if (joined && "getSnapshot" in joined) { setJoinPlayerName(""); setJoinNameStep(false); }
  }

  async function submitSecret(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const length = snapshot?.secretLength ?? secretLength;
    if (!isValidCode(secret, length)) { setError(`Enter exactly ${length} digits.`); return; }
    if (session && await run(() => session.setSecret(secret))) setSecret("");
  }

  async function submitGuess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const length = snapshot?.secretLength ?? secretLength;
    if (!isValidCode(guess, length)) { setError(`Enter exactly ${length} digits.`); return; }
    if (session && await run(() => session.submitGuess(guess))) setGuess("");
  }

  async function exitOnline() {
    await session?.leave();
    sessionStorage.removeItem(savedSessionKey);
    onExit();
  }

  const finished = snapshot?.status === "won" || snapshot?.status === "lost" || snapshot?.status === "draw";
  const won = snapshot?.winner === snapshot?.yourRole;
  const isYourTurn = snapshot?.activePlayer === snapshot?.yourRole;
  const length = snapshot?.secretLength ?? secretLength;
  const gameDifficulty = snapshot?.difficulty ?? difficulty;

  function guessColumn(role: OnlinePlayerRole) {
    const rows = snapshot?.guesses.filter((row) => row.player === role) ?? [];
    const name = snapshot?.playerNames[role] ?? (role === "creator" ? "Player One" : "Player Two");
    return <section className="player-board online-player-board" key={role} aria-label={`${name} guesses`}><h3>{name}<small>{rows.length} / 8 guesses</small></h3><div className="player-history" aria-live="polite">{rows.length ? rows.map((row, index) => <OnlineGuessRow key={`${row.guess}-${index}`} row={row} index={index} difficulty={gameDifficulty} />) : <span className="quiet-empty">Guesses will appear here.</span>}</div></section>;
  }

  return <main className="online-shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-icon">✳</span> code caper</a><span className="edition">ONLINE CHALLENGE</span><button className="help" onClick={exitOnline}>×</button></header>
    <section className="online-card">
      <p className="panel-kicker">TWO PLAYERS · TWO DEVICES · ROUND {snapshot?.roundNumber ?? 1}</p>
      <h1>{!snapshot ? "Bring a friend into the game." : finished ? snapshot.status === "draw" ? "An even match." : won ? "A lovely bit of codebreaking." : "Your opponent cracked it." : snapshot.status === "waiting" ? "Your room is ready." : snapshot.status === "setting-secrets" && snapshot.yourSecretSet ? "Your code is locked." : snapshot.status === "setting-secrets" ? "Choose your secret code." : snapshot.status === "guessing" && isYourTurn ? "Your turn to crack the code." : "Your opponent is guessing."}</h1>
      {!snapshot ? <div className="online-lobby">
        <p>Create a room and share its code, or enter a friend’s room code to join. Your room settings are {secretLength} digits · {difficulty === "classic" ? "Classic" : difficulty === "medium" ? "Medium" : "Hard"} clues.</p>
        {!joinNameStep ? <>
          <label htmlFor="player-name">YOUR CODE NAME</label>
          <input id="player-name" className="name-input" maxLength={24} autoComplete="nickname" value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="Your name" />
          <button className="primary" disabled={busy || !playerName.trim()} onClick={createRoom}>Create room <span>↗</span></button>
          <form onSubmit={joinRoom}>
            <label htmlFor="room-code">JOIN A ROOM</label>
            <div className="input-line"><input id="room-code" maxLength={8} autoComplete="off" value={roomCodeInput} onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="ROOM CODE" /><button className="submit" type="submit" disabled={busy || roomCodeInput.length < 6} aria-label="Continue to join room">↗</button></div>
          </form>
        </> : <form className="join-name-step" onSubmit={joinRoom}>
          <p className="online-status">Room <b>{roomCodeInput}</b> · choose the code name your opponent will see.</p>
          <label htmlFor="join-player-name">YOUR CODE NAME</label>
          <input id="join-player-name" className="name-input" maxLength={24} autoComplete="nickname" value={joinPlayerName} onChange={(event) => setJoinPlayerName(event.target.value)} placeholder="Your name" />
          <button className="primary" type="submit" disabled={busy || !joinPlayerName.trim()}>Join room <span>↗</span></button>
          <button className="back-button" type="button" onClick={() => setJoinNameStep(false)}>← Change room code</button>
        </form>}
      </div>
      : <><div className="room-code"><small>ROOM CODE · ROUND {snapshot.roundNumber}</small><b>{snapshot.roomCode}</b><span>Share this code with {snapshot.playerNames[snapshot.yourRole === "creator" ? "opponent" : "creator"]}</span></div>
        {snapshot.status === "waiting" && <p className="online-status">Waiting for a player to join…</p>}
        {snapshot.status === "setting-secrets" && !snapshot.yourSecretSet && <form className="guess-form" onSubmit={submitSecret}><label htmlFor="online-secret">{snapshot.playerNames[snapshot.yourRole].toUpperCase()} · YOUR SECRET CODE · {length} DIGITS</label><div className="input-line"><input id="online-secret" inputMode="numeric" maxLength={length} value={secret} onChange={(event) => setSecret(event.target.value.replace(/\D/g, "").slice(0, length))}/><button className="submit" disabled={busy} aria-label="Set secret code">↗</button></div><p className="online-status">Your opponent also sets a code before the first turn.</p></form>}
        {snapshot.status === "setting-secrets" && snapshot.yourSecretSet && <p className="online-status">Waiting for {snapshot.playerNames[snapshot.yourRole === "creator" ? "opponent" : "creator"]} to choose a secret…</p>}
        {snapshot.status === "guessing" && <><div className="online-status">{isYourTurn ? `Your turn · ${snapshot.attemptsRemaining} guesses left` : `Waiting for ${snapshot.playerNames[snapshot.activePlayer === "creator" ? "creator" : "opponent"]} · turn ${snapshot.turnNumber}`}</div><div className="player-boards online-player-boards">{guessColumn("creator")}{guessColumn("opponent")}</div>{isYourTurn && <form className="guess-form" onSubmit={submitGuess}><label htmlFor="online-guess">YOUR GUESS · {length} DIGITS</label><div className="input-line"><input id="online-guess" inputMode="numeric" maxLength={length} value={guess} onChange={(event) => setGuess(event.target.value.replace(/\D/g, "").slice(0, length))}/><button className="submit" disabled={busy} aria-label="Submit guess">↗</button></div></form>}</>}
        {finished && <><div className="player-boards online-player-boards">{guessColumn("creator")}{guessColumn("opponent")}</div><div className="online-result"><b>{snapshot.status === "draw" ? "Draw — neither code was cracked." : won ? "You won this round." : "Your opponent won this round."}</b>{snapshot.revealedSecrets && <span>{snapshot.playerNames.creator}’s code: {snapshot.revealedSecrets.creator} · {snapshot.playerNames.opponent}’s code: {snapshot.revealedSecrets.opponent}</span>}<button className="again" disabled={busy || snapshot.rematchRequested} onClick={() => session && void run(() => session.requestRematch())}>{snapshot.rematchRequested ? snapshot.otherRematchRequested ? "Starting next round…" : "Waiting for your opponent…" : "Play again ↗"}</button><button className="leave-room" onClick={exitOnline}>Leave room</button></div></>}
      </>}
      {error && <p className="online-error" role="alert">{error}</p>}
      <p className="online-footnote">Room codes and player tokens expire one hour after creation. Each round uses the same code length and clue style.</p>
    </section>
  </main>;
}
