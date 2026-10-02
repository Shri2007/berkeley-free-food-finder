// The one definition of what a valid event looks like.
// The server uses it to reject bad input; the client uses it for the same limits and messages.
import { z } from 'zod'
import { LIMITS } from './limits'

export { LIMITS }

const text = (field: string, max: number) =>
  z
    .string({ required_error: `${field} is required.`, invalid_type_error: `${field} must be text.` })
    .trim()
    .min(1, `${field} is required.`)
    .max(max, `Keep ${field.toLowerCase()} under ${max} characters.`)

const isoDate = (field: string) =>
  z
    .string({ required_error: `${field} is required.`, invalid_type_error: `${field} must be a date.` })
    .datetime({ offset: true, message: `${field} must be an ISO date like 2026-10-01T23:45:00Z.` })

export const eventInputSchema = z
  .object({
    title: text('Title', LIMITS.title),
    location: text('Location', LIMITS.location),
    food: text('Food', LIMITS.food),
    host: z
      .string({ invalid_type_error: 'Host must be text.' })
      .trim()
      .max(LIMITS.host, `Keep host under ${LIMITS.host} characters.`)
      .nullish()
      .transform((v) => (v ? v : null)),
    starts_at: isoDate('Start time'),
    ends_at: isoDate('End time'),
  })
  .superRefine((v, ctx) => {
    const starts = Date.parse(v.starts_at)
    const ends = Date.parse(v.ends_at)
    const now = Date.now()
    const hour = 60 * 60 * 1000

    if (ends <= starts) {
      ctx.addIssue({ code: 'custom', path: ['ends_at'], message: 'End time has to be after the start.' })
    } else if (ends < now) {
      ctx.addIssue({ code: 'custom', path: ['ends_at'], message: "That's already over." })
    } else if (ends - starts > LIMITS.maxDurationHours * hour) {
      ctx.addIssue({
        code: 'custom',
        path: ['ends_at'],
        message: `Keep it under ${LIMITS.maxDurationHours} hours. Post again if it runs long.`,
      })
    }
    if (starts > now + LIMITS.maxDaysAhead * 24 * hour) {
      ctx.addIssue({
        code: 'custom',
        path: ['starts_at'],
        message: `Posts can be up to ${LIMITS.maxDaysAhead} days ahead.`,
      })
    }
  })

export type EventInput = z.infer<typeof eventInputSchema>

/** Flatten a zod error to one message per field, for the API response and the form. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form')
    if (!(key in out)) out[key] = issue.message
  }
  return out
}
