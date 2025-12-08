import { getDb } from './db';
import { CaseEntry } from './caseStore';

export function logAction(entry: CaseEntry): void {
  const db = getDb();
  if (!db) return;

  try {
    db.prepare(
      `INSERT INTO mod_actions (action, user_id, moderator_id, reason, created_at, context)
       VALUES (@action, @user_id, @moderator_id, @reason, @created_at, @context);`,
    ).run({
      action: entry.action,
      user_id: entry.userId,
      moderator_id: entry.moderatorId,
      reason: entry.reason || null,
      created_at: entry.createdAt,
      context: entry.context ? JSON.stringify(entry.context) : null,
    });
  } catch (error) {
    console.warn('Failed to log action to database', error);
  }
}
