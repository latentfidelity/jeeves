import { promises as fs } from 'fs';
import path from 'path';

export type AutomodAction = 'delete' | 'warn' | 'timeout';
export type AutomodType = 'keyword' | 'invite' | 'link';

export type AutomodRule = {
  id: string;
  type: AutomodType;
  pattern?: string;
  action: AutomodAction;
  timeoutMs?: number;
  reason?: string;
};

type AutomodStore = Record<string, AutomodRule[]>;

const dataDir = path.join(__dirname, '..', '..', 'data');
const dataFile = path.join(dataDir, 'automod.json');

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify({}, null, 2), 'utf8');
  }
}

async function readStore(): Promise<AutomodStore> {
  await ensureDataFile();
  const raw = await fs.readFile(dataFile, 'utf8');
  try {
    return JSON.parse(raw) as AutomodStore;
  } catch (error) {
    console.error('Could not parse automod store, recreating file', error);
    await fs.writeFile(dataFile, JSON.stringify({}, null, 2), 'utf8');
    return {};
  }
}

async function writeStore(store: AutomodStore): Promise<void> {
  await fs.writeFile(dataFile, JSON.stringify(store, null, 2), 'utf8');
}

function createRuleId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export async function listRules(guildId: string): Promise<AutomodRule[]> {
  const store = await readStore();
  return store[guildId] ?? [];
}

export async function addRule(
  guildId: string,
  rule: Omit<AutomodRule, 'id'>,
): Promise<AutomodRule> {
  const store = await readStore();
  if (!store[guildId]) store[guildId] = [];
  const newRule: AutomodRule = { ...rule, id: createRuleId() };
  store[guildId].push(newRule);
  await writeStore(store);
  return newRule;
}

export async function removeRule(guildId: string, id: string): Promise<boolean> {
  const store = await readStore();
  if (!store[guildId]) return false;
  const before = store[guildId].length;
  store[guildId] = store[guildId].filter((rule) => rule.id !== id);
  const changed = store[guildId].length !== before;
  if (changed) {
    await writeStore(store);
  }
  return changed;
}
