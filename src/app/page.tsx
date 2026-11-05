"use client";

import { useEffect, useState } from "react";
import { countGuessMatches, createSecret, isValidCode, isWinningGuess, scoreGuess, type Difficulty, type GuessResult, type SecretLength } from "@/game/engine";
import OnlinePlay from "./online-play";

type GameMode = "solo" | "two-player" | "online";
type PlayerNumber = 1 | 2;
type HandoffTask = "secret" | "guess";
type Phase = "setup" | "configure" | "secret" | "handoff" | "guessing" | "won" | "lost" | "draw";
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

function GuessRow({ row, index, difficulty }: { row: HistoryEntry; index: number; difficulty: Difficulty }) {
  if (difficulty === "mystery") {
    const exact = row.marks.filter((mark) => mark === "exact").length;
    return <div className="guess-row mystery-row"><span className="guess-number">{String(index + 1).padStart(2, "0")}</span><div className="digits">{row.guess.split("").map((digit, slot) => <span className="digit" key={slot}>{digit}</span>)}</div><span className="exact-count">{exact} exact {exact === 1 ? "hit" : "hits"}</span></div>;
  }
  if (difficulty === "medium") {
    const { correctDigits, correctPositions } = countGuessMatches(row.marks);
    return <div className="guess-row mystery-row"><span className="guess-number">{row.player ? `P${row.player}` : String(index + 1).padStart(2, "0")}</span><div className="digits">{row.guess.split("").map((digit, slot) => <span className="digit" key={slot}>{digit}</span>)}</div><span className="medium-count">{correctDigits} num · {correctPositions} pos</span></div>;
  }
  return <div className="guess-row"><span className="guess-number">{row.player ? `P${row.player}` : String(index + 1).padStart(2, "0")}</span><div className="digits">{row.guess.split("").map((digit, slot) => <span className={`digit ${row.marks[slot]}`} key={slot}>{digit}</span>)}</div><div className="marks" aria-label={row.marks.join(", ")}>{row.marks.map((mark, slot) => <span className={`mark ${mark}`} key={slot} title={mark} />)}</div></div>;
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [mode, setMode] = useState<GameMode>("solo");
  const [setupMode, setSetupMode] = useState<GameMode>("solo");
  const [scores, setScores] = useState<Scoreboard>(emptyScores);
  const [scoresLoaded, setScoresLoaded] = useState(false);
  const [confirmScoreReset, setConfirmScoreReset] = useState(false);
  const [secret, setSecret] = useState("");
  const [secretLength, setSecretLength] = useState<SecretLength>(4);
  const [difficulty, setDifficulty] = useState<Difficulty>("classic");
  const [playerNames, setPlayerNames] = useState({ one: "Player One", two: "Player Two" });
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
    if (selectedMode === "two-player" && (!playerNames.one.trim() || !playerNames.two.trim())) {
      setError("Enter a code name for both players first.");
      return;
    }
    setMode(selectedMode);
    setGuess(""); setSecretInput(""); setHistory([]); setTurn(1); setError("");
    setPlayerSecrets({ one: "", two: "" }); setSecretPlayer(1); setActivePlayer(1); setPlayerTurns({ one: 0, two: 0 }); setWinner(null);
    if (selectedMode === "solo") {
      setSecret(createSecret(secretLength)); setPhase("guessing");
    } else {
      setPhase("secret");
    }
  }

  function continueFromSetup() {
    if (setupMode === "online") {
      setMode("online");
      setError("");
      return;
    }
    startGame(setupMode);
  }

  function setTwoPlayerSecret(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidCode(secretInput, secretLength)) { setError(`Choose exactly ${secretLength} digits for the secret code.`); return; }
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
    if (!isValidCode(guess, secretLength)) { setError(`Enter exactly ${secretLength} digits to make your guess.`); return; }
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
  const boardTitle = phase === "setup" ? "Ready when you are." : phase === "configure" ? "Make it your game." : phase === "won" ? "Code cracked." : phase === "lost" ? "The code got away." : phase === "draw" ? "Evenly matched." : mode === "two-player" && phase === "guessing" ? `${playerNames[activePlayer === 1 ? "one" : "two"]}’s move.` : mode === "two-player" && phase === "secret" ? `${playerNames[secretPlayer === 1 ? "one" : "two"]} sets a code.` : mode === "two-player" && phase === "handoff" ? "Pass the device." : "Your next move.";
  const triesUsed = mode === "solo" ? turn - 1 : activePlayerTurns;

  if (mode === "online") return <OnlinePlay secretLength={secretLength} difficulty={difficulty} onExit={() => { setMode("solo"); setPhase("setup"); }} />;

  return (
    <main className="shell">
      <header className="topbar"><a className="brand" href="#" aria-label="Code Caper home"><span className="brand-icon">✳</span> code caper</a><span className="edition">A LITTLE FRIENDLY RIVALRY</span><button className="help" title="Choose a game mode" onClick={() => setPhase("setup")}>?</button></header>
      <section className="game-layout">
        <div className="intro"><div className="eyebrow"><span className="live-dot" /> THE CODE IS WAITING</div><h1>Crack the code.<br /><em>Keep your cool.</em></h1><p className="lede">One secret. Eight tries. A very smug opponent if you don’t get it.</p><div className="rule-card"><div className="rule-title">YOUR FIELD GUIDE <span>{difficulty === "classic" ? "01 — 03" : difficulty === "medium" ? "MEDIUM MODE" : "HARD MODE"}</span></div>{difficulty === "classic" ? <><div className="rule"><span className="rule-icon coral">●</span><p><b>Right digit, right place</b><br /><span>That digit is exactly where it belongs.</span></p></div><div className="rule"><span className="rule-icon gold">◐</span><p><b>Right digit, wrong place</b><br /><span>It’s in the code, just not there.</span></p></div><div className="rule"><span className="rule-icon muted">×</span><p><b>Not in the code</b><br /><span>That digit’s a red herring.</span></p></div></> : difficulty === "medium" ? <div className="rule"><span className="rule-icon gold">#</span><p><b>Two counts per guess</b><br /><span>See how many digits are correct and how many are in the right position.</span></p></div> : <div className="rule"><span className="rule-icon coral">●</span><p><b>Exact-match count only</b><br /><span>See how many digits are right and in place. Their slots stay hidden.</span></p></div>}</div><div className="note"><span>✳</span> Repeated digits are allowed. {difficulty === "classic" ? "Read every clue carefully." : difficulty === "medium" ? "Medium shows both totals without marking slots." : "Hard mode shows the exact-match total only."}</div><section className="scoreboard" aria-label="Saved game scores"><div><small>SOLO RECORD</small><b>{scores.soloWins} / {scores.soloGames}</b><span>wins / games</span></div><div><small>PASS &amp; PLAY</small><b>{scores.playerOneWins} <i>—</i> {scores.playerTwoWins}</b><span>{playerNames.one} <i>·</i> {playerNames.two}</span></div></section><div className="score-tools" aria-live="polite">{confirmScoreReset ? <><span>Reset all saved scores?</span><button onClick={() => { setScores(emptyScores); setConfirmScoreReset(false); }}>Yes, reset</button><button onClick={() => setConfirmScoreReset(false)}>Cancel</button></> : <button onClick={() => setConfirmScoreReset(true)}>Reset scores</button>}</div></div>
        <div className="board-wrap"><div className="board-head"><div><div className="board-label">THE BREAKER’S BOARD</div><div className="board-title">{boardTitle}</div></div><div className="tries"><span>{phase === "setup" || phase === "configure" ? "—" : Math.min(triesUsed, 8)}</span><small> / 8<br />TRIES</small></div></div>
          {phase === "setup" ? <div className="start-panel mode-panel"><div className="vault">▦</div><p className="panel-kicker">PICK YOUR WAY TO PLAY</p><h2>One code.<br />Three ways in.</h2><p>Choose a mode to set up your next game.</p><button type="button" className="primary mode-button" onClick={() => { setSetupMode("solo"); setError(""); setPhase("configure"); }}><span><b>Solo practice</b><small>Crack a randomly generated code</small></span><span>↗</span></button><button type="button" className="secondary mode-button" onClick={() => { setSetupMode("two-player"); setError(""); setPhase("configure"); }}><span><b>Two-player pass &amp; play</b><small>Both set codes, then alternate guesses</small></span><span>↗</span></button><button type="button" className="secondary mode-button" onClick={() => { setSetupMode("online"); setError(""); setPhase("configure"); }}><span><b>Online challenge</b><small>Set up a room and play from anywhere</small></span><span>↗</span></button><div className="privacy"><span>◉</span> Local secrets stay on this device</div></div>
          : phase === "configure" ? <div className="start-panel mode-panel"><div className="vault">{setupMode === "solo" ? "◎" : setupMode === "two-player" ? "⇄" : "⌘"}</div><p className="panel-kicker">{setupMode === "solo" ? "SOLO PRACTICE" : setupMode === "two-player" ? "PASS & PLAY" : "ONLINE CHALLENGE"}</p><h2>Make it<br />your game.</h2><div className="setup-options"><fieldset><legend>CODE LENGTH</legend><div className="choice-row"><button type="button" className={secretLength === 4 ? "choice selected" : "choice"} aria-pressed={secretLength === 4} onClick={() => setSecretLength(4)}>4 digits</button><button type="button" className={secretLength === 5 ? "choice selected" : "choice"} aria-pressed={secretLength === 5} onClick={() => setSecretLength(5)}>5 digits</button></div></fieldset><fieldset><legend>DIFFICULTY</legend><div className="choice-row"><button type="button" className={difficulty === "classic" ? "choice selected" : "choice"} aria-pressed={difficulty === "classic"} onClick={() => setDifficulty("classic")}>Classic</button><button type="button" className={difficulty === "medium" ? "choice selected" : "choice"} aria-pressed={difficulty === "medium"} onClick={() => setDifficulty("medium")}>Medium</button><button type="button" className={difficulty === "mystery" ? "choice selected" : "choice"} aria-pressed={difficulty === "mystery"} onClick={() => setDifficulty("mystery")}>Hard</button></div><small>{difficulty === "classic" ? "See each matching digit and position." : difficulty === "medium" ? "See total correct digits and correct positions." : "See the exact-match count, not the matching slots."}</small></fieldset>{setupMode === "two-player" && <fieldset><legend>PLAYER NAMES</legend><div className="name-fields"><label>Player One<input maxLength={24} value={playerNames.one} onChange={(event) => setPlayerNames((names) => ({ ...names, one: event.target.value }))} /></label><label>Player Two<input maxLength={24} value={playerNames.two} onChange={(event) => setPlayerNames((names) => ({ ...names, two: event.target.value }))} /></label></div></fieldset>}</div><span className="error setup-error" role="alert">{error}</span><button type="button" className="primary mode-button continue-button" onClick={continueFromSetup}><span><b>{setupMode === "solo" ? "Start solo game" : setupMode === "two-player" ? "Start pass & play" : "Continue to online rooms"}</b><small>{setupMode === "solo" ? "Your secret code is ready" : setupMode === "two-player" ? "Both players will choose a secret" : "Create a room or join a friend"}</small></span><span>↗</span></button><button type="button" className="back-button" onClick={() => { setError(""); setPhase("setup"); }}>← Choose another mode</button></div>
          : phase === "secret" ? <div className="start-panel"><div className="vault">⌑</div><p className="panel-kicker">{playerNames[secretPlayer === 1 ? "one" : "two"].toUpperCase()} · SECRET SETUP</p><h2>Choose a code.<br />Keep it hidden.</h2><p>Pick any {secretLength} digits, including repeats. Your opponent will get eight guesses at your code.</p><form className="guess-form setup-form" onSubmit={setTwoPlayerSecret}><label htmlFor="secret-code">{playerNames[secretPlayer === 1 ? "one" : "two"].toUpperCase()} SECRET · {secretLength} DIGITS</label><div className="input-line"><input id="secret-code" inputMode="numeric" autoComplete="off" maxLength={secretLength} placeholder={Array(secretLength).fill("0").join("  ")} value={secretInput} onChange={(event) => setSecretInput(event.target.value.replace(/\D/g, "").slice(0, secretLength))} /><button className="submit" type="submit" aria-label="Set secret code">↗</button></div><div className="form-foot"><span className="error">{error}</span><span>Only you should see this</span></div></form></div>
          : phase === "handoff" ? <div className="start-panel"><div className="vault">⇄</div><p className="panel-kicker">PASS THE DEVICE · {playerNames[handoffPlayer === 1 ? "one" : "two"].toUpperCase()}</p><h2>{handoffTask === "secret" ? <>{playerNames[handoffPlayer === 1 ? "one" : "two"]},<br />set your secret.</> : <>{playerNames[handoffPlayer === 1 ? "one" : "two"]},<br />make your guess.</>}</h2><p>Make sure the other player can’t see the screen. Both players get eight guesses at the opponent’s code.</p><button className="primary" onClick={continueAfterHandoff}>{handoffTask === "secret" ? "Ready to set my code" : "Ready to guess"} <span>↗</span></button><div className="privacy"><span>◉</span> Secret codes stay on this device</div></div>
          : <>
            {mode === "two-player" ? <div className="player-boards">{([1, 2] as const).map((player) => { const rows = history.filter((row) => row.player === player).slice().reverse(); return <section className="player-board" key={player} aria-label={`${playerNames[player === 1 ? "one" : "two"]} guesses`}><h3>{playerNames[player === 1 ? "one" : "two"]}<small>{rows.length} / 8 guesses</small></h3><div className="player-history" aria-live="polite">{rows.length ? rows.map((row, index) => <GuessRow key={`${row.guess}-${index}`} row={row} index={index} difficulty={difficulty} />) : <span className="quiet-empty">Guesses will appear here.</span>}</div></section>; })}</div> : <div className="history" aria-live="polite">{history.length === 0 ? <div className="empty-state"><div className="target">◎</div><b>Your clues will land here.</b><span>Every guess narrows the field.</span></div> : history.map((row, index) => <GuessRow key={`${row.guess}-${index}`} row={row} index={history.length - index - 1} difficulty={difficulty} />)}</div>}
            {ended ? <div className="result" aria-live="polite"><span>{phase === "draw" ? "A draw — both codes held." : mode === "solo" ? phase === "won" ? "✳ You cracked it" : `The secret was ${secret}` : phase === "won" ? `✳ ${playerNames[winner === 1 ? "one" : "two"]} cracked the code` : `Both codes stayed safe · ${playerNames.one} ${playerSecrets.one} / ${playerNames.two} ${playerSecrets.two}`}</span><button className="again" onClick={() => setPhase("setup")}>New game ↗</button></div> : <form className="guess-form" onSubmit={submitGuess}><label htmlFor="guess">{mode === "solo" ? `GUESS ${String(turn).padStart(2, "0")}` : `${playerNames[activePlayer === 1 ? "one" : "two"].toUpperCase()} · GUESS ${activePlayerTurns + 1}`} <span>· {secretLength} DIGITS</span></label><div className="input-line"><input id="guess" inputMode="numeric" autoComplete="off" maxLength={secretLength} placeholder={Array(secretLength).fill("0").join("  ")} value={guess} onChange={(event) => setGuess(event.target.value.replace(/\D/g, "").slice(0, secretLength))} aria-describedby="guess-error" /><button className="submit" type="submit" aria-label="Submit guess">↗</button></div><div className="form-foot"><span id="guess-error" className="error" role="alert">{error}</span><span>{mode === "solo" ? 8 - turn + 1 : 8 - activePlayerTurns} guesses left</span></div></form>}
          </>}
          <div className="board-foot"><span>CODE CAPER <i>×</i> THINKING CAP</span><span>NO LUCK. JUST LOGIC.</span></div>
        </div>
      </section>
      <footer className="footer"><span>MADE FOR THE MOMENT BETWEEN “I KNOW IT” AND “GOT IT.”</span><span>SCORES SAVED ON THIS DEVICE</span></footer>
    </main>
  );
}
