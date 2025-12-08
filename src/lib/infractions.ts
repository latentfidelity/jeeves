import { promises as fs } from 'fs';
import path from 'path';

export type InfractionType = 'ban' | 'kick' | 'timeout' | 'warning';

export type Infraction = {
  type: InfractionType;
  count: number;
  lastUpdated: number;
};

type InfractionsStore = Record<string, Record<string, Infraction[]>>;

const dataDir = path.join(__dirname, '..', '..', 'data');
const dataFile = path.join(dataDir, 'infractions.json');

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify({}, null, 2), 'utf8');
  }
}

async function readStore(): Promise<InfractionsStore> {
  await ensureDataFile();
  const raw = await fs.readFile(dataFile, 'utf8');
  try {
    return JSON.parse(raw) as InfractionsStore;
  } catch (error) {
    console.error('Could not parse infractions store, recreating file', error);
    await fs.writeFile(dataFile, JSON.stringify({}, null, 2), 'utf8');
    return {} as InfractionsStore;
  }
}

async function writeStore(store: InfractionsStore): Promise<void> {
  await fs.writeFile(dataFile, JSON.stringify(store, null, 2), 'utf8');
}

export async function addInfraction(
  guildId: string,
  userId: string,
  type: InfractionType,
  increment = 1,
): Promise<Infraction[]> {
  const store = await readStore();
  if (!store[guildId]) store[guildId] = {};
  if (!store[guildId][userId]) store[guildId][userId] = [];

  const existing = store[guildId][userId].find((inf) => inf.type === type);
  if (existing) {
    existing.count += increment;
    existing.lastUpdated = Date.now();
  } else {
    store[guildId][userId].push({ type, count: increment, lastUpdated: Date.now() });
  }

  await writeStore(store);
  return store[guildId][userId];
}

export async function getInfractions(
  guildId: string,
  userId: string,
): Promise<Infraction[]> {
  const store = await readStore();
  return store[guildId]?.[userId] ?? [];
}
