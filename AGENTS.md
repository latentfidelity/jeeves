# Jeeves — Coding Agent Notes

See [CLAUDE.md](CLAUDE.md) for full architecture documentation.

## Quick Reference

```bash
npm install
npm run deploy:commands   # Register slash commands
npm run dev               # Development
npm run build && npm start # Production
```

## Critical Rules

- Never commit secrets (`.env`, tokens, API keys)
- Treat `data/` as user state: keep formats backward-compatible
- Run `deploy:commands` after modifying slash command options

