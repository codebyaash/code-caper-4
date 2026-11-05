"use client";

import { useEffect, useState } from "react";
import { createSecret, isWinningGuess, scoreGuess, type GuessResult } from "@/game/engine";
import OnlinePlay from "./online-play";

type GameMode = "solo" | "two-player" | "online";
type Phase = "setup" | "secret" | "handoff" | "guessing" | "won" | "lost";
type Scoreboard = { soloWins: number; soloGames: number; playerOneWins: number; playerTwoWins: number };
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
  const [secretInput, setSecretInput] = useState("");
  const [guess, setGuess] = useState("");
  const [history, setHistory] = useState<GuessResult[]>([]);
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
    if (selectedMode === "solo") {
      setSecret(createSecret()); setPhase("guessing");
    } else {
      setPhase("secret");
    }
  }

  function setTwoPlayerSecret(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4}$/.test(secretInput)) { setError("Choose exactly four digits for the secret code."); return; }
    setSecret(secretInput); setSecretInput(""); setError(""); setPhase("handoff");
  }

  function submitGuess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4}$/.test(guess)) { setError("Enter exactly four digits to make your guess."); return; }
    const marks = scoreGuess(secret, guess);
    setHistory((previous) => [{ guess, marks }, ...previous]); setError(""); setGuess("");
    if (isWinningGuess(marks)) {
      setPhase("won");
      setScores((current) => mode === "solo"
        ? { ...current, soloWins: current.soloWins + 1, soloGames: current.soloGames + 1 }
        : { ...current, playerTwoWins: current.playerTwoWins + 1 });
    } else if (turn >= 8) {
      setPhase("lost");
      setScores((current) => mode === "solo"
        ? { ...current, soloGames: current.soloGames + 1 }
        : { ...current, playerOneWins: current.playerOneWins + 1 });
    }
    setTurn((previous) => previous + 1);
  }

  const ended = phase === "won" || phase === "lost";

  if (mode === "online") return <OnlinePlay onExit={() => { setMode("solo"); setPhase("setup"); }} />;

  return (
    <main className="shell">
      <header className="topbar"><a className="brand" href="#" aria-label="Code Caper home"><span className="brand-icon">✳</span> code caper</a><span className="edition">A LITTLE FRIENDLY RIVALRY</span><button className="help" title="Choose a game mode" onClick={() => setPhase("setup")}>?</button></header>
      <section className="game-layout">
        <div className="intro"><div className="eyebrow"><span className="live-dot" /> THE CODE IS WAITING</div><h1>Crack the code.<br /><em>Keep your cool.</em></h1><p className="lede">One secret. Eight tries. A very smug opponent if you don’t get it.</p><div className="rule-card"><div className="rule-title">YOUR FIELD GUIDE <span>01 — 03</span></div><div className="rule"><span className="rule-icon coral">●</span><p><b>Right digit, right place</b><br /><span>That digit is exactly where it belongs.</span></p></div><div className="rule"><span className="rule-icon gold">◐</span><p><b>Right digit, wrong place</b><br /><span>It’s in the code, just not there.</span></p></div><div className="rule"><span className="rule-icon muted">×</span><p><b>Not in the code</b><br /><span>That digit’s a red herring.</span></p></div></div><div className="note"><span>✳</span> Repeated digits are allowed. Read every clue carefully.</div><section className="scoreboard" aria-label="Saved game scores"><div><small>SOLO RECORD</small><b>{scores.soloWins} / {scores.soloGames}</b><span>wins / games</span></div><div><small>PASS &amp; PLAY</small><b>{scores.playerOneWins} <i>—</i> {scores.playerTwoWins}</b><span>Player One <i>·</i> Player Two</span></div></section><div className="score-tools" aria-live="polite">{confirmScoreReset ? <><span>Reset all saved scores?</span><button onClick={() => { setScores(emptyScores); setConfirmScoreReset(false); }}>Yes, reset</button><button onClick={() => setConfirmScoreReset(false)}>Cancel</button></> : <button onClick={() => setConfirmScoreReset(true)}>Reset scores</button>}</div></div>
        <div className="board-wrap"><div className="board-head"><div><div className="board-label">THE BREAKER’S BOARD</div><div className="board-title">{phase === "setup" ? "Ready when you are." : phase === "won" ? "Beautifully done." : phase === "lost" ? "The code got away." : "Your next move."}</div></div><div className="tries"><span>{phase === "setup" ? "—" : Math.min(turn - 1, 8)}</span><small> / 8<br />TRIES</small></div></div>
          {phase === "setup" ? <div className="start-panel mode-panel"><div className="vault">▦</div><p className="panel-kicker">PICK YOUR WAY TO PLAY</p><h2>One code.<br />Three ways in.</h2><p>Practice solo, pass the device, or challenge a friend online.</p><button className="primary mode-button" onClick={() => startGame("solo")}><span><b>Solo practice</b><small>Crack a randomly generated code</small></span><span>↗</span></button><button className="secondary mode-button" onClick={() => startGame("two-player")}><span><b>Two-player pass &amp; play</b><small>One sets the code, one cracks it</small></span><span>↗</span></button><button className="secondary mode-button" onClick={() => setMode("online")}><span><b>Online challenge</b><small>Play together from separate devices</small></span><span>↗</span></button><div className="privacy"><span>◉</span> Local secrets stay on this device</div></div>
          : phase === "secret" ? <div className="start-panel"><div className="vault">⌑</div><p className="panel-kicker">PLAYER ONE · SECRET SETUP</p><h2>Choose a code.<br />Keep it hidden.</h2><p>Pick any four digits, including repeats. Hand the device over after you set it.</p><form className="guess-form setup-form" onSubmit={setTwoPlayerSecret}><label htmlFor="secret-code">YOUR SECRET · FOUR DIGITS</label><div className="input-line"><input id="secret-code" inputMode="numeric" autoComplete="off" maxLength={4} placeholder="0  0  0  0" value={secretInput} onChange={(event) => setSecretInput(event.target.value.replace(/\D/g, "").slice(0, 4))} /><button className="submit" type="submit" aria-label="Set secret code">↗</button></div><div className="form-foot"><span className="error">{error}</span><span>Only you should see this</span></div></form></div>
          : phase === "handoff" ? <div className="start-panel"><div className="vault">⇄</div><p className="panel-kicker">PASS THE DEVICE</p><h2>Code is locked.<br />Eyes off, player two.</h2><p>Make sure Player One can’t see the screen. Player Two gets eight tries to crack the code.</p><button className="primary" onClick={() => setPhase("guessing")}>I’m ready to guess <span>↗</span></button><div className="privacy"><span>◉</span> Your code stays on this device</div></div>
          : <>
            <div className="history" aria-live="polite">{history.length === 0 ? <div className="empty-state"><div className="target">◎</div><b>Your clues will land here.</b><span>Every guess narrows the field.</span></div> : history.map((row, index) => <div className="guess-row" key={`${row.guess}-${index}`}><span className="guess-number">{String(history.length - index).padStart(2, "0")}</span><div className="digits">{row.guess.split("").map((digit, slot) => <span className={`digit ${row.marks[slot]}`} key={slot}>{digit}</span>)}</div><div className="marks" aria-label={row.marks.join(", ")}>{row.marks.map((mark, slot) => <span className={`mark ${mark}`} key={slot} title={mark} />)}</div></div>)}</div>
            {ended ? <div className="result" aria-live="polite"><span>{phase === "won" ? mode === "solo" ? "✳ You cracked it" : "✳ Player Two cracked it" : mode === "solo" ? `The secret was ${secret}` : `Player One wins · code: ${secret}`}</span><button className="again" onClick={() => setPhase("setup")}>New game ↗</button></div> : <form className="guess-form" onSubmit={submitGuess}><label htmlFor="guess">GUESS {String(turn).padStart(2, "0")} <span>· FOUR DIGITS</span></label><div className="input-line"><input id="guess" inputMode="numeric" autoComplete="off" maxLength={4} placeholder="0  0  0  0" value={guess} onChange={(event) => setGuess(event.target.value.replace(/\D/g, "").slice(0, 4))} aria-describedby="guess-error" /><button className="submit" type="submit" aria-label="Submit guess">↗</button></div><div className="form-foot"><span id="guess-error" className="error" role="alert">{error}</span><span>{8 - turn + 1} guesses left</span></div></form>}
          </>}
          <div className="board-foot"><span>CODE CAPER <i>×</i> THINKING CAP</span><span>NO LUCK. JUST LOGIC.</span></div>
        </div>
      </section>
      <footer className="footer"><span>MADE FOR THE MOMENT BETWEEN “I KNOW IT” AND “GOT IT.”</span><span>SCORES SAVED ON THIS DEVICE</span></footer>
    </main>
  );
}
