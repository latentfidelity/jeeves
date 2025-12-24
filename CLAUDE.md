# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                  # Install dependencies
npm run deploy:commands      # Register slash commands with Discord
npm run dev                  # Run with ts-node (development)
npm run build && npm start   # Compile and run (production)
```

## Architecture

### Entry Point & Message Flow

`src/index.ts` creates the Discord client and handles two event streams:
1. **InteractionCreate**: Slash commands routed via `commandMap` → permission check via `ensureStaff()` → `command.execute()`
2. **MessageCreate**: Runs `handleAutomodMessage()` then `handleChatMessage()` for passive chat feature

### Command Pattern

Commands in `src/commands/` implement the `Command` interface (`src/types/Command.ts`):
```typescript
{
  data: SlashCommandBuilder,           // Command definition
  execute: (interaction) => Promise,   // Handler
  requiredRole?: 'administrator' | 'moderator' | 'helper'
}
```

To add a new command:
1. Create file in `src/commands/`
2. Import and add to array in `src/commands/index.ts`
3. Run `npm run deploy:commands` to register with Discord

### Staff Role Hierarchy

`src/lib/staff.ts` implements: **administrator > moderator > helper** (higher inherits lower).

Roles are checked by name OR Discord permissions:
- administrator: `Administrator` permission
- moderator: `Administrator`, `ManageGuild`, `BanMembers`, `KickMembers`, `ModerateMembers`, or `ManageMessages`
- helper: `Administrator`, `ManageGuild`, `ModerateMembers`, or `ManageMessages`

### Data Stores

All stores under `src/lib/*Store.ts` use the same pattern:
- JSON files in `data/` directory
- `ensureDataFile()` → `readStore()` → modify → `writeStore()`
- Per-guild keying: `Record<guildId, Record<userId, Data[]>>`

| Store | File | Purpose |
|-------|------|---------|
| caseStore | `cases.json` | Moderation case log with auto-incrementing IDs |
| warnStore | `warnings.json` | User warnings per guild |
| noteStore | `notes.json` | Moderator notes on users |
| creditStore | `credits.json` | AI credits for paid models |
| configStore | `config.json` | Per-guild settings (mod-log channel, DM preferences) |
| automodStore | `automod.json` | Automod rules per guild |
| infractions | `infractions.json` | Aggregated infraction counts by type |
| chatStore | `chat.json` | Passive chat feature config |
| scheduler | `schedule.json` | Pending timed tasks |

### Case System

All moderation actions should:
1. Call `addCase()` from `caseStore.ts` (returns case with ID)
2. Send embed to mod-log via `sendModLog(guild, embed)`
3. Optionally track in `infractions` via `addInfraction()`

Use `createActionEmbed()` from `modLog.ts` for consistent formatting.

### Scheduler

`src/lib/scheduler.ts` handles deferred actions persisted across restarts:
- `scheduleUnlock(guildId, channelId, runAt)` - unlock channel at time
- `scheduleSlowmodeClear(guildId, channelId, runAt)` - reset slowmode
- `scheduleRoleRemoval(guildId, userId, roleId, runAt)` - remove temp role

Initialized on bot ready via `initScheduler(client)`.

### Automod

`src/lib/automod.ts` processes messages against rules from `automodStore`:
- Rule types: `keyword`, `invite`, `link`
- Actions: `delete`, `warn`, `timeout` (with `timeoutMs`)

Each action creates a case and posts to mod-log.

### AI Integration

**OpenRouter (Text)** - `src/lib/openrouter.ts`:
- Free models (cost 0 credits): llama, gemini, gemma, mistral, qwen variants with `:free` suffix
- Paid models deduct from user's credit balance via `creditStore`
- Credits calculated per 1K tokens based on `MODEL_PRICING` map

**FAL (Images)** - `src/lib/fal.ts`:
- Queue-based API with polling for results
- Models: FLUX Schnell/Dev/Pro, SD3 Medium, Recraft V3
- Credits deducted per image based on `IMAGE_MODELS` pricing

**Credit Margin** - Both integrations apply `config.creditMargin` multiplier:
- Default 1.5 (50% profit margin)
- Set via `CREDIT_MARGIN` env var (1.0 = break-even, 2.0 = 100% margin)

### Duration Parsing

`src/lib/duration.ts` parses human durations: `30s`, `5m`, `2h`, `7d`
- Returns milliseconds or `null` if invalid
- `MAX_TIMEOUT_MS` = 28 days (Discord API limit)
- Use `formatDuration(ms)` for display

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Bot token (also accepts `BOT_TOKEN`) |
| `DISCORD_CLIENT_ID` | Yes | Application ID |
| `DISCORD_GUILD_ID` | No | Guild ID for instant command registration (dev) |
| `MOD_LOG_CHANNEL_ID` | No | Default mod-log channel (can override per-guild) |
| `OPENROUTER_API_KEY` | For `/ask` | Enables text AI |
| `OPENROUTER_MODEL` | No | Default model (defaults to free llama-3.3-70b) |
| `OPENROUTER_SITE_URL` | No | Attribution header for OpenRouter |
| `OPENROUTER_APP_NAME` | No | Attribution header for OpenRouter |
| `FAL_API_KEY` | For `/image` | Enables image generation |
| `CREDIT_MARGIN` | No | Profit multiplier for credits (default: 1.5 = 50% margin) |

## TypeScript

- Target: ES2021, CommonJS modules
- Strict mode enabled with `noImplicitAny`
- Output to `dist/`, source in `src/`

## Key Conventions

- Keep slash-command deployment and runtime behavior in sync (run `deploy:commands` after modifying command options)
- Data under `data/` is user data: maintain backward compatibility, avoid destructive migrations
- Be conservative with moderation actions: include permission checks, confirmations for mass actions
- Commands reply ephemerally for errors/confirmations; use mod-log for audit trail
- DM users before punitive actions when possible (via `tryNotifyUser` from `notify.ts`)
- Automod and bot actions use bot's user ID as `moderatorId` in cases
