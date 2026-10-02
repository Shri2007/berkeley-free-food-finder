import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { LIMITS } from '../../shared/limits'
import { ApiError, createEvent, type FoodEvent } from './api'
import { fromBerkeleyInput, roundDownTo5, toBerkeleyInput } from './time'

interface Props {
  onClose: () => void
  onPosted: (event: FoodEvent) => void
}

const DURATIONS = [
  { label: '30 min', minutes: 30 },
  { label: '1 hr', minutes: 60 },
  { label: '2 hrs', minutes: 120 },
  { label: '3 hrs', minutes: 180 },
]

type Errors = Partial<Record<'title' | 'location' | 'food' | 'starts' | 'ends', string>>

export function PostSheet({ onClose, onPosted }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const id = useId()

  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [food, setFood] = useState('')
  const [host, setHost] = useState('')
  // Defaults: starting now, for an hour. Most posts are "there's food here, come".
  const [starts, setStarts] = useState(() => toBerkeleyInput(roundDownTo5(new Date())))
  const [ends, setEnds] = useState(() =>
    toBerkeleyInput(new Date(roundDownTo5(new Date()).getTime() + 60 * 60_000)),
  )

  const [errors, setErrors] = useState<Errors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Native <dialog> gives us focus trapping, Esc, and a backdrop for free.
  // No cleanup on purpose: calling close() here would fire the `close` event,
  // which unmounts the sheet. StrictMode's double effect run would do that instantly.
  // Unmounting removes the element from the DOM, which closes it silently.
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  function setDuration(minutes: number) {
    const start = fromBerkeleyInput(starts)
    if (!start) return
    setEnds(toBerkeleyInput(new Date(start.getTime() + minutes * 60_000)))
    setErrors((e) => ({ ...e, ends: undefined }))
  }

  function validate(): { ok: true; startsAt: Date; endsAt: Date } | { ok: false } {
    const next: Errors = {}
    if (!title.trim()) next.title = 'Give it a name people will recognize.'
    if (!location.trim()) next.location = 'Where should people go?'
    if (!food.trim()) next.food = "What's being served?"

    const startsAt = fromBerkeleyInput(starts)
    const endsAt = fromBerkeleyInput(ends)
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
      onPosted(created)
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && err.fields) {
        // The server's zod check disagreed with something. Show it on the field.
        const f = err.fields
        setErrors({
          title: f.title,
          location: f.location,
          food: f.food,
          starts: f.starts_at,
          ends: f.ends_at,
        })
        setSubmitError(f.form ?? f.host ?? null)
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

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      onClick={(e) => {
        // Clicks on the backdrop land on the dialog element itself.
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <form className="sheet__form" onSubmit={handleSubmit} noValidate>
        <div className="sheet__bar">
          <h2 id={`${id}-title`} className="sheet__title">
            Post free food
          </h2>
          <button type="button" className="btn btn--ghost btn--on-blue" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="sheet__body">
          {submitError && (
            <p className="form-alert" role="alert">
              {submitError}
            </p>
          )}

          <div className="field">
            <label htmlFor={`${id}-title-in`}>What is it</label>
            <input
              id={`${id}-title-in`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoComplete="off"
              maxLength={LIMITS.title}
              placeholder="Leftover pizza from the CSUA meeting"
              {...field('title')}
            />
            {errors.title && (
              <p id={`${id}-title-err`} className="field__error">
                {errors.title}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor={`${id}-location-in`}>Where</label>
            <input
              id={`${id}-location-in`}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              autoComplete="off"
              maxLength={LIMITS.location}
              placeholder="Soda Hall 306"
              {...field('location')}
            />
            {errors.location && (
              <p id={`${id}-location-err`} className="field__error">
                {errors.location}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor={`${id}-food-in`}>Food</label>
            <input
              id={`${id}-food-in`}
              value={food}
              onChange={(e) => setFood(e.target.value)}
              autoComplete="off"
              maxLength={LIMITS.food}
              placeholder="Pizza, two veggie"
              {...field('food')}
            />
            {errors.food && (
              <p id={`${id}-food-err`} className="field__error">
                {errors.food}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor={`${id}-host-in`}>
              Host <span className="field__optional">optional</span>
            </label>
            <input
              id={`${id}-host-in`}
              value={host}
              onChange={(e) => setHost(e.target.value)}
              autoComplete="off"
              maxLength={LIMITS.host}
              placeholder="CSUA"
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor={`${id}-starts-in`}>Starts</label>
              <input
                id={`${id}-starts-in`}
                type="datetime-local"
                value={starts}
                onChange={(e) => setStarts(e.target.value)}
                {...field('starts')}
              />
              {errors.starts && (
                <p id={`${id}-starts-err`} className="field__error">
                  {errors.starts}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor={`${id}-ends-in`}>Ends</label>
              <input
                id={`${id}-ends-in`}
                type="datetime-local"
                value={ends}
                onChange={(e) => setEnds(e.target.value)}
                {...field('ends')}
              />
              {errors.ends && (
                <p id={`${id}-ends-err`} className="field__error">
                  {errors.ends}
                </p>
              )}
            </div>
          </div>

          <div className="chips" role="group" aria-label="Set how long it lasts">
            {DURATIONS.map((d) => (
              <button
                key={d.minutes}
                type="button"
                className="chip"
                onClick={() => setDuration(d.minutes)}
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="field__hint">Times are Berkeley time. Posts disappear at the end time.</p>
        </div>

        <div className="sheet__actions">
          <button type="submit" className="btn btn--solid btn--wide" disabled={busy}>
            {busy ? 'Posting…' : 'Post it'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
