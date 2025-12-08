# Jeeves

A Discord moderation bot focused on clear, reliable server controls. Built with TypeScript and discord.js v14.

## Features
- Moderation suite: bans/forcebans/softbans/unbans, kicks, timeouts/untimeouts, mass actions, purges, slowmode (with auto-reset), channel lockdowns (with auto-unlock), temporary roles.
- User management: warnings (add/view/clear/delete), moderator notes (add/list/clear), cases, infractions, consolidated history, appeal links.
- Utilities: diagnostics, help, user info, reports to mod-log, backups to JSON.
- Automod: keyword/invite/link filters with delete/warn/timeout actions.
- Scheduler: timed slowmode resets, channel unlocks, and temporary role removals.
- Optional moderation log channel for auditability, including case IDs and optional SQLite logging for actions.
- File-backed storage under `data/` that persists across restarts.

## Requirements
- Node.js 18 or newer
- A Discord application/bot token with the **Server Members Intent** enabled; **Message Content Intent** recommended for automod.

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in your values:
   - `DISCORD_TOKEN` – your bot token (or `BOT_TOKEN` if your host uses that name)
   - `DISCORD_CLIENT_ID` – application ID for the bot
   - `DISCORD_GUILD_ID` – optional; when set, commands register instantly to that guild (recommended for testing). Leave empty to register globally.
   - `MOD_LOG_CHANNEL_ID` – optional; channel ID where Jeeves will post moderation logs
3. Register slash commands with Discord:
   ```bash
   npm run deploy:commands
   ```
4. Run the bot:
   ```bash
   npm run dev
   ```
   For production use:
   ```bash
   npm run build
   npm start
   ```

## Commands
- `/ban user reason?` – Ban a member (DM attempted).
- `/unban user reason?` – Unban a user.
- `/softban user days? reason?` – Ban then immediately unban to prune messages (0–7 days).
- `/forceban user days? reason?` – Ban by ID (even if not in server), optional message prune.
- `/massban user_ids days? reason?` – Ban multiple user IDs (space/comma separated, up to 15).
- `/masskick user_ids reason?` – Kick multiple users by ID (space/comma separated, up to 15).
- `/banlist limit?` – View up to 10 recent bans.
- `/kick user reason?` – Kick a member (DM attempted).
- `/timeout user duration reason?` – Timeout a member (e.g., `30m`, `2h`, `1d`, with DM).
- `/untimeout user reason?` – Remove a timeout.
- `/purge count user?` – Delete recent messages (up to 100) in the current channel; optionally target a specific user.
- `/slowmode duration channel? reset_after? reason?` – Set slowmode (e.g., `10s`, `1m`, `off`), optionally auto-reset.
- `/lockdown state channel? duration? reason?` – Lock or unlock a channel for @everyone, optionally auto-unlocking.
- `/temprole user role duration reason?` – Assign a role temporarily and auto-remove it.
- `/nick user nickname? reset? reason?` – Change or reset a member nickname.
- `/role add|remove user role reason?` – Add or remove a role from a member.
- `/warn user reason` – Add a warning, persisted to disk.
- `/warnings user` – View stored warnings for a member.
- `/clearwarnings user reason?` – Clear all warnings for a member.
- `/delwarn user index reason?` – Remove a single warning by its number (1 = oldest).
- `/note add|list|clear user [note]` – Moderator-only notes for members.
- `/case id|user` – Look up cases by ID or list recent cases for a user.
- `/reason case reason` – Update the reason for an existing case.
- `/userinfo user` – View a member’s roles, warnings, notes, and case counts.
- `/infractions user` – View total infractions (ban/kick/timeout/warning) for a user.
- `/history user` – Consolidated view of warnings, notes, cases, and infractions for a user.
- `/automod add|list|remove` – Manage automod rules (keyword/invite/link) and actions.
- `/config modlog|dm_actions|appeal_dm|show` – Configure mod-log channel and DM/appeal behavior.
- `/backup` – Export Jeeves data to a JSON attachment.
- `/say message channel? allow_mentions?` – Administrators can speak as Jeeves in a channel.
- `/diagnostics` – Check Jeeves’ permissions and mod-log configuration in this server.
- `/help` – Show this command summary in an embed.
- `/ping` – Quick responsiveness check.
- `/report user reason message_link?` – Let members report to the mod-log channel.
- `/appeal set|get` – Configure or retrieve the server appeal link used in DM notices.

## Notes
- For the moderation log, make sure the bot can post in the configured channel.
- Data files live under `data/` (warnings, notes, cases); keep them safe if you redeploy.
- Timeout duration is limited to Discord's 28-day maximum.
- Commands are role-gated: `Administrator` > `Moderator` > `Helper`; higher roles inherit lower access.
