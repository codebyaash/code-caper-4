# Code Caper

A local four-digit code-breaking game with solo practice and two-player pass-and-play. The rules live in `src/game/engine.ts`, separate from the Next.js interface, so online multiplayer can be added later without coupling it to the presentation layer.

## Run locally

```bash
npm install
npm run dev
```

Run the rules engine checks with `npm test`.

Open http://localhost:3000. Choose solo practice for a randomly generated secret or pass-and-play to set a private four-digit secret before handing the device to the guesser. Guesses may contain repeated digits; feedback counts each secret digit once and prioritizes exact-position matches. Match scores are saved in this browser on this device and can be reset from the score panel.

## Stack

Next.js App Router, TypeScript, React, and Tailwind CSS 4.

## Online multiplayer foundation

`src/game/online-session.ts` defines the client and transport contract for future online sessions. The snapshot intentionally contains no secret code; an online adapter will send secret setup and guesses to an authoritative server, which owns validation, scoring, turn order, and outcome. The current app does not connect to an online server yet.
