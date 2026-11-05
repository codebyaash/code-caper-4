"use client";
import { useState } from "react";
import { createSecret, isWinningGuess, scoreGuess, type GuessResult } from "@/game/engine";

export default function Home() {
  const [secret, setSecret] = useState("");
  const [guess, setGuess] = useState("");
  const [history, setHistory] = useState<GuessResult[]>([]);
  const [turn, setTurn] = useState(1);
  const [phase, setPhase] = useState<"setup" | "playing" | "won" | "lost">("setup");
  const [error, setError] = useState("");

  function start() {
    setSecret(createSecret()); setGuess(""); setHistory([]); setTurn(1); setError(""); setPhase("playing");
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4}$/.test(guess)) { setError("Enter exactly four digits."); return; }
    const marks = scoreGuess(secret, guess);
    setHistory((old) => [{ guess, marks }, ...old]); setGuess(""); setError("");
    if (isWinningGuess(marks)) setPhase("won");
    else if (turn >= 8) setPhase("lost");
    setTurn((value) => value + 1);
  }

  const ended = phase === "won" || phase === "lost";
  return <main className="shell">
    <header className="top"><a className="brand" href="#"><b>✳</b> code caper</a><span>A LITTLE FRIENDLY RIVALRY</span></header>
    <section className="layout">
      <aside><small>● &nbsp;THE CODE IS WAITING</small><h1>Crack the code.<br/><i>Keep your cool.</i></h1><p className="lede">One secret. Eight tries. A very smug opponent if you don’t get it.</p><div className="guide"><label>YOUR FIELD GUIDE</label><p><b className="green">●</b> Right digit, right place</p><p><b className="gold">◐</b> Right digit, wrong place</p><p><b className="gray">×</b> Not in the code</p></div><p className="hint">Repeated digits are allowed. Read every clue carefully.</p></aside>
      <section className="board"><div className="boardHead"><div><small>THE BREAKER’S BOARD</small><h2>{phase === "setup" ? "Ready when you are." : phase === "won" ? "Beautifully done." : phase === "lost" ? "The code got away." : "Your next move."}</h2></div><strong>{phase === "setup" ? "—" : Math.min(turn - 1, 8)}<small> / 8<br/>TRIES</small></strong></div>
      {phase === "setup" ? <div className="start"><div className="vault">▦</div><small>PASS &amp; PLAY · TWO PLAYERS</small><h3>Who’s cracking<br/>the code?</h3><p>Player one sets a four-digit secret. Player two gets eight guesses and clues after every try.</p><button onClick={start}>Set up the game <b>↗</b></button><small className="privacy">◉ Secret stays on this device</small></div> : <>
        <div className="history">{history.length === 0 ? <div className="empty"><span>◎</span><b>Your clues will land here.</b><small>Every guess narrows the field.</small></div> : history.map((row, index) => <div className="row" key={index}><small>{String(history.length - index).padStart(2, "0")}</small><div className="digits">{row.guess.split("").map((digit, slot) => <span className={row.marks[slot]} key={slot}>{digit}</span>)}</div><div className="dots">{row.marks.map((mark, slot) => <i className={mark} key={slot}/>)}</div></div>)}</div>
        {ended ? <div className="result"><b>{phase === "won" ? "✳ You cracked it" : `The secret was ${secret}`}</b><button onClick={start}>Play again ↗</button></div> : <form onSubmit={submit}><label>GUESS {String(turn).padStart(2, "0")} · FOUR DIGITS</label><div className="entry"><input aria-label="Four digit guess" inputMode="numeric" maxLength={4} placeholder="0  0  0  0" value={guess} onChange={(event) => setGuess(event.target.value.replace(/\D/g, "").slice(0, 4))}/><button aria-label="Submit guess">↗</button></div><small className="error">{error || `${9 - turn} guesses left`}</small></form>}
      </>}
      <footer>CODE CAPER <i>×</i> THINKING CAP <span>NO LUCK. JUST LOGIC.</span></footer></section>
    </section><div className="bottom">MADE FOR THE MOMENT BETWEEN “I KNOW IT” AND “GOT IT.” <span>LOCAL GAME · NO ACCOUNT NEEDED</span></div>
  </main>;
}