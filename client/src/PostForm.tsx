import { useId, useState, type FormEvent } from 'react'
import { LIMITS } from '../../shared/limits'
import { ApiError, createEvent, type FoodEvent } from './api'
import { fromBerkeleyInput, roundDownTo5, toBerkeleyInput } from './time'

interface Props {
  onPosted: (event: FoodEvent) => void
  /** When set, a Cancel button appears (the form is inside a sheet). */
  onCancel?: () => void
}

const DURATIONS = [
  { label: '30 min', minutes: 30 },
  { label: '1 hr', minutes: 60 },
  { label: '2 hrs', minutes: 120 },
  { label: '3 hrs', minutes: 180 },
]

type Errors = Partial<Record<'title' | 'location' | 'food' | 'host' | 'starts' | 'ends', string>>

// Defaults: starting now, for an hour. Most posts are "there's food here, come".
function defaultTimes() {
  const start = roundDownTo5(new Date())
  return {
    starts: toBerkeleyInput(start),
    ends: toBerkeleyInput(new Date(start.getTime() + 60 * 60_000)),
  }
}

export function PostForm({ onPosted, onCancel }: Props) {
  const id = useId()

  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [food, setFood] = useState('')
  const [host, setHost] = useState('')
  const [times, setTimes] = useState(defaultTimes)

  const [errors, setErrors] = useState<Errors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function setDuration(minutes: number) {
    const start = fromBerkeleyInput(times.starts)
    if (!start) return
    setTimes((t) => ({ ...t, ends: toBerkeleyInput(new Date(start.getTime() + minutes * 60_000)) }))
    setErrors((e) => ({ ...e, ends: undefined }))
  }

  function validate(): { ok: true; startsAt: Date; endsAt: Date } | { ok: false } {
    const next: Errors = {}
    if (!title.trim()) next.title = 'Give it a name people will recognize.'
    if (!location.trim()) next.location = 'Where should people go?'
    if (!food.trim()) next.food = "What's being served?"

    const startsAt = fromBerkeleyInput(times.starts)
    const endsAt = fromBerkeleyInput(times.ends)
    if (!startsAt) next.starts = 'Pick a start time.'
    if (!endsAt) next.ends = 'Pick an end time.'
    if (startsAt && endsAt) {
      if (endsAt <= startsAt) next.ends = 'End time has to be after the start.'
      else if (endsAt.getTime() < Date.now()) next.ends = "That's already over."
    }

    setErrors(next)
    if (Object.keys(next).length > 0 || !startsAt || !endsAt) return { ok: false }
    return { ok: true, startsAt, endsAt }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const result = validate()
    if (!result.ok) return

    setBusy(true)
    setSubmitError(null)
    try {
      const created = await createEvent({
        title: title.trim(),
        location: location.trim(),
        food: food.trim(),
        host: host.trim() || null,
        starts_at: result.startsAt.toISOString(),
        ends_at: result.endsAt.toISOString(),
      })
      // Clear the form so the panel is ready for the next post.
      setTitle('')
      setLocation('')
      setFood('')
      setHost('')
      setTimes(defaultTimes())
      setErrors({})
      setBusy(false)
      onPosted(created)
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && err.fields) {
        // The server's zod check disagreed with something. Show it on the field.
        const f = err.fields
        setErrors({
          title: f.title,
          location: f.location,
          food: f.food,
          host: f.host,
          starts: f.starts_at,
          ends: f.ends_at,
        })
        setSubmitError(f.form ?? null)
      } else if (err instanceof ApiError && err.status === 429) {
        const mins = Math.ceil((err.retryAfterSeconds ?? 60) / 60)
        setSubmitError(`${err.message} (about ${mins} min)`)
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Something went wrong')
      }
      setBusy(false)
    }
  }

  const field = (name: keyof Errors) => ({
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${id}-${name}-err` : undefined,
  })

  const errorFor = (name: keyof Errors) =>
    errors[name] ? (
      <p id={`${id}-${name}-err`} className="field__error">
        {errors[name]}
      </p>
    ) : null

  return (
    <form className="post-form" onSubmit={handleSubmit} noValidate>
      {submitError && (
        <p className="form-alert" role="alert">
          {submitError}
        </p>
      )}

      <div className="field">
        <label htmlFor={`${id}-title`}>What is it</label>
        <input
          id={`${id}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoComplete="off"
          maxLength={LIMITS.title}
          placeholder="Leftover pizza from the CSUA meeting"
          {...field('title')}
        />
        {errorFor('title')}
      </div>

      <div className="field">
        <label htmlFor={`${id}-location`}>Where</label>
        <input
          id={`${id}-location`}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          autoComplete="off"
          maxLength={LIMITS.location}
          placeholder="Soda Hall 306"
          {...field('location')}
        />
        {errorFor('location')}
      </div>

      <div className="field">
        <label htmlFor={`${id}-food`}>Food</label>
        <input
          id={`${id}-food`}
          value={food}
          onChange={(e) => setFood(e.target.value)}
          autoComplete="off"
          maxLength={LIMITS.food}
          placeholder="Pizza, two veggie"
          {...field('food')}
        />
        {errorFor('food')}
      </div>

      <div className="field">
        <label htmlFor={`${id}-host`}>
          Host <span className="field__optional">optional</span>
        </label>
        <input
          id={`${id}-host`}
          value={host}
          onChange={(e) => setHost(e.target.value)}
          autoComplete="off"
          maxLength={LIMITS.host}
          placeholder="CSUA"
          {...field('host')}
        />
        {errorFor('host')}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor={`${id}-starts`}>Starts</label>
          <input
            id={`${id}-starts`}
            type="datetime-local"
            value={times.starts}
            onChange={(e) => setTimes((t) => ({ ...t, starts: e.target.value }))}
            {...field('starts')}
          />
          {errorFor('starts')}
        </div>
        <div className="field">
          <label htmlFor={`${id}-ends`}>Ends</label>
          <input
            id={`${id}-ends`}
            type="datetime-local"
            value={times.ends}
            onChange={(e) => setTimes((t) => ({ ...t, ends: e.target.value }))}
            {...field('ends')}
          />
          {errorFor('ends')}
        </div>
      </div>

      <div className="chips" role="group" aria-label="Set how long it lasts">
        {DURATIONS.map((d) => (
          <button key={d.minutes} type="button" className="chip" onClick={() => setDuration(d.minutes)}>
            {d.label}
          </button>
        ))}
      </div>
      <p className="field__hint">Times are Berkeley time. Posts disappear at the end time.</p>

      <div className="post-form__actions">
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Posting…' : 'Post it'}
        </button>
      </div>
    </form>
  )
}
