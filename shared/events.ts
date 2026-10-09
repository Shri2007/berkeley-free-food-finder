// The one definition of what a valid event looks like.
// The server uses it to reject bad input; the client reuses the limits and messages.
import { z } from 'zod'
import { LIMITS } from './limits'

export { LIMITS }

/* ---------- content checks ---------- */

// Anything that could be read as markup. React escapes output anyway, so this is
// defence in depth: we never store it, so no other consumer can mis-render it either.
const MARKUP = /[<>]/
// Control characters (except plain whitespace) have no business in a food post.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/
// Links are the main spam vector and nobody needs one to find pizza.
const URL_LIKE = /(https?:\/\/|www\.|\.(com|net|org|io|ly|xyz)(\/|\b))/i

/**
 * Cheap gibberish detector. Catches keyboard mashing ("asdfghjkl"), letter
 * spam ("aaaaaaaa") and symbol soup ("$$$ !!! ###") without blocking real
 * things like "HKN", "Dwinelle 155" or "Bagels & cream cheese".
 */
export function looksLikeGibberish(text: string): boolean {
  const letters = text.match(/\p{L}/gu)?.length ?? 0
  const nonSpace = text.replace(/\s/g, '').length
  if (nonSpace === 0) return true
  if (letters < 2) return true
  if (letters / nonSpace < 0.5) return true // mostly digits/symbols
  if (/(.)\1{4,}/iu.test(text)) return true // same character 5+ times in a row
  if (/[bcdfghjklmnpqrstvwxz]{6,}/i.test(text)) return true // 6+ consonants in a row
  if (letters >= 6) {
    const vowels = text.match(/[aeiouy]/gi)?.length ?? 0
    if (vowels / letters < 0.15) return true // words need vowels
  }
  return false
}

function cleanText(field: string, max: number, optional = false) {
  return z
    .string({ required_error: `${field} is required.`, invalid_type_error: `${field} must be text.` })
    .trim()
    .refine((s) => optional || s.length > 0, `${field} is required.`)
    .refine((s) => s.length <= max, `Keep ${field.toLowerCase()} under ${max} characters.`)
    .refine((s) => !MARKUP.test(s), `${field} can't contain < or >.`)
    .refine((s) => !CONTROL.test(s), `${field} contains characters that aren't allowed.`)
    .refine((s) => !URL_LIKE.test(s), `Links aren't allowed in ${field.toLowerCase()}.`)
    .refine((s) => (optional && s === '') || !looksLikeGibberish(s), `${field} doesn't look like real text.`)
}

const isoDate = (field: string) =>
  z
    .string({ required_error: `${field} is required.`, invalid_type_error: `${field} must be a date.` })
    .datetime({ offset: true, message: `${field} must be an ISO date like 2026-10-01T23:45:00Z.` })

export const eventInputSchema = z
  .object({
    title: cleanText('Title', LIMITS.title),
    location: cleanText('Location', LIMITS.location),
    food: cleanText('Food', LIMITS.food),
    host: cleanText('Host', LIMITS.host, true)
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
