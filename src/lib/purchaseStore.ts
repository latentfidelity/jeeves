import { promises as fs } from 'fs';
import path from 'path';

export type Purchase = {
  sessionId: string;
  guildId: string;
  userId: string;
  tierId: string;
  credits: number;
  amountCents: number;
  timestamp: string;
};

type PurchaseStore = Purchase[];

const dataDir = path.join(__dirname, '..', '..', 'data');
const dataFile = path.join(dataDir, 'purchases.json');

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify([], null, 2), 'utf8');
  }
}

async function readStore(): Promise<PurchaseStore> {
  await ensureDataFile();
  const raw = await fs.readFile(dataFile, 'utf8');
  try {
    return JSON.parse(raw) as PurchaseStore;
  } catch (error) {
    console.error('Could not parse purchases store, recreating file', error);
    await fs.writeFile(dataFile, JSON.stringify([], null, 2), 'utf8');
    return [];
  }
}

async function writeStore(store: PurchaseStore): Promise<void> {
  await fs.writeFile(dataFile, JSON.stringify(store, null, 2), 'utf8');
}

export async function isPurchaseProcessed(sessionId: string): Promise<boolean> {
  const store = await readStore();
  return store.some((p) => p.sessionId === sessionId);
}

export async function recordPurchase(purchase: Purchase): Promise<void> {
  const store = await readStore();
  store.push(purchase);
  await writeStore(store);
}

export async function getPurchasesByUser(
  guildId: string,
  userId: string,
): Promise<Purchase[]> {
  const store = await readStore();
  return store.filter((p) => p.guildId === guildId && p.userId === userId);
}
