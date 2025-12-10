import { promises as fs } from 'fs';
import path from 'path';

// Credits per guild per user
type CreditStore = Record<string, Record<string, number>>;

const dataDir = path.join(__dirname, '..', '..', 'data');
const dataFile = path.join(dataDir, 'credits.json');

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify({}, null, 2), 'utf8');
  }
}

async function readStore(): Promise<CreditStore> {
  await ensureDataFile();
  const raw = await fs.readFile(dataFile, 'utf8');
  try {
    return JSON.parse(raw) as CreditStore;
  } catch (error) {
    console.error('Could not parse credits store, recreating file', error);
    await fs.writeFile(dataFile, JSON.stringify({}, null, 2), 'utf8');
    return {} as CreditStore;
  }
}

async function writeStore(store: CreditStore): Promise<void> {
  await fs.writeFile(dataFile, JSON.stringify(store, null, 2), 'utf8');
}

export async function getCredits(guildId: string, userId: string): Promise<number> {
  const store = await readStore();
  return store[guildId]?.[userId] ?? 0;
}

export async function addCredits(
  guildId: string,
  userId: string,
  amount: number,
): Promise<number> {
  const store = await readStore();
  if (!store[guildId]) {
    store[guildId] = {};
  }
  const current = store[guildId][userId] ?? 0;
  store[guildId][userId] = current + amount;
  await writeStore(store);
  return store[guildId][userId];
}

export async function deductCredits(
  guildId: string,
  userId: string,
  amount: number,
): Promise<{ success: boolean; remaining: number }> {
  const store = await readStore();
  const current = store[guildId]?.[userId] ?? 0;

  if (current < amount) {
    return { success: false, remaining: current };
  }

  if (!store[guildId]) {
    store[guildId] = {};
  }
  store[guildId][userId] = current - amount;
  await writeStore(store);
  return { success: true, remaining: store[guildId][userId] };
}

export async function setCredits(
  guildId: string,
  userId: string,
  amount: number,
): Promise<number> {
  const store = await readStore();
  if (!store[guildId]) {
    store[guildId] = {};
  }
  store[guildId][userId] = Math.max(0, amount);
  await writeStore(store);
  return store[guildId][userId];
}
