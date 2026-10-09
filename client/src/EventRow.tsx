import type { FoodEvent } from './api'
import { clockTime, minutesLeft, timeAgo, timeRange } from './time'

interface Props {
  event: FoodEvent
  now: Date
  live: boolean
  /** The row the user just posted gets a one-time highlight. */
  fresh?: boolean
}

function liveLabel(event: FoodEvent, now: Date) {
  const left = Math.max(minutesLeft(event.ends_at, now), 0)
  // Past 90 minutes a countdown stops meaning much; the end time reads better.
  return left <= 90 ? `${left} min left` : `until ${clockTime(event.ends_at)}`
}

export function EventRow({ event, now, live, fresh }: Props) {
  return (
    <li className={`row${fresh ? ' row--fresh' : ''}`}>
      <div className="row__head">
        <h3 className="row__title">{event.title}</h3>
        {live && (
          <span className="tag tag--live">
            <span className="tag__dot" aria-hidden="true" />
            {liveLabel(event, now)}
          </span>
        )}
      </div>
      <p className="row__meta">
        <span className="row__time">{timeRange(event.starts_at, event.ends_at)}</span>
        <span className="row__sep" aria-hidden="true">
          ·
        </span>
        <span>{event.location}</span>
      </p>
      <p className="row__food">{event.food}</p>
      <p className="row__posted">
        posted {timeAgo(event.created_at, now)}
        {event.host && ` by ${event.host}`}
      </p>
    </li>
  )
}
