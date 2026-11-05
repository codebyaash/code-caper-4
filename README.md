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

The server-side session service owns secret codes, validates guesses, and advances turns. `src/game/upstash-store.ts` stores short-lived rooms in Upstash Redis with atomic revision checks; rooms expire after one hour. Session snapshots never include the secret before the round ends. The game includes a room screen for creating/joining rooms and polling live session updates.

To enable the API locally, create an Upstash Redis database and copy its REST URL and token into `.env.local` using the names in `.env.example`. Keep these credentials server-side. The API is available at `POST /api/online/rooms` with `{ "action": "create" }` or `{ "action": "join", "roomCode": "…" }`. Use `POST /api/online/rooms/[roomCode]` with the returned bearer token and an action of `reconnect`, `set-secret`, or `guess`.
