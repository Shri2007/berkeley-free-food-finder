// Size limits for an event. Kept separate from the zod schema so the browser
// can import these numbers without pulling zod into its bundle.
export const LIMITS = {
  title: 80,
  location: 80,
  food: 80,
  host: 60,
  maxDurationHours: 12,
  maxDaysAhead: 7,
} as const
