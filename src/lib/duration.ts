const unitToMs: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // 28 days per Discord API limit

export function parseDuration(input: string): number | null {
  const trimmed = input.trim();
  const match = /^(\d+)([smhd])$/i.exec(trimmed);

  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const ms = amount * unitToMs[unit];

  if (!Number.isFinite(ms)) {
    return null;
  }

  return ms;
}

export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.round(ms / (60 * 1000));
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(ms / (60 * 60 * 1000));
  if (hours < 24) return `${hours}h`;

  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  return `${days}d`;
}
