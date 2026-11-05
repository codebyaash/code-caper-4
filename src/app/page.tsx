"use client";

import { useEffect, useState } from "react";
import { createSecret, isWinningGuess, scoreGuess, type GuessResult } from "@/game/engine";
import OnlinePlay from "./online-play";

type GameMode = "solo" | "two-player" | "online";
type PlayerNumber = 1 | 2;
type HandoffTask = "secret" | "guess";
type Phase = "setup" | "secret" | "handoff" | "guessing" | "won" | "lost" | "draw";
type Scoreboard = { soloWins: number; soloGames: number; playerOneWins: number; playerTwoWins: number };
type HistoryEntry = GuessResult & { player?: PlayerNumber };
const scoreStorageKey = "code-caper:scores:v1";
const emptyScores: Scoreboard = { soloWins: 0, soloGames: 0, playerOneWins: 0, playerTwoWins: 0 };

function readSavedScores(): Scoreboard {
  try {
    const stored = localStorage.getItem(scoreStorageKey);
    if (!stored) return emptyScores;
    const value: unknown = JSON.parse(stored);
    if (!value || typeof value !== "object") return emptyScores;
    const candidate = value as Record<string, unknown>;
    const count = (key: keyof Scoreboard) => Number.isSafeInteger(candidate[key]) && Number(candidate[key]) >= 0 ? Number(candidate[key]) : 0;
    return { soloWins: count("soloWins"), soloGames: count("soloGames"), playerOneWins: count("playerOneWins"), playerTwoWins: count("playerTwoWins") };
  } catch {
    return emptyScores;
  }
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [mode, setMode] = useState<GameMode>("solo");
  const [scores, setScores] = useState<Scoreboard>(emptyScores);
  const [scoresLoaded, setScoresLoaded] = useState(false);
  const [confirmScoreReset, setConfirmScoreReset] = useState(false);
  const [secret, setSecret] = useState("");
  const [playerSecrets, setPlayerSecrets] = useState({ one: "", two: "" });
  const [secretPlayer, setSecretPlayer] = useState<PlayerNumber>(1);
  const [activePlayer, setActivePlayer] = useState<PlayerNumber>(1);
  const [playerTurns, setPlayerTurns] = useState({ one: 0, two: 0 });
  const [handoffPlayer, setHandoffPlayer] = useState<PlayerNumber>(2);
  const [handoffTask, setHandoffTask] = useState<HandoffTask>("secret");
  const [winner, setWinner] = useState<PlayerNumber | null>(null);
  const [secretInput, setSecretInput] = useState("");
  const [guess, setGuess] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [turn, setTurn] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    setScores(readSavedScores());
    setScoresLoaded(true);
  }, []);

  useEffect(() => {
    if (scoresLoaded) {
      try { localStorage.setItem(scoreStorageKey, JSON.stringify(scores)); } catch { }
    }
  }, [scores, scoresLoaded]);

  function startGame(selectedMode: GameMode) {
    setMode(selectedMode);
    setGuess(""); setSecretInput(""); setHistory([]); setTurn(1); setError("");
    setPlayerSecrets({ one: "", two: "" }); setSecretPlayer(1); setActivePlayer(1); setPlayerTurns({ one: 0, two: 0 }); setWinner(null);
    if (selectedMode === "solo") {
      setSecret(createSecret()); setPhase("guessing");
    } else {
      setPhase("secret");
    }
  }

  function setTwoPlayerSecret(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4}$/.test(secretInput)) { setError("Choose exactly four digits for the secret code."); return; }
    const nextSecrets = secretPlayer === 1 ? { ...playerSecrets, one: secretInput } : { ...playerSecrets, two: secretInput };
    setPlayerSecrets(nextSecrets); setSecretInput(""); setError(""); setPhase("handoff");
    if (secretPlayer === 1) {
      setSecretPlayer(2); setHandoffPlayer(2); setHandoffTask("secret");
    } else {
      setActivePlayer(1); setHandoffPlayer(1); setHandoffTask("guess");
    }
  }

  function continueAfterHandoff() {
    if (handoffTask === "secret") {
      setSecretPlayer(handoffPlayer); setPhase("secret");
    } else {
      setActivePlayer(handoffPlayer); setPhase("guessing");
    }
  }

  function submitGuess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4}$/.test(guess)) { setError("Enter exactly four digits to make your guess."); return; }
    const targetSecret = mode === "solo" ? secret : activePlayer === 1 ? playerSecrets.two : playerSecrets.one;
    const marks = scoreGuess(targetSecret, guess);
    setHistory((previous) => [{ guess, marks, ...(mode === "two-player" ? { player: activePlayer } : {}) }, ...previous]); setError(""); setGuess("");
    if (isWinningGuess(marks)) {
      setPhase("won");
      if (mode === "solo") setScores((current) => ({ ...current, soloWins: current.soloWins + 1, soloGames: current.soloGames + 1 }));
      else {
        setWinner(activePlayer);
        setScores((current) => activePlayer === 1 ? { ...current, playerOneWins: current.playerOneWins + 1 } : { ...current, playerTwoWins: current.playerTwoWins + 1 });
      }
    } else if (mode === "solo" && turn >= 8) {
      setPhase("lost");
      setScores((current) => ({ ...current, soloGames: current.soloGames + 1 }));
    } else if (mode === "two-player") {
      const nextTurns = activePlayer === 1 ? { ...playerTurns, one: playerTurns.one + 1 } : { ...playerTurns, two: playerTurns.two + 1 };
      setPlayerTurns(nextTurns);
      if (nextTurns.one >= 8 && nextTurns.two >= 8) setPhase("draw");
      else {
        setHandoffPlayer(activePlayer === 1 ? 2 : 1); setHandoffTask("guess"); setPhase("handoff");
      }
    }
    if (mode === "solo") setTurn((previous) => previous + 1);
  }

  const ended = phase === "won" || phase === "lost" || phase === "draw";
  const activePlayerTurns = activePlayer === 1 ? playerTurns.one : playerTurns.two;
  const boardTitle = phase === "setup" ? "Ready when you are." : phase === "won" ? "Code cracked." : phase === "lost" ? "The code got away." : phase === "draw" ? "Evenly matched." : mode === "two-player" && phase === "guessing" ? `Player ${activePlayer}’s move.` : mode === "two-player" && phase === "secret" ? `Player ${secretPlayer} sets a code.` : mode === "two-player" && phase === "handoff" ? "Pass the device." : "Your next move.";
  const triesUsed = mode === "solo" ? turn - 1 : activePlayerTurns;

  if (mode === "online") return <OnlinePlay onExit={() => { setMode("solo"); setPhase("setup"); }} />;

  return (
    <main className="shell">
      <header className="topbar"><a className="brand" href="#" aria-label="Code Caper home"><span className="brand-icon">✳</span> code caper</a><span className="edition">A LITTLE FRIENDLY RIVALRY</span><button className="help" title="Choose a game mode" onClick={() => setPhase("setup")}>?</button></header>
      <section className="game-layout">
        <div className="intro"><div className="eyebrow"><span className="live-dot" /> THE CODE IS WAITING</div><h1>Crack the code.<br /><em>Keep your cool.</em></h1><p className="lede">One secret. Eight tries. A very smug opponent if you don’t get it.</p><div className="rule-card"><div className="rule-title">YOUR FIELD GUIDE <span>01 — 03</span></div><div className="rule"><span className="rule-icon coral">●</span><p><b>Right digit, right place</b><br /><span>That digit is exactly where it belongs.</span></p></div><div className="rule"><span className="rule-icon gold">◐</span><p><b>Right digit, wrong place</b><br /><span>It’s in the code, just not there.</span></p></div><div className="rule"><span className="rule-icon muted">×</span><p><b>Not in the code</b><br /><span>That digit’s a red herring.</span></p></div></div><div className="note"><span>✳</span> Repeated digits are allowed. Read every clue carefully.</div><section className="scoreboard" aria-label="Saved game scores"><div><small>SOLO RECORD</small><b>{scores.soloWins} / {scores.soloGames}</b><span>wins / games</span></div><div><small>PASS &amp; PLAY</small><b>{scores.playerOneWins} <i>—</i> {scores.playerTwoWins}</b><span>Player One <i>·</i> Player Two</span></div></section><div className="score-tools" aria-live="polite">{confirmScoreReset ? <><span>Reset all saved scores?</span><button onClick={() => { setScores(emptyScores); setConfirmScoreReset(false); }}>Yes, reset</button><button onClick={() => setConfirmScoreReset(false)}>Cancel</button></> : <button onClick={() => setConfirmScoreReset(true)}>Reset scores</button>}</div></div>
        <div className="board-wrap"><div className="board-head"><div><div className="board-label">THE BREAKER’S BOARD</div><div className="board-title">{boardTitle}</div></div><div className="tries"><span>{phase === "setup" ? "—" : Math.min(triesUsed, 8)}</span><small> / 8<br />TRIES</small></div></div>
          {phase === "setup" ? <div className="start-panel mode-panel"><div className="vault">▦</div><p className="panel-kicker">PICK YOUR WAY TO PLAY</p><h2>One code.<br />Three ways in.</h2><p>Practice solo, pass the device, or challenge a friend online.</p><button className="primary mode-button" onClick={() => startGame("solo")}><span><b>Solo practice</b><small>Crack a randomly generated code</small></span><span>↗</span></button><button className="secondary mode-button" onClick={() => startGame("two-player")}><span><b>Two-player pass &amp; play</b><small>Both set codes, then alternate guesses</small></span><span>↗</span></button><button className="secondary mode-button" onClick={() => setMode("online")}><span><b>Online challenge</b><small>Both set codes, then alternate turns</small></span><span>↗</span></button><div className="privacy"><span>◉</span> Local secrets stay on this device</div></div>
          : phase === "secret" ? <div className="start-panel"><div className="vault">⌑</div><p className="panel-kicker">PLAYER {secretPlayer} · SECRET SETUP</p><h2>Choose a code.<br />Keep it hidden.</h2><p>Pick any four digits, including repeats. Your opponent will get eight guesses at your code.</p><form className="guess-form setup-form" onSubmit={setTwoPlayerSecret}><label htmlFor="secret-code">PLAYER {secretPlayer} SECRET · FOUR DIGITS</label><div className="input-line"><input id="secret-code" inputMode="numeric" autoComplete="off" maxLength={4} placeholder="0  0  0  0" value={secretInput} onChange={(event) => setSecretInput(event.target.value.replace(/\D/g, "").slice(0, 4))} /><button className="submit" type="submit" aria-label="Set secret code">↗</button></div><div className="form-foot"><span className="error">{error}</span><span>Only you should see this</span></div></form></div>
          : phase === "handoff" ? <div className="start-panel"><div className="vault">⇄</div><p className="panel-kicker">PASS THE DEVICE · PLAYER {handoffPlayer}</p><h2>{handoffTask === "secret" ? <>Player {handoffPlayer},<br />set your secret.</> : <>Player {handoffPlayer},<br />make your guess.</>}</h2><p>Make sure the other player can’t see the screen. Both players get eight guesses at the opponent’s code.</p><button className="primary" onClick={continueAfterHandoff}>{handoffTask === "secret" ? "Ready to set my code" : "Ready to guess"} <span>↗</span></button><div className="privacy"><span>◉</span> Secret codes stay on this device</div></div>
          : <>
            <div className="history" aria-live="polite">{history.length === 0 ? <div className="empty-state"><div className="target">◎</div><b>Your clues will land here.</b><span>{mode === "two-player" ? "Both players get eight guesses, taking turns." : "Every guess narrows the field."}</span></div> : history.map((row, index) => <div className="guess-row" key={`${row.guess}-${index}`}><span className="guess-number">{row.player ? `P${row.player}` : String(history.length - index).padStart(2, "0")}</span><div className="digits">{row.guess.split("").map((digit, slot) => <span className={`digit ${row.marks[slot]}`} key={slot}>{digit}</span>)}</div><div className="marks" aria-label={row.marks.join(", ")}>{row.marks.map((mark, slot) => <span className={`mark ${mark}`} key={slot} title={mark} />)}</div></div>)}</div>
            {ended ? <div className="result" aria-live="polite"><span>{phase === "draw" ? "A draw — both codes held." : mode === "solo" ? phase === "won" ? "✳ You cracked it" : `The secret was ${secret}` : phase === "won" ? `✳ Player ${winner} cracked the code` : `Both codes stayed safe · P1 ${playerSecrets.one} / P2 ${playerSecrets.two}`}</span><button className="again" onClick={() => setPhase("setup")}>New game ↗</button></div> : <form className="guess-form" onSubmit={submitGuess}><label htmlFor="guess">{mode === "solo" ? `GUESS ${String(turn).padStart(2, "0")}` : `PLAYER ${activePlayer} · GUESS ${activePlayerTurns + 1}`} <span>· FOUR DIGITS</span></label><div className="input-line"><input id="guess" inputMode="numeric" autoComplete="off" maxLength={4} placeholder="0  0  0  0" value={guess} onChange={(event) => setGuess(event.target.value.replace(/\D/g, "").slice(0, 4))} aria-describedby="guess-error" /><button className="submit" type="submit" aria-label="Submit guess">↗</button></div><div className="form-foot"><span id="guess-error" className="error" role="alert">{error}</span><span>{mode === "solo" ? 8 - turn + 1 : 8 - activePlayerTurns} guesses left</span></div></form>}
          </>}
          <div className="board-foot"><span>CODE CAPER <i>×</i> THINKING CAP</span><span>NO LUCK. JUST LOGIC.</span></div>
        </div>
      </section>
      <footer className="footer"><span>MADE FOR THE MOMENT BETWEEN “I KNOW IT” AND “GOT IT.”</span><span>SCORES SAVED ON THIS DEVICE</span></footer>
    </main>
  );
}
