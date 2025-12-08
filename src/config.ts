import dotenv from 'dotenv';

dotenv.config();

export type BotConfig = {
  token: string;
  clientId: string;
  guildId?: string;
  modLogChannelId?: string;
};

// Support both DISCORD_TOKEN (preferred) and BOT_TOKEN (common in some hosts)
const token = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token) {
  throw new Error('Missing DISCORD_TOKEN (or BOT_TOKEN) in environment');
}

if (!clientId) {
  throw new Error('Missing DISCORD_CLIENT_ID in environment');
}

const config: BotConfig = {
  token,
  clientId,
  guildId: process.env.DISCORD_GUILD_ID,
  modLogChannelId: process.env.MOD_LOG_CHANNEL_ID,
};

export default config;
