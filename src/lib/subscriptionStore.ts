import { promises as fs } from 'fs';
import path from 'path';

export type Subscription = {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  guildId: string;
  userId: string;
  tierId: string;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid';
  currentPeriodEnd: string;
  createdAt: string;
  updatedAt: string;
};

// Keyed by guildId -> userId -> Subscription
type SubscriptionStore = Record<string, Record<string, Subscription>>;

const dataDir = path.join(__dirname, '..', '..', 'data');
const dataFile = path.join(dataDir, 'subscriptions.json');

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify({}, null, 2), 'utf8');
  }
}

async function readStore(): Promise<SubscriptionStore> {
  await ensureDataFile();
  const raw = await fs.readFile(dataFile, 'utf8');
  try {
    return JSON.parse(raw) as SubscriptionStore;
  } catch (error) {
    console.error('Could not parse subscriptions store, recreating file', error);
    await fs.writeFile(dataFile, JSON.stringify({}, null, 2), 'utf8');
    return {};
  }
}

async function writeStore(store: SubscriptionStore): Promise<void> {
  await fs.writeFile(dataFile, JSON.stringify(store, null, 2), 'utf8');
}

export async function getSubscription(
  guildId: string,
  userId: string,
): Promise<Subscription | null> {
  const store = await readStore();
  return store[guildId]?.[userId] ?? null;
}

export async function getSubscriptionByStripeId(
  stripeSubscriptionId: string,
): Promise<Subscription | null> {
  const store = await readStore();
  for (const guildSubs of Object.values(store)) {
    for (const sub of Object.values(guildSubs)) {
      if (sub.stripeSubscriptionId === stripeSubscriptionId) {
        return sub;
      }
    }
  }
  return null;
}

export async function upsertSubscription(sub: Subscription): Promise<void> {
  const store = await readStore();
  if (!store[sub.guildId]) {
    store[sub.guildId] = {};
  }
  store[sub.guildId][sub.userId] = sub;
  await writeStore(store);
}

export async function updateSubscriptionStatus(
  stripeSubscriptionId: string,
  status: Subscription['status'],
  currentPeriodEnd?: string,
): Promise<Subscription | null> {
  const store = await readStore();
  for (const guildId of Object.keys(store)) {
    for (const userId of Object.keys(store[guildId])) {
      if (store[guildId][userId].stripeSubscriptionId === stripeSubscriptionId) {
        store[guildId][userId].status = status;
        store[guildId][userId].updatedAt = new Date().toISOString();
        if (currentPeriodEnd) {
          store[guildId][userId].currentPeriodEnd = currentPeriodEnd;
        }
        await writeStore(store);
        return store[guildId][userId];
      }
    }
  }
  return null;
}

export async function deleteSubscription(
  guildId: string,
  userId: string,
): Promise<boolean> {
  const store = await readStore();
  if (store[guildId]?.[userId]) {
    delete store[guildId][userId];
    await writeStore(store);
    return true;
  }
  return false;
}

export async function hasActiveSubscription(
  guildId: string,
  userId: string,
): Promise<boolean> {
  const sub = await getSubscription(guildId, userId);
  return sub?.status === 'active';
}
