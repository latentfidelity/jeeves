import { promises as fs } from 'fs';
import path from 'path';

const dataDir = path.join(__dirname, '..', '..', 'data');

const filesToInclude = [
  'warnings.json',
  'notes.json',
  'cases.json',
  'infractions.json',
  'appeal.json',
  'config.json',
  'automod.json',
  'schedule.json',
];

async function readIfExists(filename: string): Promise<any> {
  const filePath = path.join(dataDir, filename);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function buildBackupBuffer(): Promise<Buffer> {
  const snapshot: Record<string, any> = {
    createdAt: new Date().toISOString(),
    files: {},
  };

  for (const file of filesToInclude) {
    snapshot.files[file] = await readIfExists(file);
  }

  const json = JSON.stringify(snapshot, null, 2);
  return Buffer.from(json, 'utf8');
}
