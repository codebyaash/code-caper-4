# Code Caper

A local pass-and-play four-digit code-breaking game. Rules live in `src/game/engine.ts`, separate from the Next.js interface so future multiplayer transports can be added cleanly.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Repeated digits are allowed; feedback counts each secret digit at most once, prioritizing exact-position matches.

## Stack

Next.js App Router, TypeScript, React, and Tailwind CSS 4.
