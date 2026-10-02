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

/** A non-2xx response, with whatever the server said about it. */
export class ApiError extends Error {
  status: number
  /** Per-field messages from a 400, keyed by API field name (title, starts_at, ...). */
  fields?: Record<string, string>
  /** From a 429: how long to wait. */
  retryAfterSeconds?: number

  constructor(status: number, message: string, extra?: { fields?: Record<string, string>; retryAfterSeconds?: number }) {
    super(message)
    this.status = status
    this.fields = extra?.fields
    this.retryAfterSeconds = extra?.retryAfterSeconds
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: { error?: string; fields?: Record<string, string>; retryAfterSeconds?: number } = {}
  try {
    body = await res.json()
  } catch {
    // Not JSON (e.g. a proxy error page). The status code is all we have.
  }
  return new ApiError(res.status, body.error ?? `Server responded ${res.status}`, {
    fields: body.fields,
    retryAfterSeconds: body.retryAfterSeconds,
  })
}

export async function listEvents(signal?: AbortSignal): Promise<FoodEvent[]> {
  const res = await fetch('/api/events', { signal })
  if (!res.ok) throw await toApiError(res)
  return res.json()
}

export async function createEvent(event: NewEvent): Promise<FoodEvent> {
  const res = await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  })
  if (!res.ok) throw await toApiError(res)
  return res.json()
}
