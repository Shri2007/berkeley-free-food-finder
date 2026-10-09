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

// Numeric parts of a moment as seen on a Berkeley clock.
const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export function dayKey(date: Date) {
  return dayKeyFmt.format(date)
}

/** "2:30 – 4:00 PM". formatRange drops the repeated AM/PM on its own. */
export function timeRange(startsAt: string, endsAt: string) {
  return timeFmt.formatRange(new Date(startsAt), new Date(endsAt))
}

/** "4:00 PM" */
export function clockTime(iso: string) {
  return timeFmt.format(new Date(iso))
}

/** "Today", "Tomorrow", or "Fri, Oct 3". */
export function dayLabel(startsAt: string, now: Date) {
  const start = new Date(startsAt)
  const startKey = dayKey(start)
  if (startKey === dayKey(now)) return 'Today'

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  if (startKey === dayKey(tomorrow)) return 'Tomorrow'

  return dayFmt.format(start)
}

/** "just now", "3m ago", "2h ago", "yesterday". For the posted-at metadata line. */
export function timeAgo(iso: string, now: Date) {
  const mins = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

/** Minutes left until an event ends, rounded down. */
export function minutesLeft(endsAt: string, now: Date) {
  return Math.floor((new Date(endsAt).getTime() - now.getTime()) / 60000)
}

function berkeleyParts(date: Date) {
  const p: Record<string, number> = {}
  for (const { type, value } of partsFmt.formatToParts(date)) {
    if (type !== 'literal') p[type] = Number(value)
  }
  return p
}

/**
 * A Date -> the "YYYY-MM-DDTHH:MM" string a <input type="datetime-local"> wants,
 * expressed in Berkeley wall-clock time.
 */
export function toBerkeleyInput(date: Date) {
  const p = berkeleyParts(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

/**
 * The reverse: treat a datetime-local string as Berkeley wall-clock time and
 * return the real instant. Works out the UTC offset for that date, so DST is
 * handled, and the poster's phone time zone never matters.
 */
export function fromBerkeleyInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (!m) return null
  const [, y, mo, d, h, mi] = m.map(Number)
  const wanted = Date.UTC(y, mo - 1, d, h, mi)

  // Start from "as if UTC", see what Berkeley clock that shows, and correct.
  // Two passes settle the DST-boundary case.
  let guess = wanted
  for (let i = 0; i < 2; i++) {
    const p = berkeleyParts(new Date(guess))
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
    guess += wanted - shown
  }
  return new Date(guess)
}

/** Round a Date down to the nearest 5 minutes. Keeps default form times tidy. */
export function roundDownTo5(date: Date) {
  const ms = 5 * 60 * 1000
  return new Date(Math.floor(date.getTime() / ms) * ms)
}
