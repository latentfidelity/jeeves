import { promises as fs } from 'fs';
import path from 'path';
import { logAction } from './auditLog';

export type CaseEntry = {
  id: number;
  action: string;
  userId: string;
  moderatorId: string;
  reason?: string;
  createdAt: number;
  context?: Record<string, string>;
};

type CaseStore = {
  lastId: number;
  cases: CaseEntry[];
};

const dataDir = path.join(__dirname, '..', '..', 'data');
const dataFile = path.join(dataDir, 'cases.json');

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    const initial: CaseStore = { lastId: 0, cases: [] };
    await fs.writeFile(dataFile, JSON.stringify(initial, null, 2), 'utf8');
  }
}

async function readStore(): Promise<CaseStore> {
  await ensureDataFile();
  const raw = await fs.readFile(dataFile, 'utf8');
  try {
    return JSON.parse(raw) as CaseStore;
  } catch (error) {
    console.error('Could not parse cases store, recreating file', error);
    const fallback: CaseStore = { lastId: 0, cases: [] };
    await fs.writeFile(dataFile, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }
}

async function writeStore(store: CaseStore): Promise<void> {
  await fs.writeFile(dataFile, JSON.stringify(store, null, 2), 'utf8');
}

export async function addCase(entry: Omit<CaseEntry, 'id' | 'createdAt'>): Promise<CaseEntry> {
  const store = await readStore();
  const id = store.lastId + 1;
  const complete: CaseEntry = {
    ...entry,
    id,
    createdAt: Date.now(),
  };
  store.lastId = id;
  store.cases.push(complete);
  await writeStore(store);
  logAction(complete);
  return complete;
}

export async function getCasesForUser(userId: string): Promise<CaseEntry[]> {
  const store = await readStore();
  return store.cases.filter((entry) => entry.userId === userId);
}

export async function getCase(id: number): Promise<CaseEntry | undefined> {
  const store = await readStore();
  return store.cases.find((entry) => entry.id === id);
}

export async function updateCase(
  id: number,
  updates: Partial<Pick<CaseEntry, 'reason' | 'context'>>,
): Promise<CaseEntry | null> {
  const store = await readStore();
  const index = store.cases.findIndex((entry) => entry.id === id);
  if (index === -1) return null;

  const current = store.cases[index];
  const mergedContext =
    updates.context && current.context
      ? { ...current.context, ...updates.context }
      : updates.context || current.context;

  const updated: CaseEntry = {
    ...current,
    ...(updates.reason !== undefined ? { reason: updates.reason } : {}),
    ...(mergedContext ? { context: mergedContext } : {}),
  };

  store.cases[index] = updated;
  await writeStore(store);
  return updated;
}
