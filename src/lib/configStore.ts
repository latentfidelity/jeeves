import { promises as fs } from 'fs';
import path from 'path';

export type GuildConfig = {
  modLogChannelId?: string;
  dmActions?: boolean;
  includeAppealInDm?: boolean;
};

type ConfigStore = Record<string, GuildConfig>;

const dataDir = path.join(__dirname, '..', '..', 'data');
const dataFile = path.join(dataDir, 'config.json');

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify({}, null, 2), 'utf8');
  }
}

async function readStore(): Promise<ConfigStore> {
  await ensureDataFile();
  const raw = await fs.readFile(dataFile, 'utf8');
  try {
    return JSON.parse(raw) as ConfigStore;
  } catch (error) {
    console.error('Could not parse config store, recreating file', error);
    await fs.writeFile(dataFile, JSON.stringify({}, null, 2), 'utf8');
    return {};
  }
}

async function writeStore(store: ConfigStore): Promise<void> {
  await fs.writeFile(dataFile, JSON.stringify(store, null, 2), 'utf8');
}

const defaultConfig: GuildConfig = {
  dmActions: true,
  includeAppealInDm: true,
};

export async function getGuildConfig(guildId: string): Promise<GuildConfig> {
  const store = await readStore();
  return { ...defaultConfig, ...(store[guildId] || {}) };
}

export async function updateGuildConfig(guildId: string, updates: Partial<GuildConfig>): Promise<GuildConfig> {
  const store = await readStore();
  const merged = { ...defaultConfig, ...(store[guildId] || {}), ...updates };
  store[guildId] = merged;
  await writeStore(store);
  return merged;
}

export async function setModLogChannel(guildId: string, channelId?: string): Promise<GuildConfig> {
  return updateGuildConfig(guildId, { modLogChannelId: channelId });
}

export async function setDmActionsEnabled(guildId: string, enabled: boolean): Promise<GuildConfig> {
  return updateGuildConfig(guildId, { dmActions: enabled });
}

export async function setIncludeAppealInDm(guildId: string, enabled: boolean): Promise<GuildConfig> {
  return updateGuildConfig(guildId, { includeAppealInDm: enabled });
}
