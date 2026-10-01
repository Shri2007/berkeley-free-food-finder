import { Fragment, useCallback, useEffect, useState } from 'react'
import { listEvents, type FoodEvent } from './api'
import { EventRow } from './EventRow'
import { PostSheet } from './PostSheet'
import { dayLabel } from './time'

type Tab = 'now' | 'later'

function App() {
  const [events, setEvents] = useState<FoodEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('now')
  const [posting, setPosting] = useState(false)
  const [freshId, setFreshId] = useState<number | null>(null)
  // Kept in state so "happening now" re-evaluates while the page sits open.
  const [now, setNow] = useState(() => new Date())

  const load = useCallback((signal?: AbortSignal) => {
    return listEvents(signal)
      .then((data) => {
        setEvents(data)
        setError(null)
      })
      .catch((err: unknown) => {
        if (signal?.aborted) return
        // A failed background refresh shouldn't wipe a list we already have;
        // the next refresh will quietly catch up. Only the first load shows an error.
        setEvents((prev) => {
          if (prev === null) setError(err instanceof Error ? err.message : 'Something went wrong')
          return prev
        })
      })
  }, [])

  // First load.
  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  // Keep the list honest while the tab sits open: tick the clock every 30s,
  // refetch every minute, and refetch when the phone comes back to the page.
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30_000)
    const refresh = setInterval(() => load(), 60_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setNow(new Date())
        load()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(tick)
      clearInterval(refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const all = events ?? []
  const happeningNow = all.filter(
    (e) => new Date(e.starts_at) <= now && new Date(e.ends_at) > now,
  )
  const later = all.filter((e) => new Date(e.starts_at) > now)
  const shown = tab === 'now' ? happeningNow : later

  function handlePosted(created: FoodEvent) {
    setPosting(false)
    setEvents((prev) => [...(prev ?? []), created].sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    ))
    const current = new Date()
    setNow(current)
    setTab(new Date(created.starts_at) <= current ? 'now' : 'later')
    setFreshId(created.id)
    window.scrollTo({ top: 0 })
  }

  // In the "later" tab, drop a day header whenever the day changes.
  // Today's events need no header: the tab name already says it.
  const rows = shown.map((event, i, arr) => {
    if (tab !== 'later') return { event, i, day: null as string | null }
    const day = dayLabel(event.starts_at, now)
    const prevDay = i > 0 ? dayLabel(arr[i - 1].starts_at, now) : 'Today'
    return { event, i, day: day !== 'Today' && day !== prevDay ? day : null }
  })

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
          <span className="tally">{events ? happeningNow.length : '…'}</span>
        </button>
        <button
          type="button"
          className="tab"
          aria-pressed={tab === 'later'}
          onClick={() => setTab('later')}
        >
          Later today
          <span className="tally">{events ? later.length : '…'}</span>
        </button>
      </nav>

      <main className="list-wrap" aria-live="polite">
        {error && (
          <div className="block block--alert" role="alert">
            <p className="block__title">Couldn't load events</p>
            <p className="block__body">{error}</p>
            <button type="button" className="btn btn--ghost btn--on-ink" onClick={() => load()}>
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
              {tab === 'now' ? 'Nothing out right now.' : 'Nothing else lined up.'}
            </p>
            <p className="block__body">
              {tab === 'now' && later.length > 0
                ? `${later.length} ${later.length === 1 ? 'event is' : 'events are'} coming up later.`
                : 'Know about free food? Be the one who posts it.'}
            </p>
            {tab === 'now' && later.length > 0 ? (
              <button type="button" className="btn btn--ghost" onClick={() => setTab('later')}>
                See what's later
              </button>
            ) : (
              <button type="button" className="btn btn--ghost" onClick={() => setPosting(true)}>
                Post food
              </button>
            )}
          </div>
        )}

        {!error && events !== null && shown.length > 0 && (
          <ul className="list">
            {rows.map(({ event, i, day }) => (
              <Fragment key={event.id}>
                {day && <li className="day-head">{day}</li>}
                <EventRow
                  event={event}
                  now={now}
                  live={tab === 'now'}
                  index={i}
                  fresh={event.id === freshId}
                />
              </Fragment>
            ))}
          </ul>
        )}
      </main>

      <button type="button" className="post-fab" onClick={() => setPosting(true)}>
        Post food
      </button>

      {posting && <PostSheet onClose={() => setPosting(false)} onPosted={handlePosted} />}
    </div>
  )
}

export default App
