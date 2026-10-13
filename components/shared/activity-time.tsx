import { formatActivityTimestamp } from '@/lib/format-activity-time';

export function ActivityTime({ timestamp }: { timestamp: string }) {
  return <time dateTime={timestamp}>{formatActivityTimestamp(timestamp)}</time>;
}
