import type { FoodEvent } from './api'
import { clockTime, minutesLeft, timeRange } from './time'

interface Props {
  event: FoodEvent
  now: Date
  live: boolean
  /** Position in the list, drives the staggered entry. */
  index: number
  /** The row the user just posted gets a one-time flash. */
  fresh?: boolean
}

function liveFlag(event: FoodEvent, now: Date) {
  const left = Math.max(minutesLeft(event.ends_at, now), 0)
  // Past 90 minutes a countdown stops meaning much; the end time reads better.
  return left <= 90 ? `${left} min left` : `until ${clockTime(event.ends_at)}`
}

export function EventRow({ event, now, live, index, fresh }: Props) {
  return (
    <li
      className={`event${fresh ? ' event--fresh' : ''}`}
      style={{ '--i': index } as React.CSSProperties}
    >
      <div className="event__time">
        <span className="event__range">{timeRange(event.starts_at, event.ends_at)}</span>
        {live && <span className="flag">{liveFlag(event, now)}</span>}
      </div>
      <h2 className="event__title">{event.title}</h2>
      <dl className="event__facts">
        <div>
          <dt>Where</dt>
          <dd>{event.location}</dd>
        </div>
        <div>
          <dt>Food</dt>
          <dd>{event.food}</dd>
        </div>
        {event.host && (
          <div>
            <dt>Host</dt>
            <dd>{event.host}</dd>
          </div>
        )}
      </dl>
    </li>
  )
}
