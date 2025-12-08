import { promises as fs } from 'fs';
import path from 'path';

export type NoteEntry = {
  note: string;
  moderatorId: string;
  createdAt: number;
};

type NoteStore = Record<string, Record<string, NoteEntry[]>>;

const dataDir = path.join(__dirname, '..', '..', 'data');
const dataFile = path.join(dataDir, 'notes.json');

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify({}, null, 2), 'utf8');
  }
}

async function readStore(): Promise<NoteStore> {
  await ensureDataFile();
  const raw = await fs.readFile(dataFile, 'utf8');
  try {
    return JSON.parse(raw) as NoteStore;
  } catch (error) {
    console.error('Could not parse notes store, recreating file', error);
    await fs.writeFile(dataFile, JSON.stringify({}, null, 2), 'utf8');
    return {} as NoteStore;
  }
}

async function writeStore(store: NoteStore): Promise<void> {
  await fs.writeFile(dataFile, JSON.stringify(store, null, 2), 'utf8');
}

export async function addNote(
  guildId: string,
  userId: string,
  entry: NoteEntry,
): Promise<NoteEntry[]> {
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

export async function getNotes(guildId: string, userId: string): Promise<NoteEntry[]> {
  const store = await readStore();
  return store[guildId]?.[userId] ?? [];
}

export async function clearNotes(guildId: string, userId: string): Promise<void> {
  const store = await readStore();
  if (store[guildId]?.[userId]) {
    delete store[guildId][userId];
    await writeStore(store);
  }
}
