import { promises as fs } from 'fs';
import path from 'path';

export type ChatConfig = {
  enabled: boolean;
  channelId: string;
  model: string;
  chance: number; // 0-100, percentage chance to reply
};

type ChatStore = Record<string, ChatConfig>;

const dataDir = path.join(__dirname, '..', '..', 'data');
const dataFile = path.join(dataDir, 'chat.json');

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify({}, null, 2), 'utf8');
  }
}

async function readStore(): Promise<ChatStore> {
  await ensureDataFile();
  const raw = await fs.readFile(dataFile, 'utf8');
  try {
    return JSON.parse(raw) as ChatStore;
  } catch (error) {
    console.error('Could not parse chat store, recreating file', error);
    await fs.writeFile(dataFile, JSON.stringify({}, null, 2), 'utf8');
    return {};
  }
}

async function writeStore(store: ChatStore): Promise<void> {
  await fs.writeFile(dataFile, JSON.stringify(store, null, 2), 'utf8');
}

export async function getChatConfig(guildId: string): Promise<ChatConfig | null> {
  const store = await readStore();
  return store[guildId] || null;
}

export async function setChatConfig(guildId: string, config: ChatConfig): Promise<ChatConfig> {
  const store = await readStore();
  store[guildId] = config;
  await writeStore(store);
  return config;
}

export async function disableChat(guildId: string): Promise<void> {
  const store = await readStore();
  if (store[guildId]) {
    store[guildId].enabled = false;
    await writeStore(store);
  }
}

export async function getAllEnabledChats(): Promise<Array<{ guildId: string; config: ChatConfig }>> {
  const store = await readStore();
  return Object.entries(store)
    .filter(([, config]) => config.enabled)
    .map(([guildId, config]) => ({ guildId, config }));
}
