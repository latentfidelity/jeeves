# Jeeves — Coding Agent Notes

## Stack
TypeScript + discord.js v14 (Node >=18). Build output is `dist/`.

## Setup / run
- `npm install`
- Create `.env` (see `README.md`)
- Register commands: `npm run deploy:commands`
- Dev: `npm run dev`
- Prod: `npm run build` then `npm start`

## Conventions
- Never commit secrets (`.env`, tokens, API keys) or log them.
- Treat `data/` as user state; keep file formats backward-compatible and avoid destructive migrations.
- Be conservative with moderation actions: permission checks, rate limits, and clear operator feedback for mass actions.
- Keep slash-command definitions and deployment in sync with runtime behavior.

