import dotenv from 'dotenv';

dotenv.config();

export type OpenRouterConfig = {
  apiKey?: string;
  model: string;
  siteUrl?: string;
  appName?: string;
};

export type BotConfig = {
  token: string;
  clientId: string;
  guildId?: string;
  modLogChannelId?: string;
  openRouter: OpenRouterConfig;
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

const openRouter: OpenRouterConfig = {
  apiKey: process.env.OPENROUTER_API_KEY,
  model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
  siteUrl: process.env.OPENROUTER_SITE_URL,
  appName: process.env.OPENROUTER_APP_NAME,
};

const config: BotConfig = {
  token,
  clientId,
  guildId: process.env.DISCORD_GUILD_ID,
  modLogChannelId: process.env.MOD_LOG_CHANNEL_ID,
  openRouter,
};

export default config;
