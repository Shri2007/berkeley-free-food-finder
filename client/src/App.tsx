import { useEffect, useState } from 'react'

// Shape of a row from GET /api/events. Timestamps arrive as UTC ISO strings.
interface FoodEvent {
  id: number
  title: string
  location: string
  food: string
  host: string | null
  starts_at: string
  ends_at: string
  created_at: string
}

// Always show Berkeley time, whatever time zone the viewer's device is in.
const timeFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function formatTimeRange(startsAt: string, endsAt: string) {
  // formatRange skips repeating the date when both ends are on the same day.
  return timeFormat.formatRange(new Date(startsAt), new Date(endsAt))
}

function App() {
  const [events, setEvents] = useState<FoodEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Cancel the request if the component unmounts (StrictMode mounts twice in dev).
    const controller = new AbortController()

    fetch('/api/events', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Server responded ${res.status}`)
        return res.json() as Promise<FoodEvent[]>
      })
      .then(setEvents)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Something went wrong')
      })

    return () => controller.abort()
  }, [])

  return (
    <main>
      <h1>Berkeley Free Food</h1>

      {error && <p className="status">Couldn't load events: {error}</p>}
      {!error && events === null && <p className="status">Loading…</p>}
      {events?.length === 0 && <p className="status">No free food right now. Check back soon!</p>}

      {events && events.length > 0 && (
        <ul className="events">
          {events.map((event) => (
            <li key={event.id} className="event">
              <h2>{event.title}</h2>
              <p className="time">{formatTimeRange(event.starts_at, event.ends_at)}</p>
              <p>
                <strong>Where:</strong> {event.location}
              </p>
              <p>
                <strong>Food:</strong> {event.food}
              </p>
              {event.host && (
                <p>
                  <strong>Host:</strong> {event.host}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default App
