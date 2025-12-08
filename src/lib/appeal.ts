import { promises as fs } from 'fs';
import path from 'path';

export type AppealLink = {
  url: string;
  label?: string;
  updatedAt: number;
};

const dataDir = path.join(__dirname, '..', '..', 'data');
const dataFile = path.join(dataDir, 'appeal.json');

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify({}, null, 2), 'utf8');
  }
}

async function readStore(): Promise<Record<string, AppealLink>> {
  await ensureDataFile();
  const raw = await fs.readFile(dataFile, 'utf8');
  try {
    return JSON.parse(raw) as Record<string, AppealLink>;
  } catch (error) {
    console.error('Could not parse appeal store, recreating file', error);
    await fs.writeFile(dataFile, JSON.stringify({}, null, 2), 'utf8');
    return {};
  }
}

async function writeStore(store: Record<string, AppealLink>): Promise<void> {
  await fs.writeFile(dataFile, JSON.stringify(store, null, 2), 'utf8');
}

export async function setAppealLink(guildId: string, link: AppealLink): Promise<void> {
  const store = await readStore();
  store[guildId] = link;
  await writeStore(store);
}

export async function getAppealLink(guildId: string): Promise<AppealLink | null> {
  const store = await readStore();
  return store[guildId] ?? null;
}
