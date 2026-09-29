import { useEffect, useState } from 'react'
import { dayLabel, minutesLeft, timeRange } from './time'

// Shape of a row from GET /api/events. Timestamps arrive as UTC ISO strings.
export interface FoodEvent {
  id: number
  title: string
  location: string
  food: string
  host: string | null
  starts_at: string
  ends_at: string
  created_at: string
}

type Tab = 'now' | 'later'

function App() {
  const [events, setEvents] = useState<FoodEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('now')
  const [posting, setPosting] = useState(false)
  // Kept in state so "happening now" re-evaluates while the page sits open.
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/events', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Server responded ${res.status}`)
        return res.json() as Promise<FoodEvent[]>
      })
      .then((data) => {
        setEvents(data)
        setError(null)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Something went wrong')
      })

    return () => controller.abort()
  }, [])

  const happeningNow = (events ?? []).filter(
    (e) => new Date(e.starts_at) <= now && new Date(e.ends_at) > now,
  )
  const later = (events ?? []).filter((e) => new Date(e.starts_at) > now)
  const shown = tab === 'now' ? happeningNow : later

  return (
    <div className="screen">
      <header className="masthead">
        <p className="kicker">UC Berkeley</p>
        <h1>
          Free
          <br />
          Food
        </h1>
        <p className="standfirst">
          What's out on campus right now. Posts disappear when the food's gone.
        </p>
      </header>

      <nav className="tabs" aria-label="Which events to show">
        <button
          type="button"
          className="tab"
          aria-pressed={tab === 'now'}
          onClick={() => setTab('now')}
        >
          Happening now
          <span className="tally">{events ? happeningNow.length : '–'}</span>
        </button>
        <button
          type="button"
          className="tab"
          aria-pressed={tab === 'later'}
          onClick={() => setTab('later')}
        >
          Later today
          <span className="tally">{events ? later.length : '–'}</span>
        </button>
      </nav>

      <main className="list-wrap">
        {error && (
          <div className="block block--alert" role="alert">
            <p className="block__title">Couldn't load events</p>
            <p className="block__body">{error}</p>
            <button type="button" className="btn btn--ghost" onClick={() => location.reload()}>
              Try again
            </button>
          </div>
        )}

        {!error && events === null && (
          <ul className="list" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className="skeleton">
                <span className="skeleton__bar skeleton__bar--title" />
                <span className="skeleton__bar skeleton__bar--meta" />
                <span className="skeleton__bar skeleton__bar--meta short" />
              </li>
            ))}
          </ul>
        )}

        {!error && events !== null && shown.length === 0 && (
          <div className="block block--empty">
            <p className="block__title">
              {tab === 'now' ? 'Nothing out right now.' : 'Nothing else lined up today.'}
            </p>
            <p className="block__body">
              {tab === 'now' && later.length > 0
                ? `But ${later.length} event${later.length > 1 ? 's are' : ' is'} coming up later.`
                : 'Know about free food? Be the one who posts it.'}
            </p>
            {tab === 'now' && later.length > 0 && (
              <button type="button" className="btn btn--ghost" onClick={() => setTab('later')}>
                See what's later
              </button>
            )}
          </div>
        )}

        {!error && events !== null && shown.length > 0 && (
          <ul className="list">
            {shown.map((event) => (
              <li key={event.id} className="event">
                <div className="event__time">
                  <span className="event__range">{timeRange(event.starts_at, event.ends_at)}</span>
                  {tab === 'now' ? (
                    <span className="flag">
                      {Math.max(minutesLeft(event.ends_at, now), 0)} min left
                    </span>
                  ) : (
                    <span className="event__day">{dayLabel(event.starts_at, now)}</span>
                  )}
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
            ))}
          </ul>
        )}
      </main>

      <button type="button" className="post-fab" onClick={() => setPosting(true)}>
        Post food
      </button>

      {posting && <PostSheet onClose={() => setPosting(false)} />}
    </div>
  )
}

/** v0 placeholder: real layout and states, but the fields aren't wired to the API yet. */
function PostSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Post free food">
      <div className="sheet__bar">
        <p className="sheet__title">Post food</p>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="sheet__body">
        <p className="placeholder">[form fields — v0 placeholder]</p>
        <p className="placeholder placeholder--note">
          Title · Location · Food · Host (optional) · Start · End
        </p>
        <button type="button" className="btn btn--solid" disabled>
          Post it (not wired yet)
        </button>
      </div>
    </div>
  )
}

export default App
