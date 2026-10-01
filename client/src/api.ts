// The only place the client talks to the server.

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

export interface NewEvent {
  title: string
  location: string
  food: string
  host: string | null
  starts_at: string
  ends_at: string
}

export async function listEvents(signal?: AbortSignal): Promise<FoodEvent[]> {
  const res = await fetch('/api/events', { signal })
  if (!res.ok) throw new Error(`Server responded ${res.status}`)
  return res.json()
}

export async function createEvent(event: NewEvent): Promise<FoodEvent> {
  const res = await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  })
  if (!res.ok) throw new Error(`Server responded ${res.status}`)
  return res.json()
}
