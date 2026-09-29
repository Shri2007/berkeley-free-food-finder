// Every display format is pinned to Berkeley time, whatever the device is set to.
const TZ = 'America/Los_Angeles'

const timeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hour: 'numeric',
  minute: '2-digit',
})

const dayFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

// en-CA gives YYYY-MM-DD, which is easy to compare for "same day in Berkeley".
const dayKeyFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function dayKey(date: Date) {
  return dayKeyFmt.format(date)
}

/** "2:30 – 4:00 PM" — formatRange drops the repeated AM/PM and date on its own. */
export function timeRange(startsAt: string, endsAt: string) {
  return timeFmt.formatRange(new Date(startsAt), new Date(endsAt))
}

/** "Today", "Tomorrow", or "Fri, Oct 3" — only shown when an event isn't today. */
export function dayLabel(startsAt: string, now: Date) {
  const start = new Date(startsAt)
  const startKey = dayKey(start)
  if (startKey === dayKey(now)) return 'Today'

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  if (startKey === dayKey(tomorrow)) return 'Tomorrow'

  return dayFmt.format(start)
}

/** Minutes left until an event ends, rounded down. */
export function minutesLeft(endsAt: string, now: Date) {
  return Math.floor((new Date(endsAt).getTime() - now.getTime()) / 60000)
}
