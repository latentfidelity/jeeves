import { promises as fs } from 'fs';
import path from 'path';

export type WarningEntry = {
  reason: string;
  moderatorId: string;
  createdAt: number;
};

type WarningStore = Record<string, Record<string, WarningEntry[]>>;

const dataDir = path.join(__dirname, '..', '..', 'data');
const dataFile = path.join(dataDir, 'warnings.json');

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify({}, null, 2), 'utf8');
  }
}

async function readStore(): Promise<WarningStore> {
  await ensureDataFile();
  const raw = await fs.readFile(dataFile, 'utf8');
  try {
    return JSON.parse(raw) as WarningStore;
  } catch (error) {
    console.error('Could not parse warnings store, recreating file', error);
    await fs.writeFile(dataFile, JSON.stringify({}, null, 2), 'utf8');
    return {} as WarningStore;
  }
}

async function writeStore(store: WarningStore): Promise<void> {
  await fs.writeFile(dataFile, JSON.stringify(store, null, 2), 'utf8');
}

export async function addWarning(
  guildId: string,
  userId: string,
  entry: WarningEntry,
): Promise<WarningEntry[]> {
  const store = await readStore();
  if (!store[guildId]) {
    store[guildId] = {};
  }
  if (!store[guildId][userId]) {
    store[guildId][userId] = [];
  }

  store[guildId][userId].push(entry);
  await writeStore(store);
  return store[guildId][userId];
}

export async function getWarnings(guildId: string, userId: string): Promise<WarningEntry[]> {
  const store = await readStore();
  return store[guildId]?.[userId] ?? [];
}

export async function clearWarnings(guildId: string, userId: string): Promise<void> {
  const store = await readStore();
  if (store[guildId]?.[userId]) {
    delete store[guildId][userId];
    await writeStore(store);
  }
}

export async function removeWarning(
  guildId: string,
  userId: string,
  zeroBasedIndex: number,
): Promise<{ success: boolean; remaining: WarningEntry[]; removed?: WarningEntry }> {
  const store = await readStore();
  const list = store[guildId]?.[userId];
  if (!list || zeroBasedIndex < 0 || zeroBasedIndex >= list.length) {
    return { success: false, remaining: list ?? [] };
  }

  const [removed] = list.splice(zeroBasedIndex, 1);

  if (list.length === 0) {
    delete store[guildId][userId];
  }

  await writeStore(store);
  return { success: true, remaining: list ?? [], removed };
}
