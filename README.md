# Code Caper

A four-digit code-breaking game with solo practice, two-player pass-and-play, and online rooms. The rules live in `src/game/engine.ts`, separate from the Next.js interface, with multiplayer state managed through adapters.

## Run locally

```bash
npm install
npm run dev
```

Run the rules engine checks with `npm test`.

Open http://localhost:3000. Solo practice uses a randomly generated secret. In pass-and-play and online rooms, both players choose a private four-digit secret, then alternate guesses at the other player's code. Each guess is scored automatically; both players get eight turns, with a win when a code is cracked or a draw when both codes survive. Guesses may contain repeated digits; feedback counts each secret digit once and prioritizes exact-position matches. Match scores are saved in this browser on this device and can be reset from the score panel.

## Stack

Next.js App Router, TypeScript, React, and Tailwind CSS 4.

## Online multiplayer foundation

The server-side session service stores both secret codes privately, validates guesses against the opponent’s code, alternates turns, and checks for wins or a draw after eight guesses each. `src/game/upstash-store.ts` stores short-lived rooms in Upstash Redis with atomic revision checks; rooms expire after one hour. Session snapshots never include either secret before the round ends. The online room screen supports creating/joining rooms and polling live session updates. Versioned storage keys prevent old one-secret room records from interfering with the current game rules.

To enable the API locally, create an Upstash Redis database and copy its REST URL and token into `.env.local` using the names in `.env.example`. Keep these credentials server-side. The API is available at `POST /api/online/rooms` with `{ "action": "create" }` or `{ "action": "join", "roomCode": "…" }`. Use `POST /api/online/rooms/[roomCode]` with the returned bearer token and an action of `reconnect`, `set-secret`, or `guess`.
