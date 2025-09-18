export function calculateDaysPending(createdAt: string): number {
  const now = new Date();
  const created = new Date(createdAt);
  const timeDiff = now.getTime() - created.getTime();
  return Math.floor(timeDiff / (1000 * 3600 * 24));
}

export function formatDaysPending(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}